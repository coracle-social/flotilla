import {derived, readable} from "svelte/store"
import type {Readable} from "svelte/store"
import {
  HOUR,
  MONTH,
  countBy,
  difference,
  identity,
  int,
  now,
  partition,
  removeUndefined,
  sortBy,
} from "@welshman/lib"
import type {Maybe} from "@welshman/lib"
import {
  EventRef,
  GENERIC_REPOST,
  HIGHLIGHT,
  NOTE,
  REACTION,
  REPOST,
  ZAP_RECEIPT,
} from "@welshman/util"
import type {Filter, TrustedEvent} from "@welshman/util"
import {appendOnly, strictOrder} from "@lib/order"
import {combinePagers} from "@lib/pager"
import type {Pager, PagerStatus} from "@lib/pager"
import {makeCommentFilter} from "@lib/util"
import {app} from "@app/core/app"
import {ENABLE_ZAPS} from "@app/core/env"
import {followLists, roomLists} from "@app/core/plugins"
import {groupAuthors, makeAuthorFeed} from "@app/tools/feeds/author"
import type {AuthorFeed, AuthorGroup} from "@app/tools/feeds/author"
import {
  getEntries,
  getNoteKey,
  getNoteParentRef,
  groupByCandidate,
  groupByNote,
} from "@app/tools/feeds/cards"
import type {DrawnEvent, NoteEntry, NoteGroup} from "@app/tools/feeds/cards"
import {includedNoteFacets, includesAnyFacet, whenIncluded} from "@app/tools/feeds/facets"
import type {FacetCounts, NoteFacet} from "@app/tools/feeds/facets"
import {getTargetRef} from "@app/tools/targets"
import {makeNoteResolver} from "@app/tools/notes"
import {derivePinnedEvents} from "@app/tools/people/pins"
import {CONTENT_KINDS, getPublishedTimestamp} from "@app/tools/content"

export type NoteFeedStatus = "loading" | "ready" | "empty" | "filtered"

export type NoteFeed = {
  entries: Readable<NoteEntry[]>
  counts: Readable<FacetCounts>
  status: Readable<NoteFeedStatus>
  loading: Readable<boolean>
  older: Pager
  stop: () => void
}

type StatusInputs = {
  entries: NoteEntry[]
  groups: NoteGroup[]
  resolved: Map<string, Maybe<TrustedEvent>>
  loading: boolean
  olderStatus: PagerStatus
  included: NoteFacet[]
  sourceFacets: NoteFacet[]
}

const getStatus = ({
  entries,
  groups,
  resolved,
  loading,
  olderStatus,
  included,
  sourceFacets,
}: StatusInputs): NoteFeedStatus => {
  if (entries.length > 0) {
    return "ready"
  }

  if (!includesAnyFacet(included, sourceFacets)) {
    return "filtered"
  }

  if (loading || olderStatus !== "exhausted") {
    return "loading"
  }

  // A note that failed to load can't be drawn whatever the facets say, so it isn't one they hide.
  if (groups.some(group => group.note || !resolved.has(group.key))) {
    return "filtered"
  }

  return "empty"
}

const byPublished = (entry: NoteEntry) => getPublishedTimestamp(entry.note)

