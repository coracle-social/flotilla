import {debounce} from "throttle-debounce"
import {derived, get, writable} from "svelte/store"
import type {Readable} from "svelte/store"
import {
  batch,
  call,
  chunks,
  initArray,
  int,
  ms,
  noop,
  now,
  on,
  partition,
  range,
  shuffle,
  sleep,
  uniq,
  uniqBy,
  DAY,
  MONTH,
  YEAR,
} from "@welshman/lib"
import {EVENT_TIME, compareEventsAsc, getAddress, matchFilters, outbox} from "@welshman/util"
import {TimeEvent} from "@welshman/domain"
import type {Maybe} from "@welshman/lib"
import type {Filter, TrustedEvent} from "@welshman/util"
import {mergeRepositoryUpdates} from "@welshman/store"
import type {RepositoryUpdate} from "@welshman/store"
import {createScroller} from "@lib/html"
import type {ScrollerOpts} from "@lib/html"
import {app} from "@app/core/app"
import {network, relayLists, router} from "@app/core/plugins"
import {reader} from "@app/core/domain"
import {PLATFORM_RELAYS} from "@app/core/env"

const mergeSorted = <T>(left: T[], right: T[], compare: (a: T, b: T) => number) => {
  const merged: T[] = []
  let i = 0
  let j = 0

  while (i < left.length && j < right.length) {
    merged.push(compare(left[i], right[j]) <= 0 ? left[i++] : right[j++])
  }

  while (i < left.length) {
    merged.push(left[i++])
  }
  while (j < right.length) {
    merged.push(right[j++])
  }

  return merged
}

// Keeps a feed's store in step with the repository: later arrivals, deletions, and events newly seen.
const syncFeed = ({
  relays,
  filters,
  addEvents,
  removeEvents,
  requireRelay = true,
}: {
  relays: string[]
  filters: Filter[]
  addEvents: (events: TrustedEvent[]) => void
  removeEvents: (ids: Set<string>) => void
  // Whether an event has to have been seen on one of `relays` to belong to this feed
  requireRelay?: boolean
}) => {
  const {repository} = app.get()

  const onTrackedId = batch(150, async (ids: string[]) => {
    const matching = await repository.query(filters.map(filter => ({...filter, ids: uniq(ids)})))

    if (matching.length > 0) {
      addEvents(matching)
    }
  })

  return [
    on(
      repository,
      "update",
      batch(150, (updates: RepositoryUpdate[]) => {
        const {added, removed} = mergeRepositoryUpdates(updates)

        if (removed.size > 0) {
          removeEvents(removed)
        }

        const matching = added.filter(
          event =>
            matchFilters(filters, event) &&
            (!requireRelay || relays.some(url => repository.tracker.hasRelay(event.id, url))),
        )

        if (matching.length > 0) {
          addEvents(matching)
        }
      }),
    ),
    on(repository.tracker, "add", (id: string, url: string) => {
      if (relays.includes(url)) {
        onTrackedId(id)
      }
    }),
  ]
}

// One direction of a feed. An empty span is a gap in the timeline rather than the end of it.
export type FeedLoadState =
  | {status: "idle"}
  | {status: "loading"}
  | {status: "searching"}
  | {status: "exhausted"}

// One span of a feed's timeline. `complete` is whether the relays answered, which a dropped request is not.
export type FeedSpan = {found: number; complete: boolean; exhausted: boolean; behind?: boolean}

// Relatively high because quiet relays eose first.
const SPAN_THRESHOLD = 0.8

// Short because a relay can accept a socket and never eose.
const SPAN_TIMEOUT = 3000

// Abort resolves a request with what arrived.
const spanSignal = (signal: AbortSignal) =>
  AbortSignal.any([signal, AbortSignal.timeout(SPAN_TIMEOUT)])

// Enough to cross a gap, not enough to reach the end of the history in one trigger.
const SPANS_PER_TRIGGER = 3

// A month-wide span is thousands of events in a busy feed, so ask for a page and let relays answer from the anchor.
const PAGE_SIZE = 100

// A span that finds nothing widens the next one, so a sparse history takes fewer round trips.
const nextInterval = (interval: number, found: number) =>
  found > 0 ? int(MONTH) : Math.round(interval * 1.5)

// Whether a request is in flight, which is not whether more might exist.
export const isFeedLoading = (state: Maybe<FeedLoadState>) =>
  state?.status === "loading" || state?.status === "searching"

