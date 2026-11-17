import {derived, readable} from "svelte/store"
import type {Readable} from "svelte/store"
import {
  countBy,
  groupBy,
  identity,
  ms,
  partition,
  removeUndefined,
  sortBy,
  uniq,
} from "@welshman/lib"
import type {Maybe} from "@welshman/lib"
import {synced} from "@welshman/store"
import {
  EventRef,
  GENERIC_REPOST,
  NOTE,
  REACTION,
  REPOST,
  ZAP_RECEIPT,
  sortEventsDesc,
} from "@welshman/util"
import type {Filter, IEventRef, TrustedEvent} from "@welshman/util"
import {combinePagers} from "@lib/pager"
import type {Pager} from "@lib/pager"
import {ENABLE_ZAPS} from "@app/core/env"
import {kv} from "@app/core/storage"
import {userFollowPubkeys} from "@app/core/user"
import {makeAuthorFeed} from "@app/features/feeds/authorFeed"
import type {AuthorFeed} from "@app/features/feeds/authorFeed"
import {makeInteractions} from "@app/features/interactions/interactions"
import type {Interactions} from "@app/features/interactions/interactions"
import {getTargetRef} from "@app/tools/targets"
import {makeNoteResolver} from "@app/features/notes/resolver"
import {derivePinnedEvents} from "@app/features/pins"
import {getPublishedTimestamp} from "@app/features/spaces/articles"
import {CONTENT_KINDS} from "@app/tools/content"

export type NoteFacet = "notes" | "replies" | "interactions"

export type FacetCounts = Map<NoteFacet, number>

export type NoteEntry = {key: string; note: TrustedEvent; replies: TrustedEvent[]}

export type NoteFeedStatus = "loading" | "ready" | "empty" | "filtered"

export type NoteFeed = {
  entries: Readable<NoteEntry[]>
  counts: Readable<FacetCounts>
  status: Readable<NoteFeedStatus>
  loading: Readable<boolean>
  older: Pager
  interactions: Interactions
  stop: () => void
}

type NoteGroup = {
  key: string
  ref: EventRef
  facets: NoteFacet[]
  note?: TrustedEvent
  replies: TrustedEvent[]
}

type DrawnEvent = {event: TrustedEvent; facet: NoteFacet}

const isNoteFacet = (value: unknown): value is NoteFacet =>
  value === "notes" || value === "replies" || value === "interactions"

// The stored key outlives the facet's old names, so a "popular" or "engaged" comes back as interactions.
const readIncludedNoteFacets = async (key: string): Promise<NoteFacet[] | undefined> => {
  const stored = await kv.get<unknown[]>(key)

  if (Array.isArray(stored)) {
    const migrated = stored.map(value =>
      value === "popular" || value === "engaged" ? "interactions" : value,
    )

    return migrated.filter(isNoteFacet)
  }
}

export const includedNoteFacets = synced<NoteFacet[]>({
  key: "includedNetworkFeedTypes",
  defaultValue: ["notes", "replies"],
  storage: {get: readIncludedNoteFacets, set: kv.set},
})

// An addressable note is keyed by its address, so a reply naming only its latest version lands on it.
const getNoteKey = (ref: IEventRef): string => new EventRef(ref).getAddressOrId() ?? ""

const getNoteParentRef = (event: TrustedEvent): Maybe<EventRef> => {
  if (event.kind === NOTE) {
    return getTargetRef(event)
  }
}

const includesAnyFacet = (included: NoteFacet[], facets: NoteFacet[]): boolean =>
  facets.some(facet => included.includes(facet))

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

const dedupeDrawn = (drawn: DrawnEvent[]) =>
  Array.from(
    groupBy(({event}) => event.id, drawn),
    ([, items]) => ({
      event: items[0].event,
      facets: uniq(items.map(({facet}) => facet)),
    }),
  )

