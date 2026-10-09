import * as nip19 from "nostr-tools/nip19"
import {derived, get, readable, writable} from "svelte/store"
import {
  ago,
  call,
  chunks,
  countBy,
  first,
  groupBy,
  indexBy,
  HOUR,
  int,
  max,
  min,
  noop,
  partition,
  pushToMapKey,
  removeUndefined,
  shuffle,
  sortBy,
  take,
  tryCatch,
  uniq,
  uniqBy,
} from "@welshman/lib"
import type {Maybe} from "@welshman/lib"
import {
  COMMENT,
  NOTE,
  eventOutbox,
  fromNostrURI,
  getAddress,
  getCommentFiltersForRoot,
  getIdAndAddress,
  getIdFilters,
  getIdOrAddress,
  hexTags,
  isRelayUrl,
  matchTag,
  relays as relaySelections,
  seen,
  tagSpec,
  tagValue,
  tagValues,
  topicTags,
} from "@welshman/util"
import type {EventRef, TrustedEvent} from "@welshman/util"
import type {EventPointer} from "nostr-tools/nip19"
import {synced, withGetter} from "@welshman/store"
import {
  Comment,
  displayPubkey,
  getCommentTagValues,
  getReplyTagValues,
  getReplyTags,
} from "@welshman/domain"
import type {CommentRef} from "@welshman/domain"
import {Events, FollowLists, MuteLists, Network, Profiles, Router} from "@welshman/app"
import type {IApp} from "@welshman/app"
import {decodeGeohash} from "@lib/geohash"
import {createScroller} from "@lib/html"
import {CONTENT_KINDS} from "@app/content"
import {deriveUserItem, fromApp, profiles, reader, relayLists, user, usePlugin} from "@app/core"
import {isFeedLoading, makeFeed, makeFeedContext, makeScrollLoader} from "@app/feeds"
import type {FeedLoadState} from "@app/feeds"
import {outboxUrls} from "@app/relays"
import {getProfileGeohash} from "@app/location"
import type {QuotePointer} from "@app/quotes"
import {DEFAULT_PUBKEYS} from "@app/env"
import {kv} from "@app/storage"

// People

const profileIndex = fromApp($app => $app.use(Profiles).index.$)

export const deriveDisplaysByPubkey = (pubkeys: string[], url?: string) => {
  const relays = removeUndefined([url])

  // Load profiles
  for (const pubkey of pubkeys) {
    if (pubkey) {
      profiles.get().load(pubkey, relays).catch(noop)
    }
  }

  return derived(
    profileIndex,
    $index =>
      new Map(
        pubkeys.map(pubkey => [
          pubkey,
          pubkey ? ($index.get(pubkey)?.display() ?? displayPubkey(pubkey)) : "",
        ]),
      ),
    new Map<string, string>(),
  )
}

export type MemberPin = {
  pubkey: string
  display: string
  latitude: number
  longitude: number
}

export const deriveMemberPins = (pubkeys: string[], url?: string) => {
  const relays = removeUndefined([url])

  for (const pubkey of pubkeys) {
    profiles.get().load(pubkey, relays).catch(noop)
  }

  return derived(profileIndex, $index =>
    removeUndefined(
      pubkeys.map(pubkey => {
        const profile = $index.get(pubkey)
        const coordinates = decodeGeohash(getProfileGeohash(profile))

        return coordinates
          ? {pubkey, display: profile?.display() ?? displayPubkey(pubkey), ...coordinates}
          : undefined
      }),
    ),
  )
}

export const bootstrapPubkeys = derived(deriveUserItem(FollowLists), $userFollowList => {
  const appPubkeys = DEFAULT_PUBKEYS.split(",")
  const userPubkeys = shuffle($userFollowList?.pubkeys() ?? [])

  return userPubkeys.length > 5 ? userPubkeys : [...userPubkeys, ...appPubkeys]
})

// Pointers: how an event is named before it has been loaded.

export const decodeNotePointer = (entity: string): Maybe<EventPointer> => {
  const decoded = tryCatch(() => nip19.decode(fromNostrURI(entity)))

  if (decoded?.type === "nevent") {
    return decoded.data
  }

  if (decoded?.type === "note") {
    return {id: decoded.data}
  }
}

// A relay selection names an event author `pubkey`, where an event pointer names it `author`.
export const getQuoteRef = (pointer: QuotePointer): EventRef =>
  pointer.id
    ? {id: pointer.id, pubkey: pointer.author, kind: pointer.kind, relays: pointer.relays}
    : pointer

