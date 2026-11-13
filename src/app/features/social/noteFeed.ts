import {derived, get, readable, writable} from "svelte/store"
import type {Readable} from "svelte/store"
import {ms, partition, sortBy, take, uniq} from "@welshman/lib"
import type {Maybe} from "@welshman/lib"
import {EventRef, sortEventsDesc} from "@welshman/util"
import type {IEventRef, TrustedEvent} from "@welshman/util"
import {synced} from "@welshman/store"
import {createScroller} from "@lib/html"
import {kv} from "@app/core/storage"
import {getPublishedTimestamp} from "@app/features/spaces/articles"
import {classifyNote, getNoteAnswer} from "@app/features/social/noteSources"
import type {
  ContentSource,
  NoteFacet,
  NoteSource,
  ReferenceSource,
} from "@app/features/social/noteSources"
import {notes} from "@app/features/social/notes"

// What the feed can be narrowed to: what the follows wrote, and what they answered elsewhere.
export const noteFacets = [
  {value: "notes", label: "Notes"},
  {value: "replies", label: "Replies"},
  {value: "engaged", label: "Interactions"},
] as const

// The key outlives the facet's name, so a session that stored popular comes back as engaged.
const readIncludedNoteFacets = async (key: string): Promise<Maybe<NoteFacet[]>> => {
  const stored = await kv.get<unknown[]>(key)

  if (Array.isArray(stored)) {
    return stored
      .map(value => (value === "popular" ? "engaged" : value))
      .filter((value): value is NoteFacet => noteFacets.some(facet => facet.value === value))
  }
}

export const includedNoteFacets = synced<NoteFacet[]>({
  key: "includedNetworkFeedTypes",
  defaultValue: ["notes", "replies"],
  storage: {get: readIncludedNoteFacets, set: kv.set},
})

export type FeedCounts = Map<NoteFacet, number>

export type NoteFeedStatus = "loading" | "ready" | "empty" | "filtered"

// One card in the feed: the note it is drawn around, and the replies answering it.
export type NoteEntry = {
  key: string
  ref: EventRef
  note: TrustedEvent
  replies: TrustedEvent[]
}

// A card waiting on its note: what the feed would draw, and how much hangs off it.
export type PendingNote = {
  key: string
  ref: EventRef
  replies: number
}

export type NoteFeed = {
  counts: Readable<FeedCounts>
  noteCount: Readable<number>
  entries: Readable<NoteEntry[]>
  pending: Readable<PendingNote[]>
  loading: Readable<boolean>
  exhausted: Readable<boolean>
  status: Readable<NoteFeedStatus>
  start: (element: HTMLElement) => void
  stop: () => void
}

// An event and the note its card is drawn around, as a source named it.
type NoteCandidate = {
  key: string
  ref: EventRef
  facets: NoteFacet[]
  event: TrustedEvent
}

// What a source's events point at, as a note the feed has to load first.
type NoteTarget = {
  key: string
  ref: EventRef
  facets: NoteFacet[]
}

// Everything the feed knows about one note: what it belongs under, the note, and what answers it.
type NoteGroup = {
  key: string
  ref: EventRef
  facets: NoteFacet[]
  note?: TrustedEvent
  replies: TrustedEvent[]
}

// What a feed event is drawn under: the note a reply answers, or the event itself.
const getEntryRef = (event: TrustedEvent) => getNoteAnswer(event) ?? EventRef.fromEvent(event)

// An addressable note is keyed by its address, so a reply naming only its latest version lands on it.
const getNoteKey = (ref: IEventRef) => new EventRef(ref).getAddressOrId()

// A note an entry can't draw its card without, given up on rather than holding up the feed.
const loadFeedNote = async (ref: IEventRef, signal: AbortSignal, replies: TrustedEvent[]) => {
  try {
    return await notes.get().load(ref, {replies, priority: 1, signal, timeout: ms(15)})
  } catch (error) {
    if (!signal.aborted) {
      console.error(error)
    }
  }
}