const groupByCandidate = (drawn: DrawnEvent[], targets: EventRef[]): NoteGroup[] => {
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

  for (const ref of targets) {
    const key = getNoteKey(ref)

    if (key) {
      mergeInto(groups, key, ref, ["interactions"])
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

const getEntries = (
  visible: NoteGroup[],
  included: NoteFacet[],
  pinnedKeys: Set<string>,
): NoteEntry[] => {
  const entries = visible.flatMap(group => {
    if (group.note) {
      // The replies drawn under a card belong to the replies facet alone.
      const replies = included.includes("replies") ? sortEventsDesc(group.replies) : []

      return [{key: group.key, note: group.note, replies}]
    }

    return []
  })

  const sorted = sortBy(entry => -getPublishedTimestamp(entry.note), entries)
  const [pinned, rest] = partition(entry => pinnedKeys.has(entry.key), sorted)

  return [...pinned, ...rest]
}

const makeNoteFeed = ({
  noteSource,
  interactionSource,
  pinned = readable<TrustedEvent[]>([]),
  included = readable<NoteFacet[]>(["notes", "replies", "interactions"]),
  interactions,
}: {
  noteSource: AuthorFeed
  interactionSource?: AuthorFeed
  pinned?: Readable<TrustedEvent[]>
  included?: Readable<NoteFacet[]>
  interactions: Interactions
}): NoteFeed => {
  const sourceFacets: NoteFacet[] = interactionSource
    ? ["notes", "replies", "interactions"]
    : ["notes", "replies"]

  const drawn: Readable<DrawnEvent[]> = derived([pinned, noteSource.events], ([$pinned, $events]) =>
    [...$pinned, ...$events].map(
      (event): DrawnEvent => ({event, facet: getNoteParentRef(event) ? "replies" : "notes"}),
    ),
  )

  const targets: Readable<EventRef[]> = interactionSource
    ? derived(interactionSource.events, $events => removeUndefined($events.map(getTargetRef)))
    : readable([])

  // A note the feed can't draw its card without is given up on rather than holding up the feed.
  const resolver = makeNoteResolver({timeout: ms(15), priority: 1})

  const groups: Readable<NoteGroup[]> = derived(
    [drawn, targets, resolver.notes],
    ([$drawn, $targets, $resolved]) => groupByNote(groupByCandidate($drawn, $targets), $resolved),
  )

  const visible = derived([groups, included], ([$groups, $included]) =>
    $groups.filter(group => includesAnyFacet($included, group.facets)),
  )

  // Each facet counts every distinct note it would show, whatever is included.
  const counts = derived(groups, $groups =>
    countBy(
      identity,
      $groups.flatMap(group => group.facets),
    ),
  )

  const pinnedKeys = derived(
    pinned,
    $pinned => new Set($pinned.map(event => getNoteKey(EventRef.fromEvent(event)))),
  )

  const entries = derived([visible, included, pinnedKeys], ([$visible, $included, $pinnedKeys]) =>
    getEntries($visible, $included, $pinnedKeys),
  )

  const unresolved = derived([visible, resolver.notes], ([$visible, $resolved]) =>
    $visible.filter(group => !group.note && !$resolved.has(group.key)),
  )

  const unsubscribe = unresolved.subscribe($unresolved => {
    if ($unresolved.length > 0) {
      resolver.resolve($unresolved.map(group => ({ref: group.ref, replies: group.replies})))
    }
  })

  const older = combinePagers(
    derived(included, $included => {
      const pagers: Pager[] = []

      if (includesAnyFacet($included, ["notes", "replies"])) {
        pagers.push(noteSource.older)
      }

      if (interactionSource && includesAnyFacet($included, ["interactions"])) {
        pagers.push(interactionSource.older)
      }

      return pagers
    }),
  )

  // A note still on its way holds the feed only while nothing is drawn.
  const loading = derived(
    [older.status, entries, unresolved],
    ([$olderStatus, $entries, $unresolved]) =>
      $olderStatus === "loading" || ($entries.length === 0 && $unresolved.length > 0),
  )

  const status = derived(
    [entries, groups, resolver.notes, loading, older.status, included],
    ([$entries, $groups, $resolved, $loading, $olderStatus, $included]): NoteFeedStatus => {
      if ($entries.length > 0) {
        return "ready"
      }

      if (!includesAnyFacet($included, sourceFacets)) {
        return "filtered"
      }

      if ($loading || $olderStatus !== "exhausted") {
        return "loading"
      }

      // A note that failed to load can't be drawn whatever the facets say, so it isn't one they hide.
      if ($groups.some(group => group.note || !$resolved.has(group.key))) {
        return "filtered"
      }

      return "empty"
    },
  )

  const stop = () => {
    resolver.stop()
    unsubscribe()
    noteSource.stop()
    interactionSource?.stop()
    interactions.stop()
  }

  return {entries, counts, status, loading, older, interactions, stop}
}

const makeNoteSource = (
  pubkeys: Readable<string[]>,
  onEvent?: (event: TrustedEvent) => void,
): AuthorFeed =>
  makeAuthorFeed({
    pubkeys,
    onEvent,
    getFilters: authors => [{kinds: [NOTE, ...CONTENT_KINDS], authors}],
  })

export const makeNetworkFeed = (): NoteFeed => {
  const interactions = makeInteractions({withReplies: true})

  const noteSource = makeNoteSource(userFollowPubkeys, interactions.track)

  // Follows' interactions are asked for once their facet is first shown, and stay live after.
  const shown = readable(false, set =>
    includedNoteFacets.subscribe($facets => {
      if ($facets.includes("interactions")) {
        set(true)
      }
    }),
  )

  const interactionSource = makeAuthorFeed({
    pubkeys: derived([userFollowPubkeys, shown], ([$pubkeys, $shown]) => ($shown ? $pubkeys : [])),
    getFilters: authors => {
      const filters: Filter[] = [{kinds: [REACTION, REPOST, GENERIC_REPOST], authors}]

      // A receipt is published by the recipient's wallet, which names the zapper in its P tag.
      if (ENABLE_ZAPS) {
        filters.push({kinds: [ZAP_RECEIPT], "#P": authors})
      }

      return filters
    },
  })

  return makeNoteFeed({noteSource, interactionSource, included: includedNoteFacets, interactions})
}

export const makeProfileFeed = (pubkey: string): NoteFeed => {
  const interactions = makeInteractions({withReplies: true})

  return makeNoteFeed({
    noteSource: makeNoteSource(readable([pubkey]), interactions.track),
    pinned: derivePinnedEvents(pubkey),
    interactions,
  })
}
