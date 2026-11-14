import {derived, readable} from "svelte/store"
import type {Readable} from "svelte/store"
import {ms} from "@welshman/lib"
import {EventRef} from "@welshman/util"
import type {TrustedEvent} from "@welshman/util"
import {combinePagers} from "@lib/pager"
import type {Pager} from "@lib/pager"
import type {AuthorFeed} from "@app/features/feeds"
import type {Engagement} from "@app/features/engagement"
import {
  classifyNote,
  countFacets,
  getEntries,
  getNoteFeedStatus,
  getNoteKey,
  getUnresolved,
  getVisibleGroups,
  groupNotes,
} from "@app/features/social/noteGroups"
import type {
  DrawnEvent,
  FacetCounts,
  NoteEntry,
  NoteFacet,
  NoteFeedStatus,
  NoteGroup,
  NoteTarget,
} from "@app/features/social/noteGroups"
import {makeNoteResolver} from "@app/features/social/noteResolver"
import {getTargetRef} from "@app/features/social/targets"

export type NoteFeedOptions = {
  notes: AuthorFeed
  interactions?: AuthorFeed
  pinned?: Readable<TrustedEvent[]>
  included?: Readable<NoteFacet[]>
  engagement: Engagement
}

export type NoteFeed = {
  entries: Readable<NoteEntry[]>
  counts: Readable<FacetCounts>
  status: Readable<NoteFeedStatus>
  loading: Readable<boolean>
  older: Pager
  engagement: Engagement
  stop: () => void
}

const sourceIncluded = (included: NoteFacet[], facets: NoteFacet[]) =>
  facets.some(facet => included.includes(facet))

const getInteractionTargets = (events: TrustedEvent[]): NoteTarget[] => {
  const targets: NoteTarget[] = []

  for (const event of events) {
    const ref = getTargetRef(event)

    if (ref) {
      targets.push({ref, facet: "interactions"})
    }
  }

  return targets
}

export const makeNoteFeed = ({
  notes,
  interactions,
  pinned = readable<TrustedEvent[]>([]),
  included = readable<NoteFacet[]>(["notes", "replies", "interactions"]),
  engagement,
}: NoteFeedOptions): NoteFeed => {
  const sourceFacets: NoteFacet[] = interactions
    ? ["notes", "replies", "interactions"]
    : ["notes", "replies"]

  const drawn: Readable<DrawnEvent[]> = derived([pinned, notes.events], ([$pinned, $events]) =>
    [...$pinned, ...$events].map(event => ({event, facet: classifyNote(event)})),
  )

  const targets: Readable<NoteTarget[]> = interactions
    ? derived(interactions.events, ($events): NoteTarget[] => getInteractionTargets($events))
    : readable([])

  // A note the feed can't draw its card without is given up on rather than holding up the feed.
  const resolver = makeNoteResolver({timeout: ms(15), priority: 1})

  const groups: Readable<NoteGroup[]> = derived(
    [drawn, targets, resolver.notes],
    ([$drawn, $targets, $resolved]) => groupNotes($drawn, $targets, $resolved),
  )

  const visible = derived([groups, included], ([$groups, $included]) =>
    getVisibleGroups($groups, $included),
  )

  const counts = derived(groups, ($groups): FacetCounts => countFacets($groups))

  const pinnedKeys = derived(
    pinned,
    $pinned => new Set($pinned.map(event => getNoteKey(EventRef.fromEvent(event)))),
  )

  const entries = derived([visible, included, pinnedKeys], ([$visible, $included, $pinnedKeys]) =>
    getEntries($visible, $included, $pinnedKeys),
  )

  const unresolved = derived([visible, resolver.notes], ([$visible, $resolved]) =>
    getUnresolved($visible, $resolved),
  )

  const unsubscribe = unresolved.subscribe($unresolved => {
    if ($unresolved.length > 0) {
      resolver.resolve($unresolved.map(group => ({ref: group.ref, replies: group.replies})))
    }
  })

  const older = combinePagers(
    derived(included, $included => {
      const pagers: Pager[] = []

      if (sourceIncluded($included, ["notes", "replies"])) {
        pagers.push(notes.older)
      }

      if (interactions && sourceIncluded($included, ["interactions"])) {
        pagers.push(interactions.older)
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
    ([$entries, $groups, $resolved, $loading, $olderStatus, $included]) => {
      const anyIncluded = sourceIncluded($included, sourceFacets)

      return getNoteFeedStatus({
        entries: $entries,
        groups: $groups,
        resolved: $resolved,
        loading: $loading,
        exhausted: $olderStatus === "exhausted" || !anyIncluded,
        anyIncluded,
      })
    },
  )

  const stop = () => {
    resolver.stop()
    unsubscribe()
    notes.stop()
    interactions?.stop()
    engagement.stop()
  }

  return {entries, counts, status, loading, older, engagement, stop}
}