const allFacets = readable<NoteFacet[]>(noteFacets.map(({value}) => value))

const isReference = (source: NoteSource): source is ReferenceSource => Boolean(source.target)

const isSourceIncluded = (source: NoteSource, $included: NoteFacet[]) =>
  source.produces.some(facet => $included.includes(facet))

export type NoteFeedOptions = {
  sources: NoteSource[]
  pinned?: Readable<TrustedEvent[]>
  included?: Readable<NoteFacet[]>
}

/** Notes with each reply drawn under the note it answers, from every source the caller passes. */
export const makeNoteFeed = ({
  sources,
  pinned = readable<TrustedEvent[]>([]),
  included = allFacets,
}: NoteFeedOptions): NoteFeed => {
  const contentSources = sources.filter((source): source is ContentSource => !isReference(source))
  const referenceSources = sources.filter(isReference)

  // The events each source draws itself, classified into the facet it belongs under.
  const drawn = derived(
    [pinned, ...contentSources.map(source => source.events)],
    ($pages: TrustedEvent[][]) => {
      const [$pinned, ...$sources] = $pages
      const candidates = new Map<string, NoteCandidate>()

      const add = (event: TrustedEvent, facets: NoteFacet[]) => {
        const existing = candidates.get(event.id)

        if (existing) {
          existing.facets = uniq([...existing.facets, ...facets])
          return
        }

        const ref = getEntryRef(event)
        const key = getNoteKey(ref)

        if (key) {
          candidates.set(event.id, {key, ref, facets: [...facets], event})
        }
      }

      $pinned.forEach(event => add(event, [classifyNote(event)]))

      for (const [index, source] of contentSources.entries()) {
        $sources[index].forEach(event => add(event, [source.classify(event)]))
      }

      return Array.from(candidates.values())
    },
  )

  // What each reference source's events point at, as notes the feed has to load first.
  const referenced: Readable<NoteTarget[]> =
    referenceSources.length > 0
      ? derived(
          referenceSources.map(source => source.events),
          ($pages: TrustedEvent[][]) => {
            const targets: NoteTarget[] = []

            for (const [index, source] of referenceSources.entries()) {
              for (const event of $pages[index]) {
                const ref = source.target(event)
                const key = ref && getNoteKey(ref)

                if (ref && key) {
                  targets.push({key, ref, facets: [...source.produces]})
                }
              }
            }

            return targets
          },
        )
      : readable([])

  // Candidates as their sources named them, one per note a reference or an answer points at.
  const candidates = derived([drawn, referenced], ([$drawn, $referenced]) => {
    const groups = new Map<string, NoteGroup>()

    const getGroup = (key: string, ref: EventRef, facets: NoteFacet[]) => {
      const group = groups.get(key) ?? {key, ref, facets: [], replies: []}

      group.ref = EventRef.merge(group.ref, ref)
      group.facets = uniq([...group.facets, ...facets])

      groups.set(key, group)

      return group
    }

    for (const {key, ref, facets, event} of $drawn) {
      const group = getGroup(key, ref, facets)

      if (getNoteAnswer(event)) {
        group.replies.push(event)
      } else if (!group.note) {
        group.note = event
      }
    }

    for (const {key, ref, facets} of $referenced) {
      getGroup(key, ref, facets)
    }

    return Array.from(groups.values())
  })

  // Notes the feed asked for, by the key it asked under, so a miss is not asked for twice.
  const resolved = writable(new Map<string, Maybe<TrustedEvent>>())

  // Candidates that name one note by different keys are one card once the note tells them apart.
  const groups = derived([candidates, resolved], ([$candidates, $resolved]) => {
    const groups = new Map<string, NoteGroup>()

    for (const group of $candidates) {
      const note = group.note ?? $resolved.get(group.key)
      const key = note ? (getNoteKey(EventRef.fromEvent(note)) ?? group.key) : group.key
      const existing = groups.get(key)

      if (existing) {
        existing.ref = EventRef.merge(existing.ref, group.ref)
        existing.facets = uniq([...existing.facets, ...group.facets])
        existing.note = existing.note ?? note
        existing.replies.push(...group.replies)
      } else {
        groups.set(key, {...group, key, note, replies: [...group.replies]})
      }
    }

    return Array.from(groups.values())
  })

  // Each facet counts every distinct note it would show, so a note a follow wrote and liked counts for both.
  const counts: Readable<FeedCounts> = derived(groups, $groups => {
    const counts: FeedCounts = new Map()

    for (const {facets} of $groups) {
      for (const facet of facets) {
        counts.set(facet, (counts.get(facet) ?? 0) + 1)
      }
    }

    return counts
  })

  const noteCount = derived(groups, $groups => $groups.length)

  const visible = derived([groups, included], ([$groups, $included]) =>
    $groups.filter(group => group.facets.some(facet => $included.includes(facet))),
  )

  const pinnedKeys = derived(
    pinned,
    $pinned => new Set($pinned.map(event => getNoteKey(EventRef.fromEvent(event)))),
  )

  const entries = derived([visible, pinnedKeys, included], ([$visible, $pinnedKeys, $included]) => {
    // Any facet lets a card in, but the replies drawn under it are the replies facet's alone.
    const showReplies = $included.includes("replies")

    const entries = sortBy(
      entry => -getPublishedTimestamp(entry.note),
      $visible.flatMap(({key, ref, note, replies}): NoteEntry[] =>
        note ? [{key, ref, note, replies: showReplies ? sortEventsDesc(replies) : []}] : [],
      ),
    )

    const [pinnedEntries, others] = partition(entry => $pinnedKeys.has(entry.key), entries)

    return [...pinnedEntries, ...others]
  })

  // A group whose note is not in hand yet: what the feed has to load, and how much waits on it.
  const unloadedNotes = derived([visible, resolved], ([$visible, $resolved]) =>
    $visible.filter(group => !group.note && !$resolved.has(group.key)),
  )

  const pending = derived(unloadedNotes, $unloaded =>
    $unloaded.map(({key, ref, replies}) => ({key, ref, replies: replies.length})),
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

  // A note still on its way holds the feed only while nothing is drawn, so the feed never waits on one.
  const loading = derived(
    [sourcesLoading, pending, entries],
    ([$loading, $pending, $entries]) => $loading || ($entries.length === 0 && $pending.length > 0),
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

  const status: Readable<NoteFeedStatus> = derived(
    [entries, loading, exhausted, groups, resolved, included],
    ([$entries, $loading, $exhausted, $groups, $resolved, $included]) => {
      if ($entries.length > 0) {
        return "ready"
      }

      // With every facet the sources produce turned off, the feed is filtered before anything arrives.
      if (!sources.some(source => isSourceIncluded(source, $included))) {
        return "filtered"
      }

      if ($loading || !$exhausted) {
        return "loading"
      }

      // A note that failed to load can't be drawn whatever the facets say, so it isn't one they hide.
      const hidden = $groups.some(group => group.note || !$resolved.has(group.key))

      return hidden ? "filtered" : "empty"
    },
  )

  const controller = new AbortController()

  let resolving = false

  // Load what the feed is missing in the background, in small batches, so drawn entries never wait.
  const resolveNotes = async () => {
    if (resolving) {
      return
    }

    resolving = true

    try {
      while (!controller.signal.aborted) {
        const batch = take(10, get(unloadedNotes))

        if (batch.length === 0) {
          break
        }

        await Promise.all(
          batch.map(async ({key, ref, replies}) => {
            const note = await loadFeedNote(ref, controller.signal, replies)

            if (!controller.signal.aborted) {
              resolved.update($resolved => new Map($resolved).set(key, note))
            }
          }),
        )
      }
    } finally {
      resolving = false
    }
  }

  const unsubscribers = [
    unloadedNotes.subscribe($unloaded => {
      if ($unloaded.length > 0) {
        resolveNotes()
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

  return {counts, noteCount, entries, pending, loading, exhausted, status, start, stop}
}