// Structure: the shape of a conversation, read off tags alone.

// Ids and addresses of an event's immediate parents, falling back to its thread roots.
export const getParents = ({kind, tags}: TrustedEvent) => {
  const {roots, replies} = kind === COMMENT ? getCommentTagValues(tags) : getReplyTagValues(tags)

  return replies.length > 0 ? replies : roots
}

// A reply names the note it answers with an `e` tag, and a deeper one names the thread root too.
export const getThreadFilters = (event: TrustedEvent) => {
  const roots = tagValues(hexTags("e"), getReplyTags(event.tags).roots)

  return [...getCommentFiltersForRoot([event]), {kinds: [NOTE], "#e": uniq([event.id, ...roots])}]
}

// A reply names only the event above it, so the set grows a generation at a time.
export const getDescendants = (root: TrustedEvent, events: TrustedEvent[]) => {
  const values = new Set(getIdAndAddress(root))
  const descendants: TrustedEvent[] = []

  let growing = true

  while (growing) {
    growing = false

    for (const event of events) {
      if (!values.has(event.id) && getParents(event).some(value => values.has(value))) {
        for (const value of getIdAndAddress(event)) {
          values.add(value)
        }

        descendants.push(event)
        growing = true
      }
    }
  }

  return descendants
}

export type CommentNode = {
  comment: TrustedEvent
  children: CommentNode[]
}

export const buildCommentTree = (root: TrustedEvent, comments: TrustedEvent[]) => {
  const byParent = new Map<string, TrustedEvent[]>()

  // A comment names its parent by id, and by address where the parent is addressable.
  for (const comment of comments) {
    for (const parent of getParents(comment)) {
      pushToMapKey(byParent, parent, comment)
    }
  }

  // Nothing stops a comment naming several parents, which would let the tree cycle.
  const seenIds = new Set<string>()

  const build = (parent: TrustedEvent): CommentNode[] => {
    const children = uniqBy(
      e => e.id,
      getIdAndAddress(parent).flatMap(value => byParent.get(value) ?? []),
    ).filter(e => !seenIds.has(e.id))

    for (const child of children) {
      seenIds.add(child.id)
    }

    return children.map(comment => ({comment, children: build(comment)}))
  }

  const nodes = build(root)

  // A comment can name a parent we don't have, and `comments` is oldest first, so parents come before children.
  for (const comment of comments) {
    if (!seenIds.has(comment.id)) {
      seenIds.add(comment.id)
      nodes.push({comment, children: build(comment)})
    }
  }

  return sortBy(node => node.comment.created_at, nodes)
}

// What a reply answers and the root of its thread, each named with the author its tag carries.
export type ReplyRef = {id: string; author?: string; relays: string[]}

const fromCommentRef = ({id, pubkey}: CommentRef): Maybe<ReplyRef> =>
  id ? {id, author: pubkey, relays: []} : undefined

// A tag naming an event carries a relay hint in third position, which is optional and often junk.
const relayHint = (url: Maybe<string>) => (url && isRelayUrl(url) ? [url] : [])

// NIP-10 names the author of the event answered in the fifth position of the tag naming it.
const fromReplyTag = (tag: Maybe<string[]>): Maybe<ReplyRef> =>
  tag && {id: tag[1], author: tag[4] || undefined, relays: relayHint(tag[2])}

// A direct reply names only the thread root, so the event answered and the root can be the same one.
export const getReplyRefs = (event: TrustedEvent) => {
  if (event.kind === COMMENT) {
    const comment = reader(Comment)(event)

    return {parent: fromCommentRef(comment.parent()), root: fromCommentRef(comment.root())}
  }

  const {roots, replies} = getReplyTags(event.tags)

  return {parent: fromReplyTag(replies[0]), root: fromReplyTag(roots[0])}
}

// One entry in the home notifications feed: a note, who answered it, and who reacted to it.
export type HomeNotification = {
  key: string
  ref: ReplyRef
  replies: TrustedEvent[]
  reactions: TrustedEvent[]
  timestamp: number
}

const isReplyKind = (event: TrustedEvent) => event.kind === NOTE || event.kind === COMMENT

// What a notification is about: the note it answers or reacts to, or itself when it is a mention.
export const getNotificationRef = (event: TrustedEvent): Maybe<ReplyRef> => {
  if (isReplyKind(event)) {
    const {parent, root} = getReplyRefs(event)

    return parent ?? root ?? {id: event.id, author: event.pubkey, relays: []}
  }

  // NIP-25 asks a reaction to carry the tags of the event it is about, author included.
  const tag = matchTag(tagSpec("e"), event.tags)

  return tag && {id: tag[1], author: tagValue(tagSpec("p"), event.tags), relays: relayHint(tag[2])}
}

