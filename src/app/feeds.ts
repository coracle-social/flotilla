import {derived, get, readable, writable} from "svelte/store"
import type {Readable, Writable} from "svelte/store"
import {batch, call, int, now, on, sortBy, uniqBy, MONTH, YEAR} from "@welshman/lib"
import {
  COMMENT,
  DELETE,
  EVENT_TIME,
  addressTags,
  getAddress,
  getCommentFiltersForRoot,
  getIdOrAddress,
  getReplyFilters,
  hexTags,
  isReplaceableKind,
  matchFilters,
  tagSpec,
  tagValue,
  tagValues,
} from "@welshman/util"
import type {Maybe} from "@welshman/lib"
import type {Filter, TrustedEvent} from "@welshman/util"
import {mergeRepositoryUpdates} from "@welshman/net"
import type {RepositoryUpdate} from "@welshman/net"
import {createScroller} from "@lib/html"
import type {ScrollerOpts} from "@lib/html"
import {daysBetween} from "@lib/util"
import {EVENT_CONTEXT_KINDS, REACTION_KINDS} from "@app/content"
import {app, network} from "@app/core"
import {getEventsForUrl} from "@app/repository"

const noEvents: TrustedEvent[] = []

// Reactions, zaps and reports point at their subject with `e`/`a`. A NIP-22 comment instead
// points at its thread *root* with `E`/`A`, so filing it by those tags puts a whole thread in
// the root's bucket — which is the scope a reply count wants.
const getTargets = ({kind, tags}: TrustedEvent) =>
  kind === COMMENT
    ? [...tagValues(hexTags("E"), tags), ...tagValues(addressTags("A"), tags)]
    : [...tagValues(hexTags("e"), tags), ...tagValues(addressTags("a"), tags)]

// A related event may point at a replaceable one by either id or address, so both are keys
const getKeys = (event: TrustedEvent) =>
  isReplaceableKind(event.kind) ? [event.id, getAddress(event)] : [event.id]