const makeNoteFeed = ({
  noteSource,
  interactionSource,
  pinned = readable<TrustedEvent[]>([]),
  included = readable<NoteFacet[]>(["notes", "replies", "interactions"]),
  order,
}: {
  noteSource: AuthorFeed
  interactionSource?: AuthorFeed
  pinned?: Readable<TrustedEvent[]>
  included?: Readable<NoteFacet[]>
  order: (cards: Readable<NoteEntry[]>) => Readable<NoteEntry[]>
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
  const resolver = makeNoteResolver({priority: 1})

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

  // Each filter is a list of its own, so changing it orders the cards afresh.
  const entries = derived(
    included,
    ($included, set) => {
      const cards = derived([groups, pinnedKeys], ([$groups, $pinnedKeys]) =>
        partition(
          entry => $pinnedKeys.has(entry.key),
          getEntries(
            $groups.filter(group => includesAnyFacet($included, group.facets)),
            $included,
          ),
        ),
      )

      const pinnedCards = derived(cards, ([$pinnedCards]) =>
        sortBy(entry => -byPublished(entry), $pinnedCards),
      )

      const otherCards = order(derived(cards, ([, $otherCards]) => $otherCards))

      return derived([pinnedCards, otherCards], ([$pinnedCards, $otherCards]) => [
        ...$pinnedCards,
        ...$otherCards,
      ]).subscribe(set)
    },
    [] as NoteEntry[],
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
    ([$entries, $groups, $resolved, $loading, $olderStatus, $included]) =>
      getStatus({
        entries: $entries,
        groups: $groups,
        resolved: $resolved,
        loading: $loading,
        olderStatus: $olderStatus,
        included: $included,
        sourceFacets,
      }),
  )

  const stop = () => {
    resolver.stop()
    unsubscribe()
    noteSource.stop()
    interactionSource?.stop()
  }

  return {entries, counts, status, loading, older, stop}
}

const getInteractionFilters = (authors: string[]) => {
  const filters: Filter[] = [{kinds: [REACTION, REPOST, GENERIC_REPOST], authors}]

  // A receipt is published by the recipient's wallet, which names the zapper in its P tag.
  if (ENABLE_ZAPS) {
    filters.push({kinds: [ZAP_RECEIPT], "#P": authors})
  }

  return filters
}

// The follows the feed starts with, loaded first if they aren't here yet.
const loadFollowPubkeys = async () => {
  const pubkey = app.get().user?.pubkey

  if (pubkey) {
    const followList = await followLists.get().load(pubkey)

    return followList?.pubkeys() ?? []
  }

  return []
}

export const makeNetworkFeed = (): NoteFeed => {
  const at = now()
  const controller = new AbortController()
  const follows = loadFollowPubkeys()

  // Follows' interactions are asked for the first time their facet is shown.
  const interactionSource = makeAuthorFeed({
    route: onGroups =>
      groupAuthors(
        whenIncluded("interactions", controller.signal).then(() => follows),
        onGroups,
      ),
    at,
    interval: int(HOUR),
    getFilters: getInteractionFilters,
  })

  const noteSource = makeAuthorFeed({
    route: onGroups => groupAuthors(follows, onGroups),
    at,
    interval: int(HOUR),
    getFilters: authors => [{kinds: [NOTE, ...CONTENT_KINDS], authors}],
  })

  const feed = makeNoteFeed({
    noteSource,
    interactionSource,
    included: includedNoteFacets,
    order: cards => appendOnly(cards, entry => entry.key, byPublished, at),
  })

  const stop = () => {
    controller.abort()
    feed.stop()
  }

  return {...feed, stop}
}

// A person's spaces hold posts their outbox may not, and a space that is also in the outbox is asked once.
const routeProfile = async (pubkey: string, onGroups: (groups: AuthorGroup[]) => void) => {
  const roomList = await roomLists
    .get()
    .load(pubkey)
    .catch(error => console.error(error))
  const spaceUrls = roomList ? roomList.urls() : []

  onGroups([{authors: [pubkey], urls: spaceUrls, spares: []}])

  await groupAuthors([pubkey], groups =>
    onGroups(
      groups.map(group => ({
        authors: group.authors,
        urls: difference(group.urls, spaceUrls),
        spares: difference(group.spares, spaceUrls),
      })),
    ),
  )
}

// Comments are asked for only on the kinds the profile draws, which leaves chat out.
const getProfileFilters = (authors: string[]) => {
  const kinds = [NOTE, HIGHLIGHT, ...CONTENT_KINDS]

  return [{kinds, authors}, makeCommentFilter(kinds, {authors})]
}

export const makeProfileFeed = (pubkey: string): NoteFeed => {
  const at = now()

  const noteSource = makeAuthorFeed({
    route: onGroups => routeProfile(pubkey, onGroups),
    at,
    interval: int(MONTH),
    getFilters: getProfileFilters,
  })

  return makeNoteFeed({
    noteSource,
    pinned: derivePinnedEvents(pubkey),
    order: cards => strictOrder(cards, (a, b) => byPublished(b) - byPublished(a)),
  })
}