// An entry is a note and what was done to it, so nothing else can be the note one is drawn around.
export const isNotificationTarget = (event: TrustedEvent) =>
  event.kind === NOTE ||
  (event.kind === COMMENT && reader(Comment)(event).root().kind === String(NOTE))

// Two entries in a row about one note read as a duplicate, whatever bucket split them.
const mergeAdjacent = (notifications: HomeNotification[]) => {
  const merged: HomeNotification[] = []

  for (const notification of notifications) {
    const previous = merged[merged.length - 1]

    if (previous?.ref.id === notification.ref.id) {
      merged[merged.length - 1] = {
        ...previous,
        ref: {
          ...previous.ref,
          author: previous.ref.author ?? notification.ref.author,
          relays: uniq([...previous.ref.relays, ...notification.ref.relays]),
        },
        replies: [...previous.replies, ...notification.replies],
        reactions: [...previous.reactions, ...notification.reactions],
      }
    } else {
      merged.push(notification)
    }
  }

  return merged
}

// Everything done to one note collapses into a single entry rather than one per answer.
export const groupNotifications = (events: TrustedEvent[]) => {
  const interval = int(HOUR, 3)
  const notifications = new Map<string, HomeNotification>()

  for (const event of events) {
    const ref = getNotificationRef(event)

    if (ref) {
      // The window is measured back from now, so two answers minutes apart never straddle an edge.
      const key = `${ref.id}:${Math.round(ago(event.created_at) / interval)}`
      const notification = notifications.get(key) ?? {
        key,
        ref,
        replies: [],
        reactions: [],
        timestamp: 0,
      }

      if (ref.id !== event.id) {
        const answers = isReplyKind(event) ? notification.replies : notification.reactions

        answers.push(event)
      }

      notifications.set(key, {
        ...notification,
        ref: {
          id: ref.id,
          author: notification.ref.author ?? ref.author,
          relays: uniq([...notification.ref.relays, ...ref.relays]),
        },
        timestamp: max([notification.timestamp, event.created_at]),
      })
    }
  }

  return mergeAdjacent(
    sortBy(notification => -notification.timestamp, Array.from(notifications.values())),
  )
}

// The network feed

// What the feed can be narrowed to, with both types included until the reader says otherwise.
export const networkFeedTypes = [
  {value: "notes", label: "Notes"},
  {value: "replies", label: "Replies"},
] as const

export type NetworkFeedType = (typeof networkFeedTypes)[number]["value"]

export const includedNetworkFeedTypes = synced<NetworkFeedType[]>({
  key: "includedNetworkFeedTypes",
  defaultValue: networkFeedTypes.map(({value}) => value),
  storage: kv,
})

// Only a kind 1 carries NIP-10 reply tags, so an article or a poll in the feed is a note.
const networkFeedType = (event: TrustedEvent): NetworkFeedType =>
  event.kind === NOTE && getReplyTags(event.tags).replies.length > 0 ? "replies" : "notes"

export const isIncludedNetworkFeedEvent = derived(
  includedNetworkFeedTypes,
  $included => (event: TrustedEvent) => $included.includes(networkFeedType(event)),
)

export const countNetworkFeedTypes = (events: TrustedEvent[]) => countBy(networkFeedType, events)

// One card in the network feed: the note it is drawn around, and the replies answering it.
export type NetworkFeedEntry = {
  ref: ReplyRef
  note?: TrustedEvent
  replies: TrustedEvent[]
}

// What a feed event is drawn under: the note a reply answers, or the event itself.
const getNetworkFeedRef = (event: TrustedEvent): ReplyRef => {
  const {parent, root} = getReplyRefs(event)
  const answered = networkFeedType(event) === "replies" ? (parent ?? root) : undefined

  return answered ?? {id: event.id, author: event.pubkey, relays: []}
}

// Where an entry sits in the feed: its note, or the oldest reply when the note is not loaded.
const getNetworkFeedTimestamp = (entry: NetworkFeedEntry) =>
  entry.note?.created_at ?? min(entry.replies.map(reply => reply.created_at))

