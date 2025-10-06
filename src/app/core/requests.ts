import {get, writable} from "svelte/store"
import {
  partition,
  uniq,
  int,
  YEAR,
  DAY,
  insertAt,
  sortBy,
  assoc,
  now,
  isNotNil,
  filterVals,
  fromPairs,
} from "@welshman/lib"
import {
  DELETE,
  EVENT_TIME,
  AUTH_INVITE,
  ALERT_EMAIL,
  ALERT_WEB,
  ALERT_IOS,
  ALERT_ANDROID,
  ALERT_STATUS,
  matchFilters,
  getTagValues,
  getTagValue,
  getAddress,
  isShareableRelayUrl,
  getRelaysFromList,
} from "@welshman/util"
import type {TrustedEvent, Filter, List} from "@welshman/util"
import {feedFromFilters, makeRelayFeed, makeIntersectionFeed} from "@welshman/feeds"
import {load, request} from "@welshman/net"
import type {AppSyncOpts, Thunk} from "@welshman/app"
import {
  repository,
  pull,
  hasNegentropy,
  thunkQueue,
  makeFeedController,
  loadRelay,
} from "@welshman/app"
import {createScroller} from "@lib/html"
import {daysBetween} from "@lib/util"
import {NOTIFIER_RELAY, getUrlsForEvent} from "@app/core/state"

// Utils

export const pullConservatively = ({relays, filters}: AppSyncOpts) => {
  const $getUrlsForEvent = get(getUrlsForEvent)
  const [smart, dumb] = partition(hasNegentropy, relays)
  const promises = [pull({relays: smart, filters})]
  const allEvents = repository.query(filters, {shouldSort: false})

  // Since pulling from relays without negentropy is expensive, limit how many
  // duplicates we repeatedly download
  for (const url of dumb) {
    const events = allEvents.filter(e => $getUrlsForEvent(e.id).includes(url))

    if (events.length > 100) {
      filters = filters.map(assoc("since", events[10]!.created_at))
    }

    promises.push(pull({relays: [url], filters}))
  }

  return Promise.all(promises)
}

export const makeFeed = ({
  relays,
  feedFilters,
  subscriptionFilters,
  element,
  onEvent,
  onExhausted,
  initialEvents = [],
}: {
  relays: string[]
  feedFilters: Filter[]
  subscriptionFilters: Filter[]
  element: HTMLElement
  onEvent?: (event: TrustedEvent) => void
  onExhausted?: () => void
  initialEvents?: TrustedEvent[]
}) => {
  const seen = new Set<string>()
  const buffer = writable<TrustedEvent[]>([])
  const events = writable(initialEvents)
  const controller = new AbortController()

  const markEvent = (event: TrustedEvent) => {
    if (!seen.has(event.id)) {
      seen.add(event.id)
      onEvent?.(event)
    }
  }

  const insertEvent = (event: TrustedEvent) => {
    let handled = false

    events.update($events => {
      for (let i = 0; i < $events.length; i++) {
        if ($events[i].id === event.id) return $events
        if ($events[i].created_at < event.created_at) {
          handled = true
          return insertAt(i, event, $events)
        }
      }

      return $events
    })

    if (!handled) {
      buffer.update($buffer => {
        for (let i = 0; i < $buffer.length; i++) {
          if ($buffer[i].id === event.id) return $buffer
          if ($buffer[i].created_at < event.created_at) return insertAt(i, event, $buffer)
        }

        return [...$buffer, event]
      })
    }

    markEvent(event)
  }

  const removeEvents = (ids: string[]) => {
    buffer.update($buffer => $buffer.filter(e => !ids.includes(e.id)))
    events.update($events => $events.filter(e => !ids.includes(e.id)))
  }

  const handleDelete = (e: TrustedEvent) => removeEvents(getTagValues(["e", "a"], e.tags))

  const onThunk = (thunk: Thunk) => {
    if (matchFilters(feedFilters, thunk.event)) {
      insertEvent(thunk.event)

      thunk.controller.signal.addEventListener("abort", () => {
        removeEvents([thunk.event.id])
      })
    } else if (thunk.event.kind === DELETE) {
      handleDelete(thunk.event)
    }
  }

  const ctrl = makeFeedController({
    useWindowing: true,
    feed: makeIntersectionFeed(makeRelayFeed(...relays), feedFromFilters(feedFilters)),
    onEvent: insertEvent,
    onExhausted,
  })

  for (const event of initialEvents) {
    markEvent(event)
  }

  request({
    relays,
    signal: controller.signal,
    filters: subscriptionFilters,
    onEvent: (e: TrustedEvent) => {
      if (matchFilters(feedFilters, e)) insertEvent(e)
      if (e.kind === DELETE) handleDelete(e)
    },
  })

  const scroller = createScroller({
    element,
    delay: 300,
    threshold: 10_000,
    onScroll: async () => {
      const $buffer = get(buffer)

      events.update($events => sortBy(e => -e.created_at, [...$events, ...$buffer.splice(0, 100)]))

      if ($buffer.length < 100) {
        ctrl.load(100)
      }
    },
  })

  const unsubscribe = thunkQueue.subscribe(onThunk)

  return {
    events,
    cleanup: () => {
      unsubscribe()
      scroller.stop()
      controller.abort()
    },
  }
}