export const makeFeedContext = ({relays}: {relays: string[] | Promise<string[]>}) => {
  const {repository} = app.get()
  const controller = new AbortController()
  const targets = new Set<string>()
  const eventsByTarget = new Map<string, TrustedEvent[]>()
  const targetsByEventId = new Map<string, string[]>()
  const subscribersByTarget = new Map<string, Set<(events: TrustedEvent[]) => void>>()
  const deletedChecks = new Map<string, Set<() => void>>()

  const addEvent = (event: TrustedEvent, touched: Set<string>) => {
    // An event seen before its target was tracked stays unfiled, so that adding the target
    // later can pick it up out of the repository
    if (!targetsByEventId.has(event.id)) {
      const eventTargets = getTargets(event).filter(target => targets.has(target))

      if (eventTargets.length > 0) {
        targetsByEventId.set(event.id, eventTargets)

        for (const target of eventTargets) {
          eventsByTarget.set(target, [...(eventsByTarget.get(target) || []), event])
          touched.add(target)
        }
      }
    }
  }

  const removeEvent = (id: string, touched: Set<string>) => {
    const eventTargets = targetsByEventId.get(id)

    if (eventTargets) {
      targetsByEventId.delete(id)

      for (const target of eventTargets) {
        const events = eventsByTarget.get(target)!.filter(event => event.id !== id)

        if (events.length > 0) {
          eventsByTarget.set(target, events)
        } else {
          eventsByTarget.delete(target)
        }

        touched.add(target)
      }
    }
  }

  const notifyDeleted = (added: TrustedEvent[], removed: Set<string>) => {
    if (deletedChecks.size > 0) {
      if (removed.size > 0) {
        for (const checks of deletedChecks.values()) {
          for (const check of checks) check()
        }
      } else {
        for (const event of added) {
          for (const check of deletedChecks.get(getIdOrAddress(event)) || []) {
            check()
          }
        }
      }
    }
  }

  const notify = (touched: Set<string>) => {
    for (const target of touched) {
      for (const subscriber of subscribersByTarget.get(target) || []) {
        subscriber(eventsByTarget.get(target) || noEvents)
      }
    }
  }

  const loadContext = batch(100, async (events: TrustedEvent[]) => {
    const touched = new Set<string>()

    // What's already local — an earlier page, our own optimistic reactions — never comes
    // through the update listener, so file it before asking the network for the rest
    for (const event of repository.query([
      ...getReplyFilters(events, {kinds: EVENT_CONTEXT_KINDS}),
      ...getCommentFiltersForRoot(events),
    ])) {
      addEvent(event, touched)
    }

    notify(touched)

    const urls = await relays

    const context = await network.get().load({
      relays: urls,
      signal: controller.signal,
      filters: [
        ...getReplyFilters(events, {kinds: REACTION_KINDS}),
        ...getCommentFiltersForRoot(events),
      ],
    })

    if (context.length > 0) {
      network.get().load({
        relays: urls,
        signal: controller.signal,
        filters: getReplyFilters(context, {kinds: [DELETE]}),
      })
    }
  })

  const unsubscribe = on(
    repository,
    "update",
    batch(150, (updates: RepositoryUpdate[]) => {
      const {added, removed} = mergeRepositoryUpdates(updates)
      const touched = new Set<string>()

      for (const event of added) {
        if (EVENT_CONTEXT_KINDS.includes(event.kind)) {
          addEvent(event, touched)
        }
      }

      for (const id of removed) {
        removeEvent(id, touched)
      }

      notify(touched)
      notifyDeleted(added, removed)
    }),
  )

  // Track an event so its context gets requested with the rest of the batch
  const add = (event: TrustedEvent) => {
    if (!targets.has(event.id)) {
      for (const key of getKeys(event)) {
        targets.add(key)
      }

      loadContext(event)
    }
  }

  const relatedForKey = (key: string) =>
    readable(eventsByTarget.get(key) || noEvents, set => {
      let subscribers = subscribersByTarget.get(key)

      if (!subscribers) {
        subscribers = new Set()
        subscribersByTarget.set(key, subscribers)
      }

      subscribers.add(set)
      set(eventsByTarget.get(key) || noEvents)

      return () => {
        subscribers.delete(set)

        if (subscribers.size === 0) {
          subscribersByTarget.delete(key)
        }
      }
    })

  return {
    add,
    deleted: (event: TrustedEvent) =>
      readable(repository.isDeleted(event), set => {
        const key = getIdOrAddress(event)
        const check = () => set(repository.isDeleted(event))

        let checks = deletedChecks.get(key)

        if (!checks) {
          checks = new Set()
          deletedChecks.set(key, checks)
        }

        checks.add(check)
        check()

        return () => {
          checks.delete(check)

          if (checks.size === 0) {
            deletedChecks.delete(key)
          }
        }
      }),
    related: (event: TrustedEvent): Readable<TrustedEvent[]> => {
      add(event)

      const [key, ...rest] = getKeys(event)

      // A replaceable event collects both its buckets, and something tagging it by id and
      // address at once lands in both
      return rest.length > 0
        ? derived([relatedForKey(key), ...rest.map(relatedForKey)], buckets =>
            uniqBy(event => event.id, buckets.flat()),
          )
        : relatedForKey(key)
    },
    cleanup: () => {
      controller.abort()
      unsubscribe()
    },
  }
}

export type FeedContext = ReturnType<typeof makeFeedContext>

// Keeps a feed's store in step with the repository: events that arrive later, events that get
// deleted, and events already held that have only now been seen on one of the feed's relays.
const syncFeed = ({
  relays,
  filters,
  events,
  seen,
  insertEvents,
  requireRelay = true,
}: {
  relays: string[]
  filters: Filter[]
  events: Writable<TrustedEvent[]>
  seen: Set<string>
  insertEvents: (events: TrustedEvent[]) => void
  // Whether an event has to have been seen on one of `relays` to belong to this feed
  requireRelay?: boolean
}) => {
  const onTrackedId = batch(150, (ids: string[]) => {
    const matching: TrustedEvent[] = []

    for (const id of new Set(ids)) {
      const event = app.get().repository.getEvent(id)

      if (event && matchFilters(filters, event)) {
        matching.push(event)
      }
    }

    if (matching.length > 0) {
      insertEvents(matching)
    }
  })

  return [
    on(
      app.get().repository,
      "update",
      batch(150, (updates: RepositoryUpdate[]) => {
        const {added, removed} = mergeRepositoryUpdates(updates)

        if (removed.size > 0) {
          events.update($events => $events.filter(e => !removed.has(e.id)))

          for (const id of removed) {
            seen.delete(id)
          }
        }

        const matching = added.filter(
          event =>
            matchFilters(filters, event) &&
            (!requireRelay || relays.some(url => app.get().tracker.getRelays(event.id).has(url))),
        )

        if (matching.length > 0) {
          insertEvents(matching)
        }
      }),
    ),
    on(app.get().tracker, "add", (id: string, url: string) => {
      if (relays.includes(url)) {
        onTrackedId(id)
      }
    }),
  ]
}

