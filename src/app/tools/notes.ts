import {derived, get, readable, writable} from "svelte/store"
import {Note} from "@welshman/domain"
import {first, pushToMapKey, removeUndefined, sortBy, spec, uniq, uniqBy} from "@welshman/lib"
import type {Maybe} from "@welshman/lib"
import {
  EventRef,
  NOTE,
  getCommentFiltersForRoot,
  getIdAndAddress,
  getIdFilters,
  hexTags,
  outbox,
  tagValues,
} from "@welshman/util"
import type {Filter, IEventRef, TrustedEvent} from "@welshman/util"
import {app} from "@app/core/app"
import {reader} from "@app/core/domain"
import {events, network, router} from "@app/core/plugins"
import {getTargetKeys, getThreadRefs} from "@app/tools/targets"

// A note to load, with the replies whose p tags name its author when its ref doesn't.
type NoteRequest = {ref: EventRef; replies?: TrustedEvent[]}

type LoadOptions = {priority?: number; signal?: AbortSignal; timeout?: number}

// A reply's e tag can name neither author nor relay, but NIP-10 has the reply p-tag the author.
const getNoteRelays = (ref: IEventRef, replies: TrustedEvent[] = []) =>
  router
    .get()
    .resolver.relays([
      ...new EventRef(ref).getRelaySelections(),
      ...replies.flatMap(reply => tagValues(hexTags("p"), reply.tags)).map(outbox),
    ])

/** One note, the very version its ref names, from the repository or else from the relays it lives on. */
export const loadNote = async (
  ref: IEventRef,
  {replies = [], timeout = 3000, ...options}: LoadOptions & {replies?: TrustedEvent[]} = {},
) => {
  const eventRef = new EventRef(ref)
  const idOrAddress = eventRef.getIdOrAddress()

  if (idOrAddress) {
    const event = await app.get().repository.getEvent(idOrAddress)

    if (event) {
      return event
    }

    const relays = await getNoteRelays(ref, replies)
    const loaded = await network
      .get()
      .load({relays, filters: eventRef.getFilters(), timeout, ...options})

    return first(loaded)
  }
}

// Many notes at once, filed by id and address, with relays asked only for what the repository lacks.
const loadNotes = async (requests: NoteRequest[], {timeout = 3000, ...options}: LoadOptions) => {
  const notes = new Map<string, TrustedEvent>()

  const file = (event: TrustedEvent) => {
    for (const key of getIdAndAddress(event)) {
      notes.set(key, event)
    }
  }

  const keys = uniq(removeUndefined(requests.map(({ref}) => ref.getAddressOrId())))

  if (keys.length > 0) {
    for (const event of await app.get().repository.query(getIdFilters(keys))) {
      file(event)
    }

    const missing = requests.filter(({ref}) => !notes.has(ref.getAddressOrId() ?? ""))

    if (missing.length > 0) {
      const selections = await Promise.all(
        missing.map(({ref, replies}) => getNoteRelays(ref, replies)),
      )
      const filters = getIdFilters(removeUndefined(missing.map(({ref}) => ref.getAddressOrId())))
      const loaded = await network
        .get()
        .load({relays: uniq(selections.flat()), filters, timeout, ...options})

      for (const event of loaded) {
        file(event)
      }
    }
  }

  return notes
}

/** Loads notes in the background, a batch at a time, and files one it gives up on as `undefined` in `notes`. */
export const makeNoteResolver = ({
  batchSize = 10,
  maxAttempts = 1,
  ...options
}: LoadOptions & {batchSize?: number; maxAttempts?: number} = {}) => {
  const notes = writable(new Map<string, Maybe<TrustedEvent>>())
  const waiting: NoteRequest[] = []
  const asked = new Set<string>()
  const misses = new Map<string, number>()
  const controller = new AbortController()
  let draining = false

  // Files what a batch found, and gives up on a missing note once it has used its attempts.
  const load = async (batch: NoteRequest[]) => {
    const found = await loadNotes(batch, {...options, signal: controller.signal}).catch(error => {
      if (!controller.signal.aborted) {
        console.error(error)
      }

      return new Map<string, TrustedEvent>()
    })

    notes.update($notes => {
      const next = new Map($notes)

      for (const key of removeUndefined(batch.map(({ref}) => ref.getAddressOrId()))) {
        const note = found.get(key)

        asked.delete(key)

        if (note) {
          next.set(key, note)
        } else {
          const count = (misses.get(key) ?? 0) + 1

          misses.set(key, count)

          if (count >= maxAttempts) {
            next.set(key, undefined)
          }
        }
      }

      return next
    })
  }

  // One drain at a time, so each batch fills with whatever was asked for while the last one loaded.
  const drain = async () => {
    draining = true

    try {
      while (waiting.length > 0 && !controller.signal.aborted) {
        await load(waiting.splice(0, batchSize))
      }
    } finally {
      draining = false
    }
  }

  // A note already settled or on its way is skipped, so asking again only retries a miss.
  const resolve = (requests: NoteRequest[]) => {
    const settled = get(notes)

    for (const request of requests) {
      const key = request.ref.getAddressOrId()

      if (key && !settled.has(key) && !asked.has(key)) {
        asked.add(key)
        waiting.push(request)
      }
    }

    if (!draining) {
      drain()
    }
  }

  return {notes, resolve, stop: () => controller.abort()}
}