// A reply collapses into the entry for the note it answers, so two replies to one note share it.
export const groupNetworkFeedEvents = (events: TrustedEvent[]): NetworkFeedEntry[] => {
  const grouped = groupBy(
    ({ref}) => ref.id,
    events.map(event => ({ref: getNetworkFeedRef(event), event})),
  )

  const entries = Array.from(grouped, ([id, group]): NetworkFeedEntry => {
    const [anchors, replies] = partition(({ref, event}) => ref.id === event.id, group)

    return {
      ref: {
        id,
        author: first(removeUndefined(group.map(({ref}) => ref.author))),
        relays: uniq(group.flatMap(({ref}) => ref.relays)),
      },
      note: first(anchors)?.event,
      replies: replies.map(({event}) => event),
    }
  })

  return sortBy(entry => -getNetworkFeedTimestamp(entry), entries)
}

/**
 * The home network feed: one timeline per follow group, merged newest first,
 * with every entry held back until the note it is drawn around is in hand, so
 * nothing already on screen gains a card above it. `start` takes the scroll
 * container, which the caller owns along with the type filters and the markup.
 */
export const makeNetworkFeed = () => {
  const context = makeFeedContext({
    relays: relayLists.get().readUrls(user.get().pubkey).get(),
    withReplies: true,
  })

  const pages = writable<TrustedEvent[][]>([])
  const states = writable<FeedLoadState[]>([])
  const drawn = writable<string[]>([])
  const anchors = writable(new Map<string, Maybe<TrustedEvent>>())
  const unsubscribers: (() => void)[] = []

  let admitting = false
  let stopped = false

  // Everything the feed holds, newest first, less whoever the reader muted.
  const candidates = derived([pages, isEventMuted], ([$pages, $isEventMuted]) =>
    uniqBy(
      getIdOrAddress,
      sortBy(
        event => -event.created_at,
        $pages.flat().filter(event => !$isEventMuted(event)),
      ),
    ),
  )

  const items = derived([candidates, isIncludedNetworkFeedEvent], ([$candidates, $isIncluded]) =>
    $candidates.filter($isIncluded),
  )

  const grouped = derived(items, $items => groupNetworkFeedEvents($items))

  // What the feed holds and has not drawn, newest first. An entry waits here for its note.
  const buffer = derived([grouped, anchors], ([$grouped, $anchors]) =>
    $grouped.filter(entry => !$anchors.has(entry.ref.id)),
  )

  // Drawn entries keep the order they were drawn in, so nothing already on screen moves.
  const entries = derived([grouped, drawn, anchors], ([$grouped, $drawn, $anchors]) => {
    const byRef = indexBy(entry => entry.ref.id, $grouped)

    return removeUndefined($drawn.map(id => byRef.get(id))).map(entry => ({
      ...entry,
      // A note the feed carries itself still belongs on its card when the load missed it.
      note: $anchors.get(entry.ref.id) ?? entry.note,
    }))
  })

  const loading = derived(
    [states, buffer],
    ([$states, $buffer]) => $states.some(isFeedLoading) || $buffer.length > 0,
  )

  const exhausted = derived(
    states,
    $states => $states.length > 0 && $states.every(state => state.status === "exhausted"),
  )

  // Every entry's note is in hand before it is drawn, so no card gains one above it afterwards.
  const admit = async () => {
    const batch = take(10, get(buffer))

    if (!admitting && batch.length > 0) {
      admitting = true

      try {
        const loaded = await Promise.all(
          batch.map(
            async entry =>
              [
                entry.ref.id,
                entry.note ?? (await notes.get().loadParent(entry.ref, entry.replies)),
              ] as const,
          ),
        )

        anchors.update($anchors => new Map([...$anchors, ...loaded]))
        drawn.update($drawn => [...$drawn, ...batch.map(entry => entry.ref.id)])
      } finally {
        admitting = false
      }
    }
  }

  // Each group walks its own timeline, so a slow group holds up nobody else's next page.
  const startGroup = async (element: HTMLElement, pubkeys: string[], index: number) => {
    const relays = await outboxUrls(pubkeys, 10)

    if (!stopped) {
      const feed = makeFeed({
        relays,
        // Half the group's relays answering is enough to show its page, since the rest get asked again.
        quorum: 0.5,
        useCache: false,
        filters: [{kinds: [NOTE, ...CONTENT_KINDS], authors: pubkeys}],
        onEvent: context.add,
      })

      const loader = makeScrollLoader(element, feed.loadOlder)

      unsubscribers.push(
        feed.events.subscribe($events =>
          pages.update($pages => {
            $pages[index] = $events

            return $pages
          }),
        ),
        loader.subscribe($state =>
          states.update($states => {
            $states[index] = $state

            return $states
          }),
        ),
        loader.stop,
        feed.cleanup,
      )
    }
  }

  // One selection over every follow lands on the few biggest relays, so each group scores its own.
  const start = (element: HTMLElement, pubkeys: string[]) => {
    const groups = chunks(3, shuffle(pubkeys)).filter(group => group.length > 0)
    const scroller = createScroller({element, delay: 300, onScroll: admit})

    pages.set(groups.map(() => []))
    states.set(groups.map(() => ({status: "idle"})))
    groups.forEach((group, index) => startGroup(element, group, index))
    unsubscribers.push(scroller.stop)
  }

  const stop = () => {
    stopped = true
    unsubscribers.forEach(call)
    context.cleanup()
  }

  return {context, candidates, items, entries, loading, exhausted, start, stop}
}

