import {get, writable} from "svelte/store"
import {partition, int, YEAR, MONTH, insert, sortBy, assoc, now} from "@welshman/lib"
import {
  MESSAGE,
  DELETE,
  THREAD,
  EVENT_TIME,
  COMMENT,
  matchFilters,
  getTagValues,
} from "@welshman/util"
import type {TrustedEvent, Filter} from "@welshman/util"
import {feedFromFilters, makeRelayFeed, makeIntersectionFeed} from "@welshman/feeds"
import type {Subscription} from "@welshman/net"
import type {AppSyncOpts, Thunk} from "@welshman/app"
import {
  subscribe,
  load,
  repository,
  pull,
  hasNegentropy,
  thunkWorker,
  createFeedController,
} from "@welshman/app"
import {createScroller} from "@lib/html"
import {daysBetween} from "@lib/util"
import {userRoomsByUrl, getUrlsForEvent} from "@app/state"

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
  const buffer = writable<TrustedEvent[]>([])
  const events = writable(initialEvents)

  const insertEvent = (event: TrustedEvent) => {
    buffer.update($buffer => {
      for (let i = 0; i < $buffer.length; i++) {
        if ($buffer[i].id === event.id) return $buffer
        if ($buffer[i].created_at < event.created_at) return insert(i, event, $buffer)
      }

      return [...$buffer, event]
    })
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

  const ctrl = createFeedController({
    useWindowing: true,
    feed: makeIntersectionFeed(makeRelayFeed(...relays), feedFromFilters(feedFilters)),
    onEvent: insertEvent,
    onExhausted,
  })

  const sub = subscribe({
    relays,
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

  thunkWorker.addGlobalHandler(onThunk)

  return {
    events,
    cleanup: () => {
      sub.close()
      scroller.stop()
      thunkWorker.removeGlobalHandler(onThunk)
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
  const events = writable(initialEvents)

  let backwardWindow = [now() - MONTH, now()]
  let forwardWindow = [now(), now() + MONTH]

  const insertEvent = (event: TrustedEvent) => {
    events.update($events => {
      for (let i = 0; i < $events.length; i++) {
        if ($events[i].id === event.id) return $events
        if ($events[i].created_at < event.created_at) return insert(i, event, $events)
      }

      return [...$events, event]
    })
  }

  const removeEvents = (ids: string[]) => {
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

  const sub = subscribe({
    relays,
    filters: subscriptionFilters,
    onEvent: (e: TrustedEvent) => {
      if (matchFilters(feedFilters, e)) insertEvent(e)
      if (e.kind === DELETE) handleDelete(e)
    },
  })

  const loadTimeframe = (since: number, until: number) => {
    const hashes = daysBetween(since, until).map(String)

    console.log(since, until, hashes)

    load({
      relays,
      filters: [{kinds: [EVENT_TIME], "#D": hashes}],
      onEvent: insertEvent,
    })
  }

  const backwardScroller = createScroller({
    element,
    reverse: true,
    onScroll: () => {
      const [since, until] = backwardWindow

      backwardWindow = [since - MONTH, since]

      if (until > now() - int(2, YEAR)) {
        loadTimeframe(since, until)
      } else {
        backwardScroller.stop()
      }
    },
  })

  const forwardScroller = createScroller({
    element,
    onScroll: () => {
      const [since, until] = forwardWindow

      forwardWindow = [until, until + MONTH]

      if (until < now() + int(2, YEAR)) {
        loadTimeframe(since, until)
      } else {
        forwardScroller.stop()
      }
    },
  })

  thunkWorker.addGlobalHandler(onThunk)

  return {
    events,
    cleanup: () => {
      thunkWorker.removeGlobalHandler(onThunk)
      backwardScroller.stop()
      forwardScroller.stop()
      sub.close()
    },
  }
}

// Application requests

export const listenForNotifications = () => {
  const subs: Subscription[] = []

  for (const [url, rooms] of userRoomsByUrl.get()) {
    load({
      relays: [url],
      filters: [
        {kinds: [THREAD], limit: 1},
        {kinds: [COMMENT], "#K": [String(THREAD)], limit: 1},
        ...Array.from(rooms).map(room => ({kinds: [MESSAGE], "#h": [room], limit: 1})),
      ],
    })

    subs.push(
      subscribe({
        relays: [url],
        filters: [
          {kinds: [THREAD], since: now()},
          {kinds: [COMMENT], "#K": [String(THREAD)], since: now()},
          ...Array.from(rooms).map(room => ({kinds: [MESSAGE], "#h": [room], since: now()})),
        ],
      }),
    )
  }

  return () => {
    for (const sub of subs) {
      sub.close()
    }
  }
}