export const makePager = (load: () => Promise<FeedSpan>) => {
  const state = writable<FeedLoadState>({status: "idle"})

  let running = false

  const page = async () => {
    if (running || get(state).status === "exhausted") {
      return
    }

    running = true

    try {
      for (let span = 0; span < SPANS_PER_TRIGGER; span++) {
        state.set({status: span > 0 ? "searching" : "loading"})

        const {found, complete, exhausted} = await load()

        if (exhausted) {
          state.set({status: "exhausted"})
          return
        }

        // A span nobody answered for has not moved the window, so hold here rather than walking past it.
        if (!complete) {
          await sleep(ms(3))
          break
        }

        if (found > 0) {
          break
        }
      }
    } finally {
      running = false
    }
  }

  // A page covers a few spans, so settling at the end of one blinks the spinner once per page.
  const settle = () => {
    if (!running && isFeedLoading(get(state))) {
      state.set({status: "idle"})
    }
  }

  return {subscribe: state.subscribe, page, settle}
}

// The container's orientation decides which direction `reverse` reaches, so the caller passes it.
export const makeScrollLoader = (
  element: HTMLElement,
  load: () => Promise<FeedSpan>,
  options: Partial<ScrollerOpts> = {},
) => {
  // Whether the feed has drawn further than the relays have answered, which the cache does before any answer.
  let behind: Maybe<boolean> = true

  const pager = makePager(async () => {
    const span = await load()

    behind = span.behind

    return span
  })

  // Drawn events fill the runway whether or not they're complete, so a hole in the cache never comes into reach.
  const settle = async () => {
    if (behind) {
      await pager.page()
    } else {
      pager.settle()
    }
  }

  const runway = options.threshold ?? 5000
  const scroller = createScroller({
    element,
    delay: 300,
    ...options,
    threshold: runway,
    onScroll: pager.page,
    onSettle: settle,
  })

  // A virtual list this pager feeds has to grow as far as it fetches, so it reads it back.
  return {subscribe: pager.subscribe, stop: scroller.stop, runway}
}

