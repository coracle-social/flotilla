import {derived, get, readable, writable} from "svelte/store"
import type {Readable} from "svelte/store"
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
  uniq,
  uniqBy,
} from "@welshman/lib"
import type {Maybe} from "@welshman/lib"
import {
  COMMENT,
  EventRef,
  GENERIC_REPOST,
  NOTE,
  REPOST,
  getAddress,
  getCommentFiltersForRoot,
  getIdAndAddress,
  getIdOrAddress,
  getRelayHints,
  hexTags,
  matchTag,
  outbox,
  tagSpec,
  tagValue,
  tagValues,
  topicTags,
} from "@welshman/util"
import type {EventContent, IEventRef, TrustedEvent} from "@welshman/util"
import {synced, withGetter} from "@welshman/store"
import {Comment, Note, displayPubkey} from "@welshman/domain"
import {Events, Network, Profiles, Router, publish} from "@welshman/app"
import type {IApp} from "@welshman/app"
import {decodeGeohash} from "@lib/geohash"
import {createScroller} from "@lib/html"
import {CONTENT_KINDS} from "@app/features/spaces"
import {fromApp} from "@app/core/app"
import {user, userFollowList, userMuteList} from "@app/core/user"
import {deletes, profiles, reactions, router, usePlugin} from "@app/core/plugins"
import {reader} from "@app/core/domain"
import {isFeedLoading, makeFeed, makeFeedLoader} from "@app/features/feeds"
import type {FeedContext, FeedLoadState} from "@app/features/feeds"
import {getProfileGeohash} from "@app/features/location"
import {DEFAULT_PUBKEYS} from "@app/core/env"
import {kv} from "@app/core/storage"

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

export const bootstrapPubkeys = derived(userFollowList, $userFollowList => {
  const appPubkeys = DEFAULT_PUBKEYS.split(",")
  const userPubkeys = shuffle($userFollowList?.pubkeys() ?? [])

  return userPubkeys.length > 5 ? userPubkeys : [...userPubkeys, ...appPubkeys]
})

// Pointers: how an event is named before it has been loaded.

// Structure: the shape of a conversation, read off tags alone.

export const REPOST_KINDS = [REPOST, GENERIC_REPOST]

// Ids and addresses of what an event answers; NIP-25 has a reaction name its target last, as reposts and zaps do.
export const getParents = (event: TrustedEvent) => {
  if (isReplyKind(event)) {
    const {parent, root} = getReplyRefs(event)

    return (parent ?? root)?.getIdAndAddress() ?? []
  }

  return tagValues(hexTags("e"), event.tags).slice(-1)
}

