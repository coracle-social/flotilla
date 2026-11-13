import {derived, get, readable, writable} from "svelte/store"
import type {Readable} from "svelte/store"
import {first, groupBy, min, ms, partition, sortBy, take, uniq, uniqBy} from "@welshman/lib"
import type {Maybe} from "@welshman/lib"
import {EventRef, NOTE, getIdOrAddress} from "@welshman/util"
import type {IEventRef, TrustedEvent} from "@welshman/util"
import {synced} from "@welshman/store"
import {Note} from "@welshman/domain"
import {createScroller} from "@lib/html"
import {reader} from "@app/core/domain"
import {kv} from "@app/core/storage"
import {CONTENT_KINDS} from "@app/features/spaces"
import {getPublishedTimestamp} from "@app/features/spaces/articles"
import {getReplyRefs} from "@app/features/social/replies"
import {notes} from "@app/features/social/notes"
import {makeTimeline} from "@app/features/social/timeline"
import type {Timeline} from "@app/features/social/timeline"

// What the feed can be narrowed to: what the follows wrote, and what they answered elsewhere.
export const networkFeedTypes = [
  {value: "notes", label: "Notes"},
  {value: "replies", label: "Replies"},
  {value: "popular", label: "Popular"},
] as const

export type NetworkFeedType = (typeof networkFeedTypes)[number]["value"]

export const includedNetworkFeedTypes = synced<NetworkFeedType[]>({
  key: "includedNetworkFeedTypes",
  defaultValue: ["notes", "replies"],
  storage: kv,
})

// Only a kind 1 carries NIP-10 reply tags, so an article or a poll in the feed is a note.
const networkFeedType = (event: TrustedEvent): NetworkFeedType =>
  event.kind === NOTE && reader(Note)(event).parent() ? "replies" : "notes"

type NoteSourceBase = {
  events: Readable<TrustedEvent[]>
  loading: Readable<boolean>
  exhausted: Readable<boolean>
  page: () => Promise<unknown>
  settle: () => void
  stop: () => void
}

// A source whose events are drawn as they are.
export type ContentSource = NoteSourceBase & {
  type?: NetworkFeedType
  target?: undefined
}

// A source whose events name a note, which has to be loaded before it can be drawn.
export type ReferenceSource = NoteSourceBase & {
  type: NetworkFeedType
  target: (event: TrustedEvent) => Maybe<EventRef>
}

export type NoteSource = ContentSource | ReferenceSource

export type NotesTimeline = ContentSource & Pick<Timeline, "start">

// The notes a set of follows published, alongside the content kinds their spaces give a page of their own.
export const makeNotesTimeline = ({
  onEvent,
}: {
  onEvent: (event: TrustedEvent) => void
}): NotesTimeline =>
  makeTimeline({
    getFilters: pubkeys => [{kinds: [NOTE, ...CONTENT_KINDS], authors: pubkeys}],
    onEvent,
  })

type FeedCandidate = {
  event: TrustedEvent
  // Every filter the event belongs under, so a note can be both written by a follow and liked by one.
  types: NetworkFeedType[]
}

type FeedTarget = {
  key: string
  ref: EventRef
  type: NetworkFeedType
}

// One card in the feed: the note it is drawn around, and the replies answering it.
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
  entry.note ? getPublishedTimestamp(entry.note) : min(entry.replies.map(reply => reply.created_at))