export const makeCalendarFeed = ({
  relays,
  feedFilters,
  subscriptionFilters,
  element,
  onExhausted,
  initialEvents = [],
}: {
  relays: string[]
  feedFilters: Filter[]
  subscriptionFilters: Filter[]
  element: HTMLElement
  onExhausted?: () => void
  initialEvents?: TrustedEvent[]
}) => {
  const interval = int(5, DAY)
  const controller = new AbortController()

  let exhaustedScrollers = 0
  let backwardWindow = [now() - interval, now()]
  let forwardWindow = [now(), now() + interval]

  const getStart = (event: TrustedEvent) => parseInt(getTagValue("start", event.tags) || "")

  const getEnd = (event: TrustedEvent) => parseInt(getTagValue("end", event.tags) || "")

  const events = writable(sortBy(getStart, initialEvents))

  const insertEvent = (event: TrustedEvent) => {
    const start = getStart(event)
    const address = getAddress(event)

    if (isNaN(start) || isNaN(getEnd(event))) return

    events.update($events => {
      for (let i = 0; i < $events.length; i++) {
        if ($events[i].id === event.id) return $events
        if (getStart($events[i]) > start) return insertAt(i, event, $events)
      }

      return [...$events.filter(e => getAddress(e) !== address), event]
    })
  }

  const removeEvents = (ids: string[]) => {
    events.update($events => $events.filter(e => !ids.includes(e.id)))
  }

  const onThunk = (thunk: Thunk) => {
    if (matchFilters(feedFilters, thunk.event)) {
      insertEvent(thunk.event)

      thunk.controller.signal.addEventListener("abort", () => {
        removeEvents([thunk.event.id])
      })
    }
  }

  request({
    relays,
    signal: controller.signal,
    filters: subscriptionFilters,
    onEvent: (e: TrustedEvent) => {
      if (matchFilters(feedFilters, e)) insertEvent(e)
    },
  })

  const loadTimeframe = (since: number, until: number) => {
    const hashes = daysBetween(since, until).map(String)

    request({
      relays,
      signal: controller.signal,
      autoClose: true,
      filters: [{kinds: [EVENT_TIME], "#D": hashes}],
      onEvent: insertEvent,
    })
  }

  const maybeExhausted = () => {
    if (++exhaustedScrollers === 2) {
      onExhausted?.()
    }
  }

  const backwardScroller = createScroller({
    element,
    reverse: true,
    onScroll: () => {
      const [since, until] = backwardWindow

      backwardWindow = [since - interval, since]

      if (until > now() - int(2, YEAR)) {
        loadTimeframe(since, until)
      } else {
        backwardScroller.stop()
        maybeExhausted()
      }
    },
  })

  const forwardScroller = createScroller({
    element,
    onScroll: () => {
      const [since, until] = forwardWindow

      forwardWindow = [until, until + interval]

      if (until < now() + int(2, YEAR)) {
        loadTimeframe(since, until)
      } else {
        forwardScroller.stop()
        maybeExhausted()
      }
    },
  })

  const unsubscribe = thunkQueue.subscribe(onThunk)

  return {
    events,
    cleanup: () => {
      backwardScroller.stop()
      forwardScroller.stop()
      controller.abort()
      unsubscribe()
    },
  }
}

// Domain specific

export const loadAlerts = (pubkey: string) =>
  load({
    relays: [NOTIFIER_RELAY],
    filters: [{kinds: [ALERT_EMAIL, ALERT_WEB, ALERT_IOS, ALERT_ANDROID], authors: [pubkey]}],
  })

export const loadAlertStatuses = (pubkey: string) =>
  load({
    relays: [NOTIFIER_RELAY],
    filters: [{kinds: [ALERT_STATUS], "#p": [pubkey]}],
  })

export const discoverRelays = (lists: List[]) =>
  Promise.all(
    uniq(lists.flatMap($l => getRelaysFromList($l)))
      .filter(isShareableRelayUrl)
      .map(url => loadRelay(url)),
  )

export const requestRelayClaim = async (url: string) => {
  const filters = [{kinds: [AUTH_INVITE], limit: 1}]
  const events = await load({filters, relays: [url]})

  if (events.length > 0) {
    return getTagValue("claim", events[0].tags)
  }
}

export const requestRelayClaims = async (urls: string[]) =>
  filterVals(
    isNotNil,
    fromPairs(await Promise.all(urls.map(async url => [url, await requestRelayClaim(url)]))),
  )