// Muting

export const isEventMuted = withGetter(
  derived([user, deriveUserItem(MuteLists)], ([$user, $muteList]) => {
    const mutedEvents = new Set($muteList?.ids())
    const mutedPubkeys = new Set($muteList?.pubkeys())
    const mutedAddresses = new Set($muteList?.addresses())
    const mutedTopics = new Set($muteList?.topics())
    // Words come from any client, so a blank or a regex character must not mute everyone or throw.
    const mutedWords = ($muteList?.words() ?? [])
      .map(word => word.toLowerCase().trim())
      .filter(Boolean)
      .map(word => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    const regex = mutedWords.length > 0 ? new RegExp(`\\b(${mutedWords.join("|")})\\b`) : undefined

    return (e: TrustedEvent) => {
      if (!$muteList) {
        return false
      }
      if ($user.pubkey === e.pubkey) {
        return false
      }
      if (mutedPubkeys.has(e.pubkey)) {
        return true
      }
      if (mutedEvents.has(e.id)) {
        return true
      }
      if (mutedAddresses.has(getAddress(e))) {
        return true
      }
      if (getParents(e).some(v => mutedEvents.has(v) || mutedAddresses.has(v))) {
        return true
      }
      if (tagValues(topicTags("t"), e.tags).some(t => mutedTopics.has(t))) {
        return true
      }

      if (regex) {
        const profile = profiles.get().get(e.pubkey)

        if (profile?.display().toLowerCase().match(regex)) {
          return true
        }
        if (profile?.nip05()?.toLowerCase().match(regex)) {
          return true
        }
      }

      return false
    }
  }),
)

// Loading: where a note lives, and the stores a page reads it and its conversation from.

export class Notes {
  constructor(private readonly app: IApp) {}

  // The hints it arrived with, the relays it has been seen on, and its author's outbox.
  relays = (ref: EventRef) =>
    this.app
      .use(Router)
      .resolver.relays([...relaySelections(ref.relays ?? []), seen(ref), eventOutbox(ref)])

  load = async (pointer: EventPointer) =>
    this.app.repository.getEvent(pointer.id) ??
    first(
      await this.app.use(Network).loadComplete({
        relays: await this.relays(getQuoteRef(pointer)),
        filters: getIdFilters([pointer.id]),
      }),
    )

  // A reply tag often names neither a relay nor an author, and the reply's own relays are a route.
  loadParent = async (ref: ReplyRef, replies: TrustedEvent[]) =>
    this.app.repository.getEvent(ref.id) ??
    first(
      await this.app.use(Network).loadComplete({
        relays: await this.app
          .use(Router)
          .resolver.relays([
            ...relaySelections(ref.relays),
            seen(ref),
            ...replies.map(reply => seen({id: reply.id})),
          ]),
        filters: getIdFilters([ref.id]),
        signal: AbortSignal.timeout(3000),
      }),
    )

  // A pointer carrying no hints would never resolve, so the load beside it asks the author's relays.
  deriveEvent = (pointer: EventPointer) => {
    this.load(pointer)

    return this.app.use(Events).one(pointer.id, pointer.relays ?? []).$
  }

  // The filters reach past direct replies, so the tree is built from what hangs off the note.
  deriveReplies = (event: TrustedEvent) =>
    readable<CommentNode[]>([], set => {
      const filters = getThreadFilters(event)
      const controller = new AbortController()

      this.relays(event).then(relays =>
        this.app.use(Network).request({relays, filters, signal: controller.signal}),
      )

      const unsubscribe = this.app
        .use(Events)
        .asc(filters)
        .$.subscribe($events => set(buildCommentTree(event, getDescendants(event, $events))))

      return () => {
        controller.abort()
        unsubscribe()
      }
    })
}

export const notes = usePlugin(Notes)
