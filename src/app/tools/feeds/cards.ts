import {groupBy, uniq} from "@welshman/lib"
import type {Maybe} from "@welshman/lib"
import {EventRef, NOTE, sortEventsDesc} from "@welshman/util"
import type {IEventRef, TrustedEvent} from "@welshman/util"
import {getTargetRef} from "@app/tools/targets"
import type {NoteFacet} from "@app/tools/feeds/facets"

// A card as the feed draws it: a note and the replies under it.
export type NoteEntry = {key: string; note: TrustedEvent; replies: TrustedEvent[]}

// What the feed knows about one note before it can draw it, and which facets put it there.
export type NoteGroup = {
  key: string
  ref: EventRef
  facets: NoteFacet[]
  note?: TrustedEvent
  replies: TrustedEvent[]
}

export type DrawnEvent = {event: TrustedEvent; facet: NoteFacet}

// An addressable note is keyed by its address, so a reply naming only its latest version lands on it.
export const getNoteKey = (ref: IEventRef): string => new EventRef(ref).getAddressOrId() ?? ""

export const getNoteParentRef = (event: TrustedEvent): Maybe<EventRef> => {
  if (event.kind === NOTE) {
    return getTargetRef(event)
  }
}

// A reply is a candidate for the note it replies to, and anything else for itself.
const fromDrawn = (event: TrustedEvent, facets: NoteFacet[]): NoteGroup => {
  const parent = getNoteParentRef(event)
  const ref = parent ?? EventRef.fromEvent(event)

  if (parent) {
    return {key: getNoteKey(ref), ref, facets, replies: [event]}
  }

  return {key: getNoteKey(ref), ref, facets, note: event, replies: []}
}

const fromTarget = (ref: EventRef): NoteGroup => ({
  key: getNoteKey(ref),
  ref,
  facets: ["interactions"],
  replies: [],
})

// Groups with one key are one card, keeping the first note and every reply.
const mergeGroups = (groups: NoteGroup[]): NoteGroup[] =>
  Array.from(groupBy(group => group.key, groups).values(), sameKey => ({
    key: sameKey[0].key,
    ref: sameKey.reduce(
      (ref, group) => EventRef.merge(ref, group.ref),
      new EventRef(sameKey[0].ref),
    ),
    facets: uniq(sameKey.flatMap(group => group.facets)),
    note: sameKey.find(group => group.note)?.note,
    replies: sameKey.flatMap(group => group.replies),
  }))

// One event drawn by several facets is one candidate with all of them.
const dedupeDrawn = (drawn: DrawnEvent[]) =>
  Array.from(groupBy(({event}) => event.id, drawn).values(), sameEvent =>
    fromDrawn(sameEvent[0].event, uniq(sameEvent.map(({facet}) => facet))),
  )

export const groupByCandidate = (drawn: DrawnEvent[], targets: EventRef[]): NoteGroup[] =>
  mergeGroups([...dedupeDrawn(drawn), ...targets.map(fromTarget)].filter(group => group.key))

// Candidates that name one note by different keys are one card once the note tells them apart.
export const groupByNote = (
  groups: NoteGroup[],
  resolved: Map<string, Maybe<TrustedEvent>>,
): NoteGroup[] =>
  mergeGroups(
    groups.map(group => {
      const note = group.note ?? resolved.get(group.key)

      if (note) {
        return {...group, key: getNoteKey(EventRef.fromEvent(note)), note}
      }

      return group
    }),
  )

// A card is drawn once its note is here, with the replies under it when the replies facet is included.
export const getEntries = (groups: NoteGroup[], included: NoteFacet[]): NoteEntry[] =>
  groups.flatMap(group => {
    if (group.note) {
      const replies = included.includes("replies") ? sortEventsDesc(group.replies) : []

      return [{key: group.key, note: group.note, replies}]
    }

    return []
  })
