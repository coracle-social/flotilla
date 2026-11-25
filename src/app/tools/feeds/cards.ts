import {derived} from "svelte/store"
import type {Readable} from "svelte/store"
import {addToMapKey, last, removeUndefined, sortBy, spec, uniq} from "@welshman/lib"
import type {Maybe} from "@welshman/lib"
import {EventRef} from "@welshman/util"
import type {IEventRef, TrustedEvent} from "@welshman/util"
import {getTargetRef, isReplyKind} from "@app/tools/targets"
import type {NoteFacet} from "@app/tools/feeds/facets"

// What the feed knows about one note, and which facets put it there.
export type NoteGroup = {
  key: string
  ref: EventRef
  facets: NoteFacet[]
  note?: TrustedEvent
  replies: TrustedEvent[]
}

// A card as the feed draws it: a group whose note is here.
export type NoteEntry = NoteGroup & {note: TrustedEvent}

export const isNoteEntry = (group: NoteGroup): group is NoteEntry => Boolean(group.note)

// An addressable note is keyed by its address, so a reply naming only its latest version lands on it.
export const getNoteKey = (ref: IEventRef): string => new EventRef(ref).getAddressOrId() ?? ""

export const getNoteParentRef = (event: TrustedEvent): Maybe<EventRef> => {
  if (isReplyKind(event)) {
    return getTargetRef(event)
  }
}

// An event under the key of the note it's about: a note under its own, a reply under its parent's, an interaction under its target's.
type Filing = {event: TrustedEvent; key: string; ref: EventRef; facet: NoteFacet}

const fileDrawn = (event: TrustedEvent): Filing => {
  const parent = getNoteParentRef(event)
  const ref = parent ?? EventRef.fromEvent(event)

  return {event, key: getNoteKey(ref), ref, facet: parent ? "replies" : "notes"}
}

const fileInteraction = (event: TrustedEvent): Maybe<Filing> => {
  const ref = getTargetRef(event)

  if (ref) {
    return {event, key: getNoteKey(ref), ref, facet: "interactions"}
  }
}

export type NoteSources = {
  drawn: Readable<TrustedEvent[]>
  interactions: Readable<TrustedEvent[]>
  resolved: Readable<Map<string, Maybe<TrustedEvent>>>
}

// Files each event once as it arrives, so an update rebuilds only the groups whose events or notes changed.
export const groupNotes = ({drawn, interactions, resolved}: NoteSources): Readable<NoteGroup[]> => {
  const filings = new Map<string, Filing>()
  const filingsByKey = new Map<string, Set<Filing>>()
  // A key files under its note's key once the note is known, since a reply may name an addressable note by id.
  const noteKeyByKey = new Map<string, string>()
  const keysByNoteKey = new Map<string, Set<string>>()
  const groups = new Map<string, NoteGroup>()
  let resolvedNotes = new Map<string, Maybe<TrustedEvent>>()

  const getFilings = (key: string) => Array.from(filingsByKey.get(key) ?? [])

  // A note known in several versions shows its newest, whichever arrived first.
  const getNewest = (notes: Maybe<TrustedEvent>[]): Maybe<TrustedEvent> =>
    last(sortBy(note => note.created_at, removeUndefined(notes)))

  const getNote = (key: string) =>
    getNewest([
      ...getFilings(key)
        .filter(spec({facet: "notes"}))
        .map(filing => filing.event),
      resolvedNotes.get(key),
    ])

  const getNoteKeyFor = (key: string) => {
    const note = getNote(key)

    return note ? getNoteKey(EventRef.fromEvent(note)) : key
  }

  const buildGroup = (noteKey: string, keys: string[]): NoteGroup => {
    const filed = keys.flatMap(getFilings)

    return {
      key: noteKey,
      ref: filed.reduce(
        (ref, filing) => EventRef.merge(ref, filing.ref),
        new EventRef(filed[0].ref),
      ),
      facets: uniq(filed.map(filing => filing.facet)),
      note: getNewest(keys.map(getNote)),
      replies: filed.filter(spec({facet: "replies"})).map(filing => filing.event),
    }
  }

  // Files events new to the feed and drops ones that left it, returning the keys they're under.
  const refile = ($drawn: TrustedEvent[], $interactions: TrustedEvent[]) => {
    const present = new Set<string>()
    const touched = new Set<string>()

    const file = (event: TrustedEvent, toFiling: (event: TrustedEvent) => Maybe<Filing>) => {
      present.add(event.id)

      if (!filings.has(event.id)) {
        const filing = toFiling(event)

        if (filing?.key) {
          filings.set(event.id, filing)
          addToMapKey(filingsByKey, filing.key, filing)
          touched.add(filing.key)
        }
      }
    }

    for (const event of $drawn) {
      file(event, fileDrawn)
    }

    for (const event of $interactions) {
      file(event, fileInteraction)
    }

    for (const [id, filing] of filings) {
      if (!present.has(id)) {
        filings.delete(id)
        filingsByKey.get(filing.key)?.delete(filing)
        touched.add(filing.key)
      }
    }

    return touched
  }

  // Moves each touched key under its note's key, and rebuilds the groups it left and joined.
  const regroup = (touched: Set<string>) => {
    const noteKeys = new Set<string>()

    for (const key of touched) {
      const before = noteKeyByKey.get(key)

      if (before) {
        keysByNoteKey.get(before)?.delete(key)
        noteKeys.add(before)
      }

      if (filingsByKey.get(key)?.size) {
        const after = getNoteKeyFor(key)

        noteKeyByKey.set(key, after)
        addToMapKey(keysByNoteKey, after, key)
        noteKeys.add(after)
      } else {
        filingsByKey.delete(key)
        noteKeyByKey.delete(key)
      }
    }

    for (const noteKey of noteKeys) {
      const keys = Array.from(keysByNoteKey.get(noteKey) ?? [])

      if (keys.length > 0) {
        groups.set(noteKey, buildGroup(noteKey, keys))
      } else {
        groups.delete(noteKey)
        keysByNoteKey.delete(noteKey)
      }
    }
  }

  return derived([drawn, interactions, resolved], ([$drawn, $interactions, $resolved]) => {
    const touched = refile($drawn, $interactions)

    for (const key of filingsByKey.keys()) {
      if ($resolved.get(key) !== resolvedNotes.get(key)) {
        touched.add(key)
      }
    }

    resolvedNotes = $resolved
    regroup(touched)

    return Array.from(groups.values())
  })
}