// Holds what a view has loaded and knows how to ask for the next span, while the view decides when.
export const makeFeed = ({
  relays,
  filters,
  onEvent,
  at = now(),
  quorum = SPAN_THRESHOLD,
  useCache = true,
}: {
  relays: string[]
  filters: Filter[]
  onEvent?: (event: TrustedEvent) => void
  at?: number
  // How much of the relay set has to close before a span is answered.
  quorum?: number
  // Whether a page of what the repository already holds renders ahead of the relays.
  useCache?: boolean
}) => {
  const controller = new AbortController()
  const events = writable<TrustedEvent[]>([])
  const seen = new Set<string>()

  // Events from further back than the feed has reached, held rather than rendered as they land.
  const held = new Map<string, TrustedEvent>()

  // Each direction widens its own span, since what one walks through says nothing about the other.
  let oldest = at
  let newest = at
  let olderInterval = int(MONTH)
  let newerInterval = int(MONTH)

  // How far back the feed has been answered for, which decides whether an event is ready to render.
  let reached = at

  // A span reaches only as far as its shallowest relay, so every one of them has to have answered.
  const relayCount = new Set(relays).size

  const insertEvents = (newEvents: Iterable<TrustedEvent>) => {
    const added: TrustedEvent[] = []

    for (const event of newEvents) {
      if (!seen.has(event.id)) {
        seen.add(event.id)
        held.delete(event.id)
        added.push(event)
        onEvent?.(event)
      }
    }

    if (added.length > 0) {
      added.sort(compareEventsAsc)

      events.update($events => mergeSorted($events, added, compareEventsAsc))
    }
  }

  const addEvents = (newEvents: TrustedEvent[]) => {
    const ready: TrustedEvent[] = []

    for (const event of newEvents) {
      if (!seen.has(event.id) && !held.has(event.id)) {
        if (event.created_at >= reached) {
          ready.push(event)
        } else {
          held.set(event.id, event)
        }
      }
    }

    insertEvents(ready)
  }

  const removeEvents = (ids: Set<string>) => {
    events.update($events => $events.filter(event => !ids.has(event.id)))

    for (const id of ids) {
      seen.delete(id)
      held.delete(id)
    }
  }

  // Take the feed back to `timestamp`, releasing everything held for the stretch it gains.
  const reach = (timestamp: number) => {
    if (timestamp < reached) {
      reached = timestamp

      const ready: TrustedEvent[] = []

      for (const [id, event] of held) {
        if (event.created_at >= reached) {
          held.delete(id)
          ready.push(event)
        }
      }

      insertEvents(ready)
    }
  }

  const unsubscribers = syncFeed({relays, filters, addEvents, removeEvents})

  // Each relay answers a limit for itself, so a page runs out where the relay that gave least ran out.
  const loadSpan = async (extension: Filter, onCover?: (timestamp: number) => void) => {
    let complete = false

    const pages = new Map<string, {count: number; lowest: number}>()

    const countEvent = (event: TrustedEvent, url: string) => {
      const page = pages.get(url)

      if (page) {
        page.count += 1
        page.lowest = Math.min(page.lowest, event.created_at)
      } else {
        pages.set(url, {count: 1, lowest: event.created_at})
      }

      if (pages.size === relayCount) {
        onCover?.(Math.max(...Array.from(pages.values(), page => page.lowest)))
      }
    }

    const found = await network.get().load({
      relays,
      // The socket sends five per 100ms first come first served, so the feed on screen goes ahead of the space's background pulls.
      priority: 1,
      signal: spanSignal(controller.signal),
      threshold: quorum,
      filters: filters.map(filter => ({...filter, ...extension})),
      onEvent: countEvent,
      onDuplicate: countEvent,
      onEose: () => {
        complete = true
      },
    })

    return {found, complete, pages}
  }

  // The window only moves once the relays have answered, since a dropped request looks like an empty span.
  const loadOlder = async (): Promise<FeedSpan> => {
    if (oldest < now() - int(2, YEAR)) {
      return {found: 0, complete: true, exhausted: true}
    }

    const until = oldest
    const since = until - olderInterval

    // A page comes back newest first, so a relay's lowest answer proves the stretch above it.
    const {found, complete, pages} = await loadSpan({since, until, limit: PAGE_SIZE}, reach)

    // A relay that answered with less than its limit has covered its whole span.
    let edge: Maybe<number>

    for (const page of pages.values()) {
      if (page.count >= PAGE_SIZE && (edge === undefined || page.lowest > edge)) {
        edge = page.lowest
      }
    }

    if (complete) {
      olderInterval = nextInterval(olderInterval, found.length)

      // Stepping the edge back is what stops a page that filled up inside one span being asked for again.
      oldest = edge === undefined ? since : Math.min(edge, until - 1)
    }

    // addEvents, not insertEvents: found can reach below oldest.
    addEvents(found)
    reach(oldest)

    return {found: found.length, complete, exhausted: false, behind: oldest > reached}
  }

  // A limit is answered with the newest events matching it, which reaches away from an anchor in the past.
  const loadNewer = async (): Promise<FeedSpan> => {
    if (newest >= now()) {
      return {found: 0, complete: true, exhausted: true}
    }

    const since = newest
    const until = Math.min(now(), since + newerInterval)
    const {found, complete} = await loadSpan({since, until})

    if (complete) {
      newerInterval = nextInterval(newerInterval, found.length)
      newest = until
    }

    addEvents(found)

    return {found: found.length, complete, exhausted: false}
  }

  // A limit counts each filter, so a relay's page is cut back to one page after they're merged.
  const loadCache = async () => {
    const {repository} = app.get()
    const pages = await Promise.all(
      relays.map(async relay => {
        const events = await repository.query(
          filters.map(filter => ({...filter, limit: PAGE_SIZE})),
          {relay, signal: controller.signal},
        )

        return events.slice(0, PAGE_SIZE)
      }),
    )

    // A relay with nothing cached proves nothing either way, and letting it veto the span blanks the feed.
    const cached = pages.filter(page => page.length > 0)

    if (cached.length > 0) {
      reach(Math.max(...cached.map(page => page[page.length - 1].created_at)))
    }

    addEvents(pages.flat())
  }

  // What the repository already holds is an answer too, so a page of it renders before any relay replies.
  if (useCache) {
    loadCache().catch(error => {
      // A feed cleaned up before the repository answered aborts the read
      if (!controller.signal.aborted) {
        console.error(error)
      }
    })
  }

  return {
    events,
    loadOlder,
    loadNewer,
    cleanup: () => {
      controller.abort()
      unsubscribers.forEach(call)
    },
  }
}