// One direction of a feed. A span that comes back empty is a gap in the timeline, not the end of
// it — conflating the two either stops loading at the first gap or walks the whole history
// looking for the end of one.
export type FeedLoadState =
  | {status: "idle"}
  | {status: "loading"}
  | {status: "searching"}
  | {status: "exhausted"}

// Empty spans to walk per trigger. Enough to cross a gap; not enough to reach the end of the
// history on a single request.
const SPANS_PER_TRIGGER = 3

// Whether a request is actually in flight, which is not the same as whether more might exist. A
// list that already has what it needs shouldn't sit under a spinner just because it hasn't
// walked to the end of the history.
export const isFeedLoading = (state: Maybe<FeedLoadState>) =>
  state?.status === "loading" || state?.status === "searching"

const makeFeedLoader = (load: () => Promise<{found: number; exhausted: boolean}>) => {
  const state = writable<FeedLoadState>({status: "idle"})

  let running = false

  const run = async () => {
    if (running || get(state).status === "exhausted") return

    running = true

    try {
      for (let span = 0; span < SPANS_PER_TRIGGER; span++) {
        state.set({status: span > 0 ? "searching" : "loading"})

        const {found, exhausted} = await load()

        if (exhausted) {
          state.set({status: "exhausted"})
          return
        }

        if (found > 0) {
          state.set({status: "idle"})
          return
        }
      }

      state.set({status: "idle"})
    } finally {
      running = false
    }
  }

  return {subscribe: state.subscribe, run}
}

// A loader triggered by proximity to the end of a scroll container, which is how every list in
// the app pages. The container's orientation decides which direction `reverse` reaches, so the
// caller passes it — a reversed chat scrolls away from its origin to find older messages, an
// ordinary feed scrolls toward the end of its own content.
export const makeScrollLoader = (
  element: HTMLElement,
  load: () => Promise<{found: number; exhausted: boolean}>,
  options: Partial<ScrollerOpts> = {},
) => {
  const loader = makeFeedLoader(load)
  const scroller = createScroller({
    element,
    delay: 300,
    threshold: 5000,
    ...options,
    onScroll: loader.run,
  })

  return {subscribe: loader.subscribe, stop: scroller.stop}
}

