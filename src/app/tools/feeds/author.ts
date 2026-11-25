import {derived, get, writable} from "svelte/store"
import type {Readable} from "svelte/store"
import {Events} from "@welshman/app"
import {chunks, partition, shuffle, uniqBy} from "@welshman/lib"
import type {MaybeAsync} from "@welshman/lib"
import {projectAsync, throttled} from "@welshman/store"
import type {EventsById} from "@welshman/store"
import {outbox} from "@welshman/util"
import type {Filter, TrustedEvent} from "@welshman/util"
import {combinePagers} from "@lib/pager"
import type {Pager} from "@lib/pager"
import {app} from "@app/core/app"
import {PLATFORM_RELAYS} from "@app/core/env"
import {relayLists, router} from "@app/core/plugins"
import {getCompleteEvents, makeTimeline} from "@app/tools/feeds/timeline"
import type {Timeline} from "@app/tools/feeds/timeline"

// A group's spares are the relays it asks in place of ones that drop out of the feed
export type AuthorGroup = {authors: string[]; urls: string[]; spares: string[]}

export type AuthorFeedOptions = {
  // Hands each batch of groups to the feed as it's routed, and settles once every author has a place
  route: (onGroups: (groups: AuthorGroup[]) => void) => Promise<void>
  getFilters: (authors: string[]) => Filter[]
  at: number
  interval: number
}

export type AuthorFeed = {events: Readable<TrustedEvent[]>; older: Pager; stop: () => void}

// One selection over every follow lands on the few biggest relays, so each group scores its own.
const chunkAuthors = (authors: string[]) =>
  chunks(3, shuffle(authors)).filter(group => group.length > 0)

const routeAuthors = async (authors: string[]): Promise<AuthorGroup> => {
  const scenario = await router.get().resolve(authors.map(outbox))
  const urls = scenario.limit(20).getUrls()

  return {authors, urls: urls.slice(0, 10), spares: urls.slice(10)}
}

const hasRelayList = (pubkey: string) => Boolean(relayLists.get().get(pubkey))

const loadRelayLists = (pubkeys: string[]) =>
  Promise.all(
    pubkeys.map(pubkey =>
      relayLists
        .get()
        .load(pubkey)
        .catch(error => console.error(error)),
    ),
  )

// Authors whose relay list is known are grouped first, so their groups ask while the rest look for a list.
export const groupAuthors = async (
  pubkeys: MaybeAsync<string[]>,
  onGroups: (groups: AuthorGroup[]) => void,
) => {
  const authors = await pubkeys

  if (PLATFORM_RELAYS.length > 0) {
    onGroups([await routeAuthors(authors)])
  } else {
    // Relay lists are read by author, so the stored ones are read before deciding which are known
    await Promise.all(authors.map(pubkey => relayLists.get().index.read(pubkey)))

    const [known, unknown] = partition(hasRelayList, authors)

    onGroups(await Promise.all(chunkAuthors(known).map(routeAuthors)))

    await loadRelayLists(unknown)

    onGroups(await Promise.all(chunkAuthors(unknown.filter(hasRelayList)).map(routeAuthors)))
  }
}

// The values of a changing list of stores, as one store.
const collect = <T>(stores: Readable<Readable<T>[]>): Readable<T[]> =>
  derived(stores, ($stores, set) => {
    if ($stores.length > 0) {
      return derived($stores, values => values).subscribe(set)
    }

    set([])
  })

// Each timeline releases what it has complete, and the feed starts at `at` and only reaches back, so nothing newer is released.
const mergeTimelines = (timelines: Readable<Timeline[]>, at: number) => {
  const completeByTimeline = collect(
    derived(timelines, $timelines =>
      $timelines.map(timeline =>
        derived([timeline.events, timeline.floor], ([$events, $floor]) =>
          getCompleteEvents($events, $floor),
        ),
      ),
    ),
  )

  // Timelines fill a page together, so the merged list redraws once for all of them
  const events = throttled(
    150,
    derived(completeByTimeline, $completeByTimeline =>
      uniqBy(event => event.id, $completeByTimeline.flat()).filter(event => event.created_at <= at),
    ),
  )

  const older = combinePagers(
    derived(timelines, $timelines => $timelines.map(timeline => timeline.older)),
  )

  return {events, older}
}

export const makeAuthorFeed = ({
  route,
  getFilters,
  at,
  interval,
}: AuthorFeedOptions): AuthorFeed => {
  const controller = new AbortController()
  const timelines = writable<Timeline[]>([])
  const grouped = writable(false)
  const merged = mergeTimelines(timelines, at)

  // An author list with no relays to ask means nothing to show, not a spinner that never stops.
  const status = derived(
    [grouped, timelines, merged.older.status],
    ([$grouped, $timelines, $status]) =>
      $grouped && $timelines.length === 0 ? "exhausted" : $status,
  )

  const older: Pager = {status, page: merged.older.page, settle: merged.older.settle}

  const startTimelines = (group: AuthorGroup) => {
    const filters = getFilters(group.authors)
    const byUrl = app.get().use(Events).byIdByUrl(filters)

    const startTimeline = (url: string): Timeline =>
      makeTimeline({
        source: projectAsync(byUrl, ($byUrl): EventsById => $byUrl.get(url) ?? new Map()),
        url,
        filters,
        at,
        interval,
        // The cache would draw a group's history out of order.
        useCache: false,
        // A relay that drops out of the feed hands its place to the group's next one
        onDrop: () => {
          const spare = group.spares.shift()

          if (spare && !controller.signal.aborted) {
            timelines.update($timelines => [...$timelines, startTimeline(spare)])
            older.page()
          }
        },
      })

    return group.urls.map(startTimeline)
  }

  const addGroups = (groups: AuthorGroup[]) => {
    if (!controller.signal.aborted) {
      timelines.update($timelines => [...$timelines, ...groups.flatMap(startTimelines)])
      older.page()
    }
  }

  const start = async () => {
    await route(addGroups)

    grouped.set(true)
  }

  start().catch(error => console.error(error))

  const stop = () => {
    controller.abort()
    get(timelines).forEach(timeline => timeline.stop())
  }

  return {events: merged.events, older, stop}
}