export type GroupedFeed = {
  events: Readable<TrustedEvent[]>
  loading: Readable<boolean>
  exhausted: Readable<boolean>
  page: () => Promise<void>
  settle: () => void
  stop: () => void
}

// A set of follows, paged one group of relays at a time so a slow group holds up no other.
export const makeGroupedFeed = ({
  getFilters,
  onEvent,
  pubkeys,
}: {
  getFilters: (pubkeys: string[]) => Filter[]
  onEvent?: (event: TrustedEvent) => void
  pubkeys: Readable<string[]>
}): GroupedFeed => {
  const pages = writable<TrustedEvent[][]>([])
  const states = writable<FeedLoadState[]>([])

  let pagers: ReturnType<typeof makePager>[] = []
  let unsubscribers: (() => void)[] = []
  let generation = 0

  const events = derived(pages, $pages => $pages.flat())

  const loading = derived(states, $states => $states.some(isFeedLoading))

  const exhausted = derived(
    states,
    $states => $states.length > 0 && $states.every(state => state.status === "exhausted"),
  )

  const page = async () => {
    await Promise.all(pagers.map(pager => pager.page().catch(error => console.error(error))))
  }

  const settle = () => pagers.forEach(pager => pager.settle())

  // Each group walks its own timeline, so a slow group holds up nobody else's next page.
  const startGroup = async (group: string[], index: number, turn: number) => {
    const scenario = await router.get().resolve(group.map(pubkey => outbox(pubkey)))

    if (turn === generation) {
      const feed = makeFeed({
        relays: scenario.limit(10).getUrls(),
        // Half the group's relays answering is enough to show its page, since the rest get asked again.
        quorum: 0.5,
        useCache: false,
        filters: getFilters(group),
        onEvent,
      })

      const pager = makePager(feed.loadOlder)

      pagers.push(pager)
      unsubscribers.push(
        feed.events.subscribe($events =>
          pages.update($pages => $pages.map((grouped, i) => (i === index ? $events : grouped))),
        ),
        pager.subscribe($state =>
          states.update($states => $states.map((state, i) => (i === index ? $state : state))),
        ),
        feed.cleanup,
      )
    }
  }

  const startGroups = async (groups: string[][], turn: number) => {
    if (turn !== generation) {
      return
    }

    const offset = get(pages).length

    pages.update($pages => [...$pages, ...initArray(groups.length, (): TrustedEvent[] => [])])
    states.update($states => [
      ...$states,
      ...initArray(groups.length, (): FeedLoadState => ({status: "idle"})),
    ])

    await Promise.all(groups.map((group, index) => startGroup(group, offset + index, turn)))
  }

  // One selection over every follow lands on the few biggest relays, so each group scores its own.
  const build = async (authors: string[]) => {
    const turn = generation

    if (PLATFORM_RELAYS.length > 0) {
      await startGroups([authors], turn)
    } else {
      const [known, unknown] = partition(pubkey => Boolean(relayLists.get().get(pubkey)), authors)

      await startGroups(
        chunks(3, shuffle(known)).filter(group => group.length > 0),
        turn,
      )

      // What can be asked for goes out now, while the rest look for a relay list to name.
      if (turn === generation) {
        page()
      }

      // Every follow asked in its own group once its relay list is in, rather than all on one set.
      await Promise.all(unknown.map(pubkey => relayLists.get().load(pubkey).catch(noop)))

      if (turn !== generation) {
        return
      }

      const loaded = unknown.filter(pubkey => relayLists.get().get(pubkey))

      await startGroups(
        chunks(3, shuffle(loaded)).filter(group => group.length > 0),
        turn,
      )
    }

    if (turn !== generation) {
      return
    }

    // A follow with no relays to ask means nothing to show, rather than a spinner that never stops.
    if (get(states).length === 0) {
      states.set([{status: "exhausted"}])
    }

    await page()
  }

  // Bumping the generation is what keeps an await in flight from writing into the run that replaced it.
  const reset = () => {
    generation += 1
    unsubscribers.forEach(call)
    unsubscribers = []
    pagers = []

    pages.set([])
    states.set([])
  }

  // Follow and unfollow bursts land on the same rebuild, which asks every relay again from the top.
  const rebuild = debounce(1000, (authors: string[]) => {
    reset()
    build(authors)
  })

  let currentKey: string | undefined

  // The first list starts at once, and a change to a feed already running waits for the burst to end.
  const unsubscribePubkeys = pubkeys.subscribe($pubkeys => {
    const key = $pubkeys.join(",")

    if (key !== currentKey) {
      currentKey = key

      if ($pubkeys.length === 0) {
        rebuild.cancel()
        reset()
      } else if (get(states).length === 0) {
        build($pubkeys)
      } else {
        rebuild($pubkeys)
      }
    }
  })

  const stop = () => {
    rebuild.cancel()
    unsubscribePubkeys()
    reset()
  }

  return {events, loading, exhausted, page, settle, stop}
}

