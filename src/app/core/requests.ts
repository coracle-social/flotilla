import {get, writable} from "svelte/store"
import {
  call,
  uniq,
  int,
  YEAR,
  DAY,
  insertAt,
  sortBy,
  now,
  on,
  isDefined,
  filterVals,
  fromPairs,
} from "@welshman/lib"
import {
  EVENT_TIME,
  RELAY_INVITE,
  matchFilters,
  getTagValue,
  getAddress,
  isShareableRelayUrl,
  getRelaysFromList,
} from "@welshman/util"
import type {TrustedEvent, Filter, List} from "@welshman/util"
import {feedFromFilters, makeRelayFeed, makeIntersectionFeed} from "@welshman/feeds"
import {load, request} from "@welshman/net"
import {repository, makeFeedController, loadRelay, tracker} from "@welshman/app"
import {createScroller} from "@lib/html"
import {daysBetween} from "@lib/util"
import {getEventsForUrl} from "@app/core/state"

// Utils

export const makeFeed = ({
  url,
  filters,
  element,
  onExhausted,
}: {
  url: string
  filters: Filter[]
  element: HTMLElement
  onExhausted?: () => void
}) => {
  const seen = new Set<string>()
  const controller = new AbortController()
  const buffer = writable<TrustedEvent[]>([])
  const events = writable<TrustedEvent[]>([])

  const insertEvent = (event: TrustedEvent) => {
    let handled = false

    if (seen.has(event.id)) {
      return
    }

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

    seen.add(event.id)
  }

  const unsubscribers = [
    on(repository, "update", ({added, removed}) => {
      if (removed.size > 0) {
        buffer.update($buffer => $buffer.filter(e => !removed.has(e.id)))
        events.update($events => $events.filter(e => !removed.has(e.id)))
      }

      for (const event of added) {
        if (matchFilters(filters, event) && tracker.getRelays(event.id).has(url)) {
          insertEvent(event)
        }
      }
    }),
    on(tracker, "add", (id: string, trackerUrl: string) => {
      if (trackerUrl === url) {
        const event = repository.getEvent(id)

        if (event && matchFilters(filters, event)) {
          insertEvent(event)
        }
      }
    }),
  ]

  const ctrl = makeFeedController({
    useWindowing: true,
    signal: controller.signal,
    feed: makeIntersectionFeed(makeRelayFeed(url), feedFromFilters(filters)),
    onExhausted,
  })

  const scroller = createScroller({
    element,
    delay: 300,
    threshold: 10_000,
    onScroll: async () => {
      const $buffer = get(buffer)

      events.update($events => [...$events, ...$buffer.splice(0, 30)])

      if ($buffer.length < 100) {
        ctrl.load(100)
      }
    },
  })

  for (const event of getEventsForUrl(url, filters)) {
    insertEvent(event)
  }

  return {
    events,
    cleanup: () => {
      scroller.stop()
      controller.abort()
      unsubscribers.forEach(call)
    },
  }
}

export const makeCalendarFeed = ({
  url,
  filters,
  element,
  onExhausted,
}: {
  url: string
  filters: Filter[]
  element: HTMLElement
  onExhausted?: () => void
}) => {
  const interval = int(5, DAY)
  const controller = new AbortController()

  let exhaustedScrollers = 0
  let backwardWindow = [now() - interval, now()]
  let forwardWindow = [now(), now() + interval]

  const getStart = (event: TrustedEvent) => parseInt(getTagValue("start", event.tags) || "")

  const getEnd = (event: TrustedEvent) => parseInt(getTagValue("end", event.tags) || "")

  const events = writable(sortBy(getStart, getEventsForUrl(url, filters)))

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

  const unsubscribers = [
    on(repository, "update", ({added, removed}) => {
      if (removed.size > 0) {
        events.update($events => $events.filter(e => !removed.has(e.id)))
      }

      for (const event of added) {
        if (matchFilters(filters, event)) {
          insertEvent(event)
        }
      }
    }),
    on(tracker, "add", (id: string, trackerUrl: string) => {
      if (trackerUrl === url) {
        const event = repository.getEvent(id)

        if (event && matchFilters(filters, event)) {
          insertEvent(event)
        }
      }
    }),
  ]

  const loadTimeframe = (since: number, until: number) => {
    const hashes = daysBetween(since, until).map(String)

    request({
      relays: [url],
      autoClose: true,
      signal: controller.signal,
      filters: [{kinds: [EVENT_TIME], "#D": hashes}],
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

  return {
    events,
    cleanup: () => {
      controller.abort()
      forwardScroller.stop()
      backwardScroller.stop()
      unsubscribers.forEach(call)
    },
  }
}

// Domain specific

export const discoverRelays = (lists: List[]) =>
  Promise.all(
    uniq(lists.flatMap($l => getRelaysFromList($l)))
      .filter(isShareableRelayUrl)
      .map(url => loadRelay(url)),
  )

export const requestRelayClaim = async (url: string) => {
  const filters = [{kinds: [RELAY_INVITE], limit: 1}]
  const events = await load({filters, relays: [url]})

  if (events.length > 0) {
    return getTagValue("claim", events[0].tags)
  }
}

export const requestRelayClaims = async (urls: string[]) =>
  filterVals(
    isDefined,
    fromPairs(await Promise.all(urls.map(async url => [url, await requestRelayClaim(url)]))),
  )