// A reply names the note it answers with an `e` tag, and a deeper one names the thread root too.
export const getThreadFilters = (event: TrustedEvent) => {
  const root = event.kind === NOTE ? reader(Note)(event).root()?.id : undefined

  return [
    ...getCommentFiltersForRoot([event]),
    {kinds: [NOTE], "#e": uniq(removeUndefined([event.id, root]))},
  ]
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

// Only a note or a comment answers another event, through NIP-10 or NIP-22 tags.
export const getReplyRefs = (event: TrustedEvent) => {
  const thread = call(() => {
    switch (event.kind) {
      case NOTE:
        return reader(Note)(event)
      case COMMENT:
        return reader(Comment)(event)
    }
  })

  return {parent: thread?.parent(), root: thread?.root()}
}

// One entry in the home notifications feed: a note, who answered it, and who reacted to it.
export type HomeNotification = {
  key: string
  ref: EventRef
  replies: TrustedEvent[]
  reactions: TrustedEvent[]
  timestamp: number
}

const isReplyKind = (event: TrustedEvent) => event.kind === NOTE || event.kind === COMMENT

// What a notification is about: the note it answers or reacts to, or itself when it is a mention.
export const getNotificationRef = (event: TrustedEvent): Maybe<EventRef> => {
  if (isReplyKind(event)) {
    const {parent, root} = getReplyRefs(event)

    return parent ?? root ?? EventRef.fromEvent(event)
  }

  // NIP-25 asks a reaction to carry the tags of the event it is about, author included.
  const tag = matchTag(tagSpec("e"), event.tags)
  const pubkey = tagValue(tagSpec("p"), event.tags)

  return tag && new EventRef({id: tag[1], pubkey, relays: getRelayHints(tag)})
}

// An entry is a note and what was done to it, so nothing else can be the note one is drawn around.
export const isNotificationTarget = (event: TrustedEvent) =>
  event.kind === NOTE || (event.kind === COMMENT && reader(Comment)(event).root()?.kind === NOTE)

// Two entries in a row about one note read as a duplicate, whatever bucket split them.
const mergeAdjacent = (notifications: HomeNotification[]) => {
  const merged: HomeNotification[] = []

  for (const notification of notifications) {
    const previous = merged[merged.length - 1]

    if (previous?.ref.getAddressOrId() === notification.ref.getAddressOrId()) {
      merged[merged.length - 1] = {
        ...previous,
        ref: EventRef.merge(previous.ref, notification.ref),
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
    const target = ref?.getAddressOrId()

    if (ref && target) {
      // The window is measured back from now, so two answers minutes apart never straddle an edge.
      const key = `${target}:${Math.round(ago(event.created_at) / interval)}`
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
        ref: EventRef.merge(notification.ref, ref),
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
  event.kind === NOTE && reader(Note)(event).parent() ? "replies" : "notes"

export const isIncludedNetworkFeedEvent = derived(
  includedNetworkFeedTypes,
  $included => (event: TrustedEvent) => $included.includes(networkFeedType(event)),
)

export const countNetworkFeedTypes = (events: TrustedEvent[]) => countBy(networkFeedType, events)

// One card in the network feed: the note it is drawn around, and the replies answering it.
export type NetworkFeedEntry = {
  key: string
  ref: EventRef
  note?: TrustedEvent
  replies: TrustedEvent[]
}

// What a feed event is drawn under: the note a reply answers, or the event itself.
const getNetworkFeedRef = (event: TrustedEvent) => {
  const answered = networkFeedType(event) === "replies" ? getReplyRefs(event).parent : undefined

  return answered ?? EventRef.fromEvent(event)
}

// Where an entry sits in the feed: its note, or the oldest reply when the note is not loaded.
const getNetworkFeedTimestamp = (entry: NetworkFeedEntry) =>
  entry.note?.created_at ?? min(entry.replies.map(reply => reply.created_at))

// A reply collapses into the entry for the note it answers, so two replies to one note share it.
export const groupNetworkFeedEvents = (events: TrustedEvent[]): NetworkFeedEntry[] => {
  const items = events.flatMap(event => {
    const ref = getNetworkFeedRef(event)
    const key = ref.getAddressOrId()

    return key ? [{key, ref, event}] : []
  })

  const entries = Array.from(
    groupBy(item => item.key, items),
    ([key, group]): NetworkFeedEntry => {
      const [anchors, replies] = partition(({ref, event}) => ref.id === event.id, group)

      return {
        key,
        ref: group.map(({ref}) => ref).reduce(EventRef.merge),
        note: first(anchors)?.event,
        replies: replies.map(({event}) => event),
      }
    },
  )

  return sortBy(entry => -getNetworkFeedTimestamp(entry), entries)
}

export type NetworkFeedOptions = {
  context: FeedContext
  kinds?: number[]
  isIncluded?: Readable<(event: TrustedEvent) => boolean>
  pinned?: Readable<TrustedEvent[]>
  sortByTime?: boolean
}

/** Notes with each reply drawn under the note it answers. The caller owns the context. */
export const makeNetworkFeed = ({
  context,
  kinds = [NOTE, ...CONTENT_KINDS],
  isIncluded = readable(() => true),
  pinned = readable<TrustedEvent[]>([]),
  sortByTime = false,
}: NetworkFeedOptions) => {
  const pages = writable<TrustedEvent[][]>([])
  const states = writable<FeedLoadState[]>([])
  const drawn = writable<string[]>([])
  const anchors = writable(new Map<string, Maybe<TrustedEvent>>())
  const unsubscribers: (() => void)[] = []
  const loaders: ReturnType<typeof makeFeedLoader>[] = []

  let admitting = false
  let stopped = false

  const pinnedFirst = derived(pinned, $pinned => {
    const keys = new Set($pinned.map(getIdOrAddress))

    return (entry: NetworkFeedEntry) => (keys.has(entry.key) ? 0 : 1)
  })

  // Everything the feed holds, newest first, less whoever the reader muted.
  const candidates = derived([pages, pinned, isEventMuted], ([$pages, $pinned, $isEventMuted]) =>
    uniqBy(
      getIdOrAddress,
      sortBy(
        event => -event.created_at,
        // A pinned note can be older than the feed has paged back to, so it is merged in.
        [...$pinned, ...$pages.flat()].filter(event => !$isEventMuted(event)),
      ),
    ),
  )

  const items = derived([candidates, isIncluded], ([$candidates, $isIncluded]) =>
    $candidates.filter($isIncluded),
  )

  const grouped = derived([items, pinnedFirst], ([$items, $pinnedFirst]) =>
    sortBy($pinnedFirst, groupNetworkFeedEvents($items)),
  )

  // What the feed holds and has not drawn, newest first. An entry waits here for its note.
  const buffer = derived([grouped, anchors], ([$grouped, $anchors]) =>
    $grouped.filter(entry => !$anchors.has(entry.key)),
  )

  const entries = derived([grouped, drawn, anchors], ([$grouped, $drawn, $anchors]) => {
    const drawnKeys = new Set($drawn)
    const byKey = indexBy(entry => entry.key, $grouped)
    // Merged timelines page at their own rates, so time order would move entries already drawn.
    const ordered = sortByTime
      ? $grouped.filter(entry => drawnKeys.has(entry.key))
      : removeUndefined($drawn.map(key => byKey.get(key)))

    return ordered.map(entry => ({
      ...entry,
      // A note the feed carries itself still belongs on its card when the load missed it.
      note: $anchors.get(entry.key) ?? entry.note,
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
    // Drawing waits on each entry's note, so the page grows too slowly to say when to fetch.
    if (get(buffer).length < 20) {
      loaders.forEach(loader => loader.run())
    }

    const batch = take(10, get(buffer))

    if (!admitting && batch.length > 0) {
      admitting = true

      try {
        const loaded = await Promise.all(
          batch.map(
            async entry => [entry.key, entry.note ?? (await notes.get().load(entry.ref))] as const,
          ),
        )

        anchors.update($anchors => new Map([...$anchors, ...loaded]))
        drawn.update($drawn => [...$drawn, ...batch.map(entry => entry.key)])
      } finally {
        admitting = false
      }
    }
  }

  const settle = () => loaders.forEach(loader => loader.settle())

  // Each group walks its own timeline, so a slow group holds up nobody else's next page.
  const startGroup = async (pubkeys: string[], index: number) => {
    const scenario = await router.get().resolve(pubkeys.map(pubkey => outbox(pubkey)))
    const relays = scenario.limit(10).getUrls()

    if (!stopped) {
      const feed = makeFeed({
        relays,
        // Half the group's relays answering is enough to show its page, since the rest get asked again.
        quorum: 0.5,
        useCache: false,
        filters: [{kinds, authors: pubkeys}],
        onEvent: context.add,
      })

      const loader = makeFeedLoader(feed.loadOlder)

      loaders.push(loader)
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
        feed.cleanup,
      )
    }
  }

  // One selection over every follow lands on the few biggest relays, so each group scores its own.
  const start = (element: HTMLElement, pubkeys: string[]) => {
    const groups = chunks(3, shuffle(pubkeys)).filter(group => group.length > 0)
    const scroller = createScroller({element, delay: 300, onScroll: admit, onSettle: settle})

    pages.set(groups.map(() => []))
    states.set(groups.map(() => ({status: "idle"})))
    groups.forEach(startGroup)
    unsubscribers.push(scroller.stop)
  }

  const stop = () => {
    stopped = true
    unsubscribers.forEach(call)
  }

  return {candidates, items, entries, loading, exhausted, start, stop}
}

// Reactions

export const publishReaction = (event: TrustedEvent, {content, tags}: EventContent) =>
  reactions
    .get()
    .react(event, content, writer => writer.addTags(...tags))
    .then(publish)

export const retractReaction = (reaction: TrustedEvent) =>
  deletes.get().deleteEvent(reaction).then(publish)

// Muting

export const isEventMuted = withGetter(
  derived([user, userMuteList], ([$user, $muteList]) => {
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

export const derivePubkeyMuted = (pubkey: string) =>
  derived(userMuteList, $muteList => ($muteList?.pubkeys() ?? []).includes(pubkey))

// Loading: where a note lives, and the stores a page reads it and its conversation from.

export class Notes {
  constructor(private readonly app: IApp) {}

  relays = (ref: IEventRef) =>
    this.app.use(Router).resolver.relays(new EventRef(ref).getRelaySelections())

  load = async (ref: IEventRef) => {
    const eventRef = new EventRef(ref)
    const idOrAddress = eventRef.getIdOrAddress()

    if (idOrAddress) {
      return (
        this.app.repository.getEvent(idOrAddress) ??
        first(
          await this.app.use(Network).load({
            relays: await this.relays(ref),
            filters: eventRef.getFilters(),
            timeout: 3000,
          }),
        )
      )
    }
  }

  // A pointer carrying no hints would never resolve, so the load beside it asks the author's relays.
  deriveEvent = (ref: IEventRef) => {
    const idOrAddress = new EventRef(ref).getIdOrAddress()

    this.load(ref)

    return idOrAddress
      ? this.app.use(Events).one(idOrAddress, ref.relays ?? []).$
      : readable<Maybe<TrustedEvent>>(undefined)
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