// Calendar events are addressed by the days they cover, so the spans are date hashes.
export const makeCalendarFeed = ({
  relays,
  filters,
  onEvent,
}: {
  relays: string[]
  filters: Filter[]
  onEvent?: (event: TrustedEvent) => void
}) => {
  const interval = int(5, MONTH)
  const controller = new AbortController()
  const seen = new Set<string>()

  let oldest = now()
  let newest = now()

  const getStart = (event: TrustedEvent) => reader(TimeEvent)(event).start() ?? 0

  const compareByStart = (a: TrustedEvent, b: TrustedEvent) =>
    getStart(a) - getStart(b) || compareEventsAsc(a, b)

  // The filters take in comments too, for the feed context, and a TimeEvent reader throws on them.
  const isValid = (event: TrustedEvent) => {
    if (event.kind === EVENT_TIME) {
      const timeEvent = reader(TimeEvent)(event)

      return timeEvent.start() && timeEvent.end() && !seen.has(event.id)
    }

    return false
  }

  const events = writable<TrustedEvent[]>([])

  const insertEvents = (newEvents: TrustedEvent[]) => {
    const valid = newEvents.filter(isValid)

    if (valid.length === 0) {
      return
    }

    for (const event of valid) {
      seen.add(event.id)
      onEvent?.(event)
    }

    valid.sort(compareByStart)

    events.update($events => {
      // Calendar events are addressable, so a new version supersedes the old one
      const superseded = new Set(valid.map(getAddress))

      return mergeSorted(
        $events.filter(e => !superseded.has(getAddress(e))),
        valid,
        compareByStart,
      )
    })
  }

  const removeEvents = (ids: Set<string>) => {
    events.update($events => $events.filter(event => !ids.has(event.id)))

    for (const id of ids) {
      seen.delete(id)
    }
  }

  // Calendar events are addressable and often relayed on, so this takes any match rather than its own relays'.
  const unsubscribers = syncFeed({
    relays,
    filters,
    addEvents: insertEvents,
    removeEvents,
    requireRelay: false,
  })

  // What these relays were seen holding shows before any of them replies.
  const loadCache = async () => {
    const {repository} = app.get()
    const stored = await Promise.all(
      relays.map(relay => repository.query(filters, {relay, signal: controller.signal})),
    )

    insertEvents(uniqBy(event => event.id, stored.flat()))
  }

  loadCache().catch(error => {
    if (!controller.signal.aborted) {
      console.error(error)
    }
  })

  const loadTimeframe = async (since: number, until: number) => {
    let complete = false

    const found = await network.get().load({
      relays,
      priority: 1,
      signal: spanSignal(controller.signal),
      threshold: SPAN_THRESHOLD,
      filters: [
        {
          kinds: [EVENT_TIME],
          "#D": [...range(since, until, DAY)].map(t => String(Math.floor(t / DAY))),
        },
      ],
      onEose: () => {
        complete = true
      },
    })

    return {found: found.length, complete}
  }

  const loadOlder = async (): Promise<FeedSpan> => {
    if (oldest < now() - int(2, YEAR)) {
      return {found: 0, complete: true, exhausted: true}
    }

    const until = oldest
    const since = until - interval
    const {found, complete} = await loadTimeframe(since, until)

    if (complete) {
      oldest = since
    }

    return {found, complete, exhausted: false}
  }

  const loadNewer = async (): Promise<FeedSpan> => {
    if (newest > now() + int(2, YEAR)) {
      return {found: 0, complete: true, exhausted: true}
    }

    const since = newest
    const until = since + interval
    const {found, complete} = await loadTimeframe(since, until)

    if (complete) {
      newest = until
    }

    return {found, complete, exhausted: false}
  }

  return {
    events,
    loadOlder,
    loadNewer,
    // The month and week views jump to a range rather than scrolling, and wait to show progress for it.
    load: loadTimeframe,
    cleanup: () => {
      controller.abort()
      unsubscribers.forEach(call)
    },
  }
}
