import {derived, get, readable, writable} from "svelte/store"
import type {Readable} from "svelte/store"
import {batch, call, int, ms, now, on, sleep, uniqBy, MONTH, YEAR} from "@welshman/lib"
import {
  COMMENT,
  DELETE,
  EVENT_TIME,
  NOTE,
  addressTags,
  compareEventsAsc,
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

const mergeSorted = <T>(left: T[], right: T[], compare: (a: T, b: T) => number) => {
  const merged: T[] = []
  let i = 0
  let j = 0

  while (i < left.length && j < right.length) {
    merged.push(compare(left[i], right[j]) <= 0 ? left[i++] : right[j++])
  }

  while (i < left.length) merged.push(left[i++])
  while (j < right.length) merged.push(right[j++])

  return merged
}

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

export const makeFeedContext = ({
  relays,
  withReplies = false,
}: {
  relays: string[] | Promise<string[]>
  withReplies?: boolean
}) => {
  // Every feed loads NIP-22 comments. Kind 1 notes reply to each other with `e` tags instead,
  // so a feed that renders those replies has to ask for them as well.
  const contextKinds = withReplies ? [...EVENT_CONTEXT_KINDS, NOTE] : EVENT_CONTEXT_KINDS
  const requestKinds = withReplies ? [...REACTION_KINDS, NOTE] : REACTION_KINDS
  const {repository, tracker} = app.get()
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

  const loadFrom = async (urls: string[], events: TrustedEvent[]) => {
    const context = await network.get().load({
      relays: urls,
      signal: controller.signal,
      filters: [
        ...getReplyFilters(events, {kinds: requestKinds}),
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
  }

  const loadContext = batch(100, async (events: TrustedEvent[]) => {
    const touched = new Set<string>()

    // What's already local — an earlier page, our own optimistic reactions — never comes
    // through the update listener, so file it before asking the network for the rest
    for (const event of repository.query([
      ...getReplyFilters(events, {kinds: contextKinds}),
      ...getCommentFiltersForRoot(events),
    ])) {
      addEvent(event, touched)
    }

    notify(touched)

    const urls = await relays

    // A space relay holds the whole conversation for its own feed. A feed built out of other
    // people's outboxes does not, so ask each event's own relays for its context too.
    const eventsByRelay = new Map<string, TrustedEvent[]>()

    for (const event of events) {
      for (const url of tracker.getRelays(event.id)) {
        if (!urls.includes(url)) {
          eventsByRelay.set(url, [...(eventsByRelay.get(url) || []), event])
        }
      }
    }

    await Promise.all([
      loadFrom(urls, events),
      ...Array.from(eventsByRelay, ([url, seenThere]) => loadFrom([url], seenThere)),
    ])
  })

  const unsubscribe = on(
    repository,
    "update",
    batch(150, (updates: RepositoryUpdate[]) => {
      const {added, removed} = mergeRepositoryUpdates(updates)
      const touched = new Set<string>()

      for (const event of added) {
        if (contextKinds.includes(event.kind)) {
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
  const onTrackedId = batch(150, (ids: string[]) => {
    const matching: TrustedEvent[] = []

    for (const id of new Set(ids)) {
      const event = app.get().repository.getEvent(id)

      if (event && matchFilters(filters, event)) {
        matching.push(event)
      }
    }

    if (matching.length > 0) {
      addEvents(matching)
    }
  })

  return [
    on(
      app.get().repository,
      "update",
      batch(150, (updates: RepositoryUpdate[]) => {
        const {added, removed} = mergeRepositoryUpdates(updates)

        if (removed.size > 0) {
          removeEvents(removed)
        }

        const matching = added.filter(
          event =>
            matchFilters(filters, event) &&
            (!requireRelay || relays.some(url => app.get().tracker.getRelays(event.id).has(url))),
        )

        if (matching.length > 0) {
          addEvents(matching)
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

// One span of a feed's timeline. `complete` is whether the relays actually answered for it: a
// request the socket dropped reports nothing found, which is not the same thing as a span with
// nothing in it, and the two have to move the window differently.
export type FeedSpan = {found: number; complete: boolean; exhausted: boolean}

// The share of the relays a span asked that have to answer before it stops waiting on the rest. A
// request otherwise waits on every one of them, and a relay that accepts a socket and then says
// nothing neither answers nor drops. A span is also what releases the events it found, so one
// silent relay leaves the feed empty rather than slow.
const SPAN_THRESHOLD = 0.5

// Empty spans to walk per trigger. Enough to cross a gap; not enough to reach the end of the
// history on a single request.
const SPANS_PER_TRIGGER = 3

// How many events one step back through the history asks for. Spans are a month wide so that a
// quiet feed finds its history in a few requests, which in a busy one is thousands of events —
// far more than anyone is about to read, and all of it queued ahead of what they are looking at.
// Asking for a page instead leaves the relays to answer with the events nearest the anchor,
// which is what NIP-01 promises a filter carrying a limit.
const PAGE_SIZE = 100

// Whether a request is actually in flight, which is not the same as whether more might exist. A
// list that already has what it needs shouldn't sit under a spinner just because it hasn't
// walked to the end of the history.
export const isFeedLoading = (state: Maybe<FeedLoadState>) =>
  state?.status === "loading" || state?.status === "searching"

const makeFeedLoader = (load: () => Promise<FeedSpan>) => {
  const state = writable<FeedLoadState>({status: "idle"})

  let running = false

  const run = async () => {
    if (running || get(state).status === "exhausted") return

    running = true

    try {
      for (let span = 0; span < SPANS_PER_TRIGGER; span++) {
        state.set({status: span > 0 ? "searching" : "loading"})

        const {found, complete, exhausted} = await load()

        if (exhausted) {
          state.set({status: "exhausted"})
          return
        }

        // A span nobody answered for hasn't moved the window, so hold here rather than walking
        // past it, and give the socket a moment before the scroller comes back around
        if (!complete) {
          await sleep(ms(3))
          break
        }

        if (found > 0) break
      }
    } finally {
      running = false
    }
  }

  // A run covers a few spans and the scroller starts another one a moment later, so settling at
  // the end of a run blinks the spinner once per page. What ends a load is the trigger going
  // quiet — the list grown long enough that nothing more is wanted.
  const settle = () => {
    if (!running && isFeedLoading(get(state))) {
      state.set({status: "idle"})
    }
  }

  return {subscribe: state.subscribe, run, settle}
}

// A loader triggered by proximity to the end of a scroll container, which is how every list in
// the app pages. The container's orientation decides which direction `reverse` reaches, so the
// caller passes it — a reversed chat scrolls away from its origin to find older messages, an
// ordinary feed scrolls toward the end of its own content.
export const makeScrollLoader = (
  element: HTMLElement,
  load: () => Promise<FeedSpan>,
  options: Partial<ScrollerOpts> = {},
) => {
  const loader = makeFeedLoader(load)
  const scroller = createScroller({
    element,
    delay: 300,
    threshold: 5000,
    ...options,
    onScroll: loader.run,
    onSettle: loader.settle,
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

  // Events from further back than the feed has reached. Everything the app does fills the same
  // repository — a space-wide sync reconciling a month of every room at once, most of all — and
  // putting each of those on screen as it lands is what walks a room backwards under the reader.
  const held = new Map<string, TrustedEvent>()

  // The span the relays have been asked about, which grows outward from the anchor
  let oldest = at
  let newest = at
  let interval = int(MONTH)

  // How far back the feed has been answered for, which is what decides whether an event is ready
  // to render or has to wait for the window to come and get it.
  let reached = at

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

  // What arrives from elsewhere in the app, which is only rendered as far back as the feed has
  // got to on its own
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

  // Take the feed back to `timestamp`, releasing everything that had arrived for the stretch
  // between there and where it had got to
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

  // One request per direction, reported per relay as well as in total: each relay answers a
  // limit for itself, so a page only runs out where the relay that gave the least of it ran out.
  const loadSpan = async (extension: Filter) => {
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
    }

    const found = await network.get().request({
      relays,
      autoClose: true,
      signal: controller.signal,
      threshold: SPAN_THRESHOLD,
      filters: filters.map(filter => ({...filter, ...extension})),
      onEvent: countEvent,
      onDuplicate: countEvent,
      onEose: () => {
        complete = true
      },
    })

    // A span that turns up nothing widens the next one, so walking a sparse history doesn't
    // take dozens of round trips
    if (complete) {
      interval = found.length > 0 ? int(MONTH) : Math.round(interval * 1.5)
    }

    return {found, complete, pages}
  }

  // Ask for the next span in each direction. A span that comes back empty is normal while
  // walking a sparse history, so the count is reported separately from whether there is any
  // history left — a caller watching its list for changes would never hear about an empty one.
  // The window only moves once the relays have answered: a request the socket dropped looks
  // exactly like an empty span, and walking past it would leave a hole nothing goes back for.
  const loadOlder = async (): Promise<FeedSpan> => {
    if (oldest < now() - int(2, YEAR)) return {found: 0, complete: true, exhausted: true}

    const until = oldest
    const since = until - interval
    const {found, complete, pages} = await loadSpan({since, until, limit: PAGE_SIZE})

    // A relay that answered with less than it was allowed has covered its whole span and holds
    // nothing back, so the page runs out at the highest of the rest
    let edge: Maybe<number>

    for (const page of pages.values()) {
      if (page.count >= PAGE_SIZE && (edge === undefined || page.lowest > edge)) {
        edge = page.lowest
      }
    }

    if (complete) {
      // The second the edge steps back is what stops a page that filled up inside one from being
      // asked for over and over
      oldest = edge === undefined ? since : Math.min(edge, until - 1)
    }

    insertEvents(found)
    reach(oldest)

    return {found: found.length, complete, exhausted: false}
  }

  // A limit is answered with the newest events matching it, which reaches away from an anchor in
  // the past rather than toward it, so this direction walks spans as it always has
  const loadNewer = async (): Promise<FeedSpan> => {
    if (newest >= now()) return {found: 0, complete: true, exhausted: true}

    const since = newest
    const until = Math.min(now(), since + interval)
    const {found, complete} = await loadSpan({since, until})

    if (complete) {
      newest = until
    }

    insertEvents(found)

    return {found: found.length, complete, exhausted: false}
  }

  // What the repository already holds for these relays is in hand and goes in as one insert,
  // which takes the window back with it rather than leaving the rest of that stretch behind
  const cached = relays.flatMap(url => Array.from(getEventsForUrl(url, filters)))

  for (const event of cached) {
    reached = Math.min(reached, event.created_at)
  }

  insertEvents(cached)

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

  const compareByStart = (a: TrustedEvent, b: TrustedEvent) =>
    getStart(a) - getStart(b) || compareEventsAsc(a, b)

  const events = writable(
    uniqBy(
      e => e.id,
      relays.flatMap(url => Array.from(getEventsForUrl(url, filters))),
    ).sort(compareByStart),
  )

  const insertEvents = (newEvents: TrustedEvent[]) => {
    const valid = newEvents.filter(e => !isNaN(getStart(e)) && !isNaN(getEnd(e)) && !seen.has(e.id))

    if (valid.length === 0) return

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

  // Calendar events are addressable and often relayed on from elsewhere, so this feed takes any
  // matching event rather than only those seen on its own relays
  const unsubscribers = syncFeed({
    relays,
    filters,
    addEvents: insertEvents,
    removeEvents,
    requireRelay: false,
  })

  const loadTimeframe = async (since: number, until: number) => {
    let complete = false

    const found = await network.get().request({
      relays,
      autoClose: true,
      signal: controller.signal,
      threshold: SPAN_THRESHOLD,
      filters: [{kinds: [EVENT_TIME], "#D": daysBetween(since, until).map(String)}],
      onEose: () => {
        complete = true
      },
    })

    return {found: found.length, complete}
  }

  const loadOlder = async (): Promise<FeedSpan> => {
    if (oldest < now() - int(2, YEAR)) return {found: 0, complete: true, exhausted: true}

    const until = oldest
    const since = until - interval
    const {found, complete} = await loadTimeframe(since, until)

    if (complete) {
      oldest = since
    }

    return {found, complete, exhausted: false}
  }

  const loadNewer = async (): Promise<FeedSpan> => {
    if (newest > now() + int(2, YEAR)) return {found: 0, complete: true, exhausted: true}

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
    // The month and week views jump to arbitrary ranges rather than scrolling through them, and
    // wait on the request so they can show progress for the range on screen
    load: loadTimeframe,
    cleanup: () => {
      controller.abort()
      unsubscribers.forEach(call)
    },
  }
}