// A reply collapses into the entry for the note it answers, so two replies to one note share it.
const groupNetworkFeedEvents = (events: TrustedEvent[]): NetworkFeedEntry[] => {
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

// A note an entry can't draw its card without, given up on rather than holding up the feed.
const loadFeedNote = async (ref: IEventRef, signal: AbortSignal, replies: TrustedEvent[] = []) => {
  try {
    return await notes.get().load(ref, {replies, priority: 1, signal, timeout: ms(15)})
  } catch (error) {
    if (!signal.aborted) {
      console.error(error)
    }
  }
}

const allTypes = readable<NetworkFeedType[]>(networkFeedTypes.map(({value}) => value))

// An ordinary source is shown while either of its types is, and one with a type of its own while that is.
const isSourceIncluded = (source: NoteSource, $included: NetworkFeedType[]) =>
  source.type
    ? $included.includes(source.type)
    : $included.includes("notes") || $included.includes("replies")

const isReference = (source: NoteSource): source is ReferenceSource => Boolean(source.target)

export type NoteFeedOptions = {
  sources: NoteSource[]
  pinned?: Readable<TrustedEvent[]>
  included?: Readable<NetworkFeedType[]>
}

/** Notes with each reply drawn under the note it answers, from every source the caller passes. */
export const makeNoteFeed = ({
  sources,
  pinned = readable<TrustedEvent[]>([]),
  included = allTypes,
}: NoteFeedOptions) => {
  const drawable = sources.filter((source): source is ContentSource => !isReference(source))
  const references = sources.filter(isReference)

  // Notes each source draws itself, classified by kind when it doesn't name a type.
  const drawn = derived(
    [...drawable.map(source => source.events), pinned],
    ($events: TrustedEvent[][]) => {
      const $pinned = $events[$events.length - 1]
      const candidates = $pinned.map(
        (event): FeedCandidate => ({event, types: [networkFeedType(event)]}),
      )

      for (const [index, source] of drawable.entries()) {
        for (const event of $events[index]) {
          candidates.push({event, types: [source.type ?? networkFeedType(event)]})
        }
      }

      return candidates
    },
  )

  // What each reference source's events point at, as notes the feed has to load first.
  const targets = writable(new Map<string, Maybe<TrustedEvent>>())

  const refs: Readable<FeedTarget[]> =
    references.length > 0
      ? derived(
          references.map(source => source.events),
          ($events: TrustedEvent[][]) => {
            const targets: FeedTarget[] = []

            for (const [index, source] of references.entries()) {
              for (const event of $events[index]) {
                const ref = source.target(event)
                const key = ref?.getAddressOrId()

                if (ref && key) {
                  targets.push({key, ref, type: source.type})
                }
              }
            }

            return uniqBy(target => target.key, targets)
          },
        )
      : readable([])

  const resolved = derived([refs, targets], ([$refs, $targets]) =>
    $refs.flatMap(({key, type}): FeedCandidate[] => {
      const note = $targets.get(key)

      return note ? [{event: note, types: [type]}] : []
    }),
  )

  // A reference to a note the stream already holds labels it without loading it again.
  const refTypes = derived(refs, $refs => {
    const types = new Map<string, NetworkFeedType[]>()

    for (const {key, type} of $refs) {
      types.set(key, uniq([...(types.get(key) ?? []), type]))
    }

    return types
  })

  const drawnKeys = derived(
    drawn,
    $drawn => new Set($drawn.map(candidate => getIdOrAddress(candidate.event))),
  )

  // One candidate per event, carrying every filter it belongs under.
  const candidates = derived([drawn, resolved, refTypes], ([$drawn, $resolved, $refTypes]) => {
    const candidates = new Map<string, FeedCandidate>()

    for (const candidate of [...$drawn, ...$resolved]) {
      const key = getIdOrAddress(candidate.event)
      const existing = candidates.get(key)

      if (existing) {
        existing.types = uniq([...existing.types, ...candidate.types])
      } else {
        candidates.set(key, {event: candidate.event, types: [...candidate.types]})
      }
    }

    for (const [key, types] of $refTypes) {
      const existing = candidates.get(key)

      if (existing) {
        existing.types = uniq([...existing.types, ...types])
      }
    }

    return Array.from(candidates.values())
  })

  // Each filter counts every note it would show, so a note a follow wrote and liked counts for both.
  const counts = derived(candidates, $candidates => {
    const counts = new Map<NetworkFeedType, number>()

    for (const {types} of $candidates) {
      for (const type of types) {
        counts.set(type, (counts.get(type) ?? 0) + 1)
      }
    }

    return counts
  })

  const items = derived([candidates, included], ([$candidates, $included]) =>
    $candidates
      .filter(candidate => candidate.types.some(type => $included.includes(type)))
      .map(({event}) => event),
  )

  const pinnedKeys = derived(pinned, $pinned => new Set($pinned.map(getIdOrAddress)))

  const grouped = derived([items, pinnedKeys], ([$items, $pinnedKeys]) => {
    const [pinnedEntries, others] = partition(
      entry => $pinnedKeys.has(entry.key),
      groupNetworkFeedEvents($items),
    )

    return [...pinnedEntries, ...others]
  })

  // Entries missing the note they answer are drawn without it and filled in as the note arrives.
  const anchors = writable(new Map<string, Maybe<TrustedEvent>>())

  const missing = derived([grouped, anchors], ([$grouped, $anchors]) =>
    $grouped.filter(entry => !entry.note && !$anchors.has(entry.key)),
  )

  const entries = derived([grouped, anchors], ([$grouped, $anchors]) =>
    $grouped.map(entry => ({
      ...entry,
      // A note the feed carries itself still belongs on its card when the load missed it.
      note: $anchors.get(entry.key) ?? entry.note,
    })),
  )

  // Reference targets whose filter is on, and which the stream doesn't already hold.
  const pendingTargets = derived(
    [refs, targets, included, drawnKeys],
    ([$refs, $targets, $included, $drawnKeys]) =>
      $refs.filter(
        ({key, type}) => $included.includes(type) && !$targets.has(key) && !$drawnKeys.has(key),
      ),
  )

  const sourcesLoading = derived(
    sources.map(source =>
      derived(
        [source.loading, included],
        ([$loading, $included]) => $loading && isSourceIncluded(source, $included),
      ),
    ),
    $loading => $loading.some(Boolean),
  )

  // Pending targets count as loading only while nothing is drawn, so the feed never waits on them.
  const loading = derived(
    [sourcesLoading, pendingTargets, entries],
    ([$loading, $pendingTargets, $entries]) =>
      $loading || ($entries.length === 0 && $pendingTargets.length > 0),
  )

  const exhausted = derived(
    sources.map(source =>
      derived(
        [source.exhausted, included],
        ([$exhausted, $included]) => !isSourceIncluded(source, $included) || $exhausted,
      ),
    ),
    $exhausted => $exhausted.every(Boolean),
  )

  const controller = new AbortController()

  let resolving = false
  let hydrating = false

  // Load what the feed is missing in the background, in small batches, so drawn entries never wait.
  const resolveTargets = async () => {
    if (resolving) {
      return
    }

    resolving = true

    try {
      while (!controller.signal.aborted) {
        const batch = take(10, get(pendingTargets))

        if (batch.length === 0) {
          break
        }

        await Promise.all(
          batch.map(async ({key, ref}) => {
            const note = await loadFeedNote(ref, controller.signal)

            if (!controller.signal.aborted) {
              targets.update($targets => new Map($targets).set(key, note))
            }
          }),
        )
      }
    } finally {
      resolving = false
    }
  }

  const hydrate = async () => {
    if (hydrating) {
      return
    }

    hydrating = true

    try {
      while (!controller.signal.aborted) {
        const batch = take(10, get(missing))

        if (batch.length === 0) {
          break
        }

        await Promise.all(
          batch.map(async entry => {
            const note = await loadFeedNote(entry.ref, controller.signal, entry.replies)

            if (!controller.signal.aborted) {
              anchors.update($anchors => new Map($anchors).set(entry.key, note))
            }
          }),
        )
      }
    } finally {
      hydrating = false
    }
  }

  const unsubscribers = [
    pendingTargets.subscribe($pending => {
      if ($pending.length > 0) {
        resolveTargets()
      }
    }),
    missing.subscribe($missing => {
      if ($missing.length > 0) {
        hydrate()
      }
    }),
  ]

  let scroller: ReturnType<typeof createScroller> | undefined

  const start = (element: HTMLElement) => {
    scroller = createScroller({
      element,
      delay: 300,
      onScroll: () => {
        for (const source of sources) {
          if (isSourceIncluded(source, get(included))) {
            source.page()
          }
        }
      },
      onSettle: () => sources.forEach(source => source.settle()),
    })
  }

  const stop = () => {
    controller.abort()
    scroller?.stop()
    unsubscribers.forEach(unsubscribe => unsubscribe())
    sources.forEach(source => source.stop())
  }

  return {counts, items, entries, loading, exhausted, start, stop}
}
