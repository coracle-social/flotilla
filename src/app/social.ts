import * as nip19 from "nostr-tools/nip19"
import {derived, readable} from "svelte/store"
import {
  first,
  noop,
  pushToMapKey,
  removeUndefined,
  shuffle,
  sortBy,
  tryCatch,
  uniq,
  uniqBy,
} from "@welshman/lib"
import type {Maybe} from "@welshman/lib"
import {
  COMMENT,
  NOTE,
  addressTags,
  eventOutbox,
  fromNostrURI,
  getAddress,
  getCommentFiltersForRoot,
  getIdAndAddress,
  getIdFilters,
  hexTags,
  relays as relaySelections,
  seen,
  tagSpec,
  tagValues,
  topicTags,
} from "@welshman/util"
import type {EventRef, TrustedEvent} from "@welshman/util"
import {withGetter} from "@welshman/store"
import {displayPubkey, getCommentTagValues, getReplyTagValues, getReplyTags} from "@welshman/domain"
import {Events, FollowLists, MuteLists, Network, Profiles, Router} from "@welshman/app"
import type {IApp} from "@welshman/app"
import {deriveUserItem, fromApp, profiles, user, usePlugin} from "@app/core"
import {DEFAULT_PUBKEYS} from "@app/env"

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

export const bootstrapPubkeys = derived(deriveUserItem(FollowLists), $userFollowList => {
  const appPubkeys = DEFAULT_PUBKEYS.split(",")
  const userPubkeys = shuffle($userFollowList?.pubkeys() ?? [])

  return userPubkeys.length > 5 ? userPubkeys : [...userPubkeys, ...appPubkeys]
})

// Pointers
//
// How a note is named before it has been loaded: an id, and whatever hints came with it.

export type NotePointer = EventRef & {id: string}

export const decodeNotePointer = (entity: string): Maybe<NotePointer> => {
  const decoded = tryCatch(() => nip19.decode(fromNostrURI(entity)))

  if (decoded?.type === "nevent") {
    return {id: decoded.data.id, relays: decoded.data.relays, pubkey: decoded.data.author}
  }

  if (decoded?.type === "note") {
    return {id: decoded.data}
  }
}

// Structure
//
// The shape of a conversation, read off tags alone. Nothing here loads anything.

// Ids and addresses of an event's immediate parents, falling back to its thread roots.
export const getParents = ({kind, tags}: TrustedEvent) => {
  const {roots, replies} = kind === COMMENT ? getCommentTagValues(tags) : getReplyTagValues(tags)

  return replies.length > 0 ? replies : roots
}

// A reply names the note it answers with an `e` tag; a deeper one names the thread root as well.
// Asking by root is what finds the replies more than one level down.
export const getThreadFilters = (event: TrustedEvent) => {
  const roots = tagValues(hexTags("e"), getReplyTags(event.tags).roots)

  return [...getCommentFiltersForRoot([event]), {kinds: [NOTE], "#e": uniq([event.id, ...roots])}]
}

// Everything hanging off a note, however deep. A reply names only the event directly above it, so
// the set grows a generation at a time out of whatever has been loaded.
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

  // A comment names its parent by id, and by address too when the parent is addressable, so
  // index it under every value it gives and dedupe on the way back out.
  for (const comment of comments) {
    for (const parent of getParents(comment)) {
      pushToMapKey(byParent, parent, comment)
    }
  }

  // Nothing stops a comment from naming several parents, which would let the tree cycle, so
  // walk down from the root and keep each comment at the first place it turns up.
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

  // A comment can name a parent we don't have — a superseded version of an addressable root,
  // or a parent that failed to load — so adopt whatever's left rather than dropping it.
  // `comments` is oldest first, so a parent is always adopted before its own children.
  for (const comment of comments) {
    if (!seenIds.has(comment.id)) {
      seenIds.add(comment.id)
      nodes.push({comment, children: build(comment)})
    }
  }

  return sortBy(node => node.comment.created_at, nodes)
}

// Muting

export const isEventMuted = withGetter(
  derived([user, deriveUserItem(MuteLists)], ([$user, $muteList]) => {
    const tags = $muteList?.tags() ?? []
    const mutedEvents = new Set(tagValues(hexTags("e"), tags))
    const mutedPubkeys = new Set(tagValues(hexTags("p"), tags))
    const mutedAddresses = new Set(tagValues(addressTags("a"), tags))
    const mutedTopics = new Set(tagValues(topicTags("t"), tags))
    const mutedWords = tagValues(tagSpec("word"), tags)
    const regex =
      mutedWords.length > 0
        ? new RegExp(`\\b(${mutedWords.map(w => w.toLowerCase().trim()).join("|")})\\b`)
        : undefined

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
        if (profile?.nip05()?.match(regex)) {
          return true
        }
      }

      return false
    }
  }),
)

// Loading
//
// The only part that goes to the network: where a note lives, and the stores a page reads it
// and its conversation from.

export class Notes {
  constructor(private readonly app: IApp) {}

  // Where a note and the conversation around it live: the hints it arrived with, the relays it
  // has been seen on, and its author's outbox.
  relays = (ref: EventRef) =>
    this.app
      .use(Router)
      .resolver.relays([...relaySelections(ref.relays ?? []), seen(ref), eventOutbox(ref)])

  load = async (pointer: NotePointer) =>
    this.app.repository.getEvent(pointer.id) ??
    first(
      await this.app
        .use(Network)
        .loadComplete({relays: await this.relays(pointer), filters: getIdFilters([pointer.id])}),
    )

  // The note itself. Its hints are asked by the derived store and its author's relays by the
  // load beside it, since a pointer carrying no hints would otherwise never resolve.
  deriveEvent = (pointer: NotePointer) => {
    this.load(pointer)

    return this.app.use(Events).one(pointer.id, pointer.relays ?? []).$
  }

  // The conversation below a note. The filters reach past its direct replies to catch deeper
  // ones, which brings back events belonging to other threads, so the tree is built from what
  // actually hangs off the note.
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
