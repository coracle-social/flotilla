import type {Maybe} from "@welshman/lib"
import {partition, sortBy, uniq} from "@welshman/lib"
import {EventRef, sortEventsDesc} from "@welshman/util"
import type {IEventRef, TrustedEvent} from "@welshman/util"
import {getNoteParentRef} from "@app/features/social/targets"
import {getPublishedTimestamp} from "@app/features/spaces/articles"

export type NoteFacet = "notes" | "replies" | "interactions"

export type FacetCounts = Map<NoteFacet, number>

export type NoteGroup = {
  key: string
  ref: EventRef
  facets: NoteFacet[]
  note?: TrustedEvent
  replies: TrustedEvent[]
}

export type NoteEntry = {key: string; note: TrustedEvent; replies: TrustedEvent[]}

export type NoteFeedStatus = "loading" | "ready" | "empty" | "filtered"

export type DrawnEvent = {event: TrustedEvent; facet: NoteFacet}

export type NoteTarget = {ref: EventRef; facet: NoteFacet}

type NoteFeedState = {
  entries: NoteEntry[]
  groups: NoteGroup[]
  resolved: Map<string, Maybe<TrustedEvent>>
  loading: boolean
  exhausted: boolean
  anyIncluded: boolean
}

type Candidate = {event: TrustedEvent; facets: NoteFacet[]}

// An addressable note is keyed by its address, so a reply naming only its latest version lands on it.
export const getNoteKey = (ref: IEventRef): string => new EventRef(ref).getAddressOrId() ?? ""

export const classifyNote = (event: TrustedEvent): NoteFacet =>
  getNoteParentRef(event) ? "replies" : "notes"

const mergeInto = (
  groups: Map<string, NoteGroup>,
  key: string,
  ref: IEventRef,
  facets: NoteFacet[],
): NoteGroup => {
  const group: NoteGroup = groups.get(key) ?? {key, ref: new EventRef(ref), facets: [], replies: []}

  group.ref = EventRef.merge(group.ref, ref)
  group.facets = uniq([...group.facets, ...facets])
  groups.set(key, group)

  return group
}

const dedupeDrawn = (drawn: DrawnEvent[]): Candidate[] => {
  const candidates = new Map<string, Candidate>()

  for (const {event, facet} of drawn) {
    const existing = candidates.get(event.id)

    if (existing) {
      existing.facets = uniq([...existing.facets, facet])
    } else {
      candidates.set(event.id, {event, facets: [facet]})
    }
  }

  return Array.from(candidates.values())
}

const groupByCandidate = (drawn: DrawnEvent[], targets: NoteTarget[]): NoteGroup[] => {
  const groups = new Map<string, NoteGroup>()

  for (const {event, facets} of dedupeDrawn(drawn)) {
    const parent = getNoteParentRef(event)
    const ref = parent ?? EventRef.fromEvent(event)
    const key = getNoteKey(ref)

    if (key) {
      const group = mergeInto(groups, key, ref, facets)

      if (parent) {
        group.replies = [...group.replies, event]
      } else if (!group.note) {
        group.note = event
      }
    }
  }

  for (const {ref, facet} of targets) {
    const key = getNoteKey(ref)

    if (key) {
      mergeInto(groups, key, ref, [facet])
    }
  }

  return Array.from(groups.values())
}

// Candidates that name one note by different keys are one card once the note tells them apart.
const groupByNote = (
  groups: NoteGroup[],
  resolved: Map<string, Maybe<TrustedEvent>>,
): NoteGroup[] => {
  const rekeyed = new Map<string, NoteGroup>()

  for (const group of groups) {
    const note = group.note ?? resolved.get(group.key)
    const key = note ? getNoteKey(EventRef.fromEvent(note)) : group.key
    const merged = mergeInto(rekeyed, key, group.ref, group.facets)

    merged.note ??= note
    merged.replies = [...merged.replies, ...group.replies]
  }

  return Array.from(rekeyed.values())
}

export const groupNotes = (
  drawn: DrawnEvent[],
  targets: NoteTarget[],
  resolved: Map<string, Maybe<TrustedEvent>>,
): NoteGroup[] => groupByNote(groupByCandidate(drawn, targets), resolved)

// Each facet counts every distinct note it would show, whatever is included.
export const countFacets = (groups: NoteGroup[]): FacetCounts => {
  const counts: FacetCounts = new Map()

  for (const group of groups) {
    for (const facet of group.facets) {
      counts.set(facet, (counts.get(facet) ?? 0) + 1)
    }
  }

  return counts
}

export const getVisibleGroups = (groups: NoteGroup[], included: NoteFacet[]): NoteGroup[] =>
  groups.filter(group => group.facets.some(facet => included.includes(facet)))

export const getEntries = (
  visible: NoteGroup[],
  included: NoteFacet[],
  pinnedKeys: Set<string>,
): NoteEntry[] => {
  const entries: NoteEntry[] = []

  for (const group of visible) {
    if (group.note) {
      // The replies drawn under a card belong to the replies facet alone.
      const replies = included.includes("replies") ? sortEventsDesc(group.replies) : []

      entries.push({key: group.key, note: group.note, replies})
    }
  }

  const sorted = sortBy(entry => -getPublishedTimestamp(entry.note), entries)
  const [pinned, rest] = partition(entry => pinnedKeys.has(entry.key), sorted)

  return [...pinned, ...rest]
}

export const getUnresolved = (
  visible: NoteGroup[],
  resolved: Map<string, Maybe<TrustedEvent>>,
): NoteGroup[] => visible.filter(group => !group.note && !resolved.has(group.key))

export const getNoteFeedStatus = ({
  entries,
  groups,
  resolved,
  loading,
  exhausted,
  anyIncluded,
}: NoteFeedState): NoteFeedStatus => {
  if (entries.length > 0) {
    return "ready"
  }

  if (!anyIncluded) {
    return "filtered"
  }

  if (loading || !exhausted) {
    return "loading"
  }

  // A note that failed to load can't be drawn whatever the facets say, so it isn't one they hide.
  if (groups.some(group => group.note || !resolved.has(group.key))) {
    return "filtered"
  }

  return "empty"
}