// Holds every event a view has loaded, sorted oldest to newest, and knows how to ask for the
// next span in either direction. It does not decide *when* to ask — the view does, because the
// view is what knows what is on screen.
export const makeFeed = ({
  relays,
  filters,
  onEvent,
  at = now(),
}: {
  relays: string[]
  filters: Filter[]
  onEvent?: (event: TrustedEvent) => void
  at?: number
}) => {
  const controller = new AbortController()
  const events = writable<TrustedEvent[]>([])
  const seen = new Set<string>()

  // The span the relays have been asked about, which grows outward from the anchor
  let oldest = at
  let newest = at
  let interval = int(MONTH)

  const insertEvents = (newEvents: Iterable<TrustedEvent>) => {
    const added: TrustedEvent[] = []

    for (const event of newEvents) {
      if (!seen.has(event.id)) {
        seen.add(event.id)
        added.push(event)
        onEvent?.(event)
      }
    }

    if (added.length > 0) {
      added.sort((a, b) => a.created_at - b.created_at)

      events.update($events => {
        const merged: TrustedEvent[] = []
        let i = 0
        let j = 0

        while (i < $events.length && j < added.length) {
          if ($events[i].created_at <= added[j].created_at) {
            merged.push($events[i++])
          } else {
            merged.push(added[j++])
          }
        }

        while (i < $events.length) merged.push($events[i++])
        while (j < added.length) merged.push(added[j++])

        return merged
      })
    }
  }

  const unsubscribers = syncFeed({relays, filters, events, seen, insertEvents})

  const loadTimeframe = async (since: number, until: number) => {
    const found = await network.get().request({
      relays,
      autoClose: true,
      signal: controller.signal,
      filters: filters.map(filter => ({...filter, since, until})),
    })

    // A span that turns up nothing widens the next one, so walking a sparse history doesn't
    // take dozens of round trips
    interval = found.length > 0 ? int(MONTH) : Math.round(interval * 1.5)

    return found.length
  }

  // Ask for the next span in each direction. A span that comes back empty is normal while
  // walking a sparse history, so the count is reported separately from whether there is any
  // history left — a caller watching its list for changes would never hear about an empty one.
  const loadOlder = async () => {
    if (oldest < now() - int(2, YEAR)) return {found: 0, exhausted: true}

    const until = oldest

    oldest = until - interval

    return {found: await loadTimeframe(oldest, until), exhausted: false}
  }

  const loadNewer = async () => {
    if (newest >= now()) return {found: 0, exhausted: true}

    const since = newest

    newest = Math.min(now(), since + interval)

    return {found: await loadTimeframe(since, newest), exhausted: false}
  }

  for (const url of relays) {
    insertEvents(getEventsForUrl(url, filters))
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

// Same split as makeFeed: it holds what has been loaded and knows how to reach further out in
// either direction, while the page decides when to ask. Calendar events are addressed by the
// days they cover rather than by when they were published, so the spans are date hashes.
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

  const getStart = (event: TrustedEvent) => parseInt(tagValue(tagSpec("start"), event.tags) || "")

  const getEnd = (event: TrustedEvent) => parseInt(tagValue(tagSpec("end"), event.tags) || "")

  const events = writable(
    sortBy(
      getStart,
      uniqBy(
        e => e.id,
        relays.flatMap(url => Array.from(getEventsForUrl(url, filters))),
      ),
    ),
  )

  const insertEvents = (newEvents: TrustedEvent[]) => {
    const valid = newEvents.filter(e => !isNaN(getStart(e)) && !isNaN(getEnd(e)) && !seen.has(e.id))

    if (valid.length === 0) return

    for (const event of valid) {
      seen.add(event.id)
      onEvent?.(event)
    }

    valid.sort((a, b) => getStart(a) - getStart(b))

    events.update($events => {
      // Calendar events are addressable, so a new version supersedes the old one
      const superseded = new Set(valid.map(getAddress))
      const kept = $events.filter(e => !superseded.has(getAddress(e)))
      const merged: TrustedEvent[] = []
      let i = 0
      let j = 0

      while (i < kept.length && j < valid.length) {
        if (getStart(kept[i]) <= getStart(valid[j])) {
          merged.push(kept[i++])
        } else {
          merged.push(valid[j++])
        }
      }

      while (i < kept.length) merged.push(kept[i++])
      while (j < valid.length) merged.push(valid[j++])

      return merged
    })
  }

  // Calendar events are addressable and often relayed on from elsewhere, so this feed takes any
  // matching event rather than only those seen on its own relays
  const unsubscribers = syncFeed({
    relays,
    filters,
    events,
    seen,
    insertEvents,
    requireRelay: false,
  })

  const loadTimeframe = async (since: number, until: number) => {
    const found = await network.get().request({
      relays,
      autoClose: true,
      signal: controller.signal,
      filters: [{kinds: [EVENT_TIME], "#D": daysBetween(since, until).map(String)}],
    })

    return found.length
  }

  const loadOlder = async () => {
    if (oldest < now() - int(2, YEAR)) return {found: 0, exhausted: true}

    const until = oldest

    oldest = until - interval

    return {found: await loadTimeframe(oldest, until), exhausted: false}
  }

  const loadNewer = async () => {
    if (newest > now() + int(2, YEAR)) return {found: 0, exhausted: true}

    const since = newest

    newest = since + interval

    return {found: await loadTimeframe(since, newest), exhausted: false}
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