export type NoteResolver = ReturnType<typeof makeNoteResolver>

/** A store of the note a ref names, read live from the repository and loaded if missing. */
export const deriveNote = (ref: IEventRef) => {
  const idOrAddress = new EventRef(ref).getIdOrAddress()
  const loaded = writable<Maybe<TrustedEvent>>(undefined)

  // A pointer with no hints would never resolve, so the load beside it asks the author's relays.
  loadNote(ref)
    .then(event => loaded.set(event))
    .catch(error => console.error(error))

  if (idOrAddress) {
    // The observe drops what a plain read still serves, so the load's answer stands in behind it.
    return derived(
      [events.get().one(idOrAddress, ref.relays ?? []).$, loaded],
      ([$event, $loaded]: Maybe<TrustedEvent>[]) => $event ?? $loaded,
    )
  }

  return loaded
}

/** Walks up the thread above a reply, reporting its root and each parent as they arrive. */
export const loadThread = async (
  event: TrustedEvent,
  onLoad: (thread: {threadRoot?: TrustedEvent; parents: TrustedEvent[]}) => void,
) => {
  const parents: TrustedEvent[] = []
  let threadRoot: TrustedEvent | undefined

  const report = () => onLoad({threadRoot, parents: [...parents]})

  // A reply names only the event it answers, so the thread is walked up one hop at a time.
  const walk = async (child: TrustedEvent) => {
    const {parent} = getThreadRefs(child)

    if (parent) {
      const ancestor = await loadNote(parent, {replies: [child]})

      if (ancestor && !parents.some(spec({id: ancestor.id}))) {
        parents.unshift(ancestor)
        report()

        await walk(ancestor)
      }
    }
  }

  const loadRoot = async (root: EventRef) => {
    threadRoot = await loadNote(root, {replies: [event]})
    report()
  }

  const {parent, root} = getThreadRefs(event)

  if (root && root.getIdOrAddress() !== parent?.getIdOrAddress()) {
    await Promise.all([walk(event), loadRoot(root)])
  } else {
    await walk(event)
  }
}

// What hangs off a note, past its direct replies: comments on it and replies anywhere in its thread.
const getReplyFilters = (event: TrustedEvent): Filter[] => {
  const rootId = event.kind === NOTE ? reader(Note)(event).root()?.id : undefined

  return [
    ...getCommentFiltersForRoot([event]),
    {kinds: [NOTE], "#e": uniq(removeUndefined([event.id, rootId]))},
  ]
}

// The events that answer the root, directly or through each other.
const getDescendants = (root: TrustedEvent, events: TrustedEvent[]) => {
  const keys = new Set(getIdAndAddress(root))
  const descendants: TrustedEvent[] = []

  let added = true

  while (added) {
    added = false

    for (const event of events) {
      if (!keys.has(event.id) && getTargetKeys(event).some(key => keys.has(key))) {
        descendants.push(event)

        for (const key of getIdAndAddress(event)) {
          keys.add(key)
        }

        added = true
      }
    }
  }

  return descendants
}

export type CommentNode = {comment: TrustedEvent; children: CommentNode[]}

export const buildCommentTree = (root: TrustedEvent, comments: TrustedEvent[]): CommentNode[] => {
  const commentsByKey = new Map<string, TrustedEvent[]>()

  for (const comment of comments) {
    for (const key of getTargetKeys(comment)) {
      pushToMapKey(commentsByKey, key, comment)
    }
  }

  // Nothing stops a comment naming several parents, which would let the tree cycle.
  const placed = new Set<string>()

  // Siblings are claimed before any of them is descended into, so a comment stays with its shallowest parent.
  const build = (parent: TrustedEvent): CommentNode[] => {
    const replies = getIdAndAddress(parent).flatMap(key => commentsByKey.get(key) ?? [])
    const children = uniqBy(comment => comment.id, replies).filter(
      comment => !placed.has(comment.id),
    )

    for (const child of children) {
      placed.add(child.id)
    }

    return children.map(comment => ({comment, children: build(comment)}))
  }

  const nodes = build(root)

  for (const comment of comments) {
    if (!placed.has(comment.id)) {
      placed.add(comment.id)
      nodes.push({comment, children: build(comment)})
    }
  }

  return sortBy(node => node.comment.created_at, nodes)
}

/** A store of the comment tree under a note, kept current as replies arrive from its relays. */
export const deriveReplies = (event: TrustedEvent) =>
  readable<CommentNode[]>([], set => {
    const filters = getReplyFilters(event)
    const controller = new AbortController()

    getNoteRelays(event)
      .then(relays => network.get().request({relays, filters, signal: controller.signal}))
      .catch(error => console.error(error))

    const unsubscribe = events
      .get()
      .asc(filters)
      .$.subscribe($events => set(buildCommentTree(event, getDescendants(event, $events))))

    return () => {
      controller.abort()
      unsubscribe()
    }
  })
