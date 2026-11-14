import {derived} from "svelte/store"
import type {Readable} from "svelte/store"
import {Events} from "@welshman/app"
import {TimeEvent} from "@welshman/domain"
import {DAY, MONTH, YEAR, int, ms, now, range} from "@welshman/lib"
import {EVENT_TIME, compareEventsAsc, getAddress} from "@welshman/util"
import type {TrustedEvent} from "@welshman/util"
import {makePager} from "@lib/pager"
import type {PageResult, Pager} from "@lib/pager"
import {app} from "@app/core/app"
import {reader} from "@app/core/domain"
import {network} from "@app/core/plugins"
import {isPastHistory} from "@app/features/feeds/windows"

export type CalendarFeedOptions = {url: string; onEvent?: (event: TrustedEvent) => void}

export type CalendarFeed = {
  events: Readable<TrustedEvent[]>
  older: Pager
  newer: Pager
  load: (since: number, until: number) => Promise<void>
  stop: () => void
}

type CalendarEntry = {event: TrustedEvent; start: number}

export const makeCalendarFeed = (options: CalendarFeedOptions): CalendarFeed => {
  const {url, onEvent} = options

  const source = app
    .get()
    .use(Events)
    .byIdForUrl(url, [{kinds: [EVENT_TIME]}])
  const controller = new AbortController()
  const reported = new Set<string>()

  let olderCursor = now()
  let newerCursor = now()

  const getEntry = (event: TrustedEvent): CalendarEntry | undefined => {
    // A reader throws on an event of another kind, and the source can hold whatever the relay sent.
    if (event.kind === EVENT_TIME) {
      const time = reader(TimeEvent)(event)
      const start = time.start()

      if (start && time.end()) {
        return {event, start}
      }
    }
  }

  const events = derived(source.$, $events => {
    const byAddress = new Map<string, CalendarEntry>()

    for (const event of $events.values()) {
      const entry = getEntry(event)

      if (entry) {
        const address = getAddress(event)
        const current = byAddress.get(address)

        if (!current || current.event.created_at < event.created_at) {
          byAddress.set(address, entry)
        }
      }
    }

    const entries = Array.from(byAddress.values())

    entries.sort((a, b) => a.start - b.start || compareEventsAsc(a.event, b.event))

    return entries.map(entry => entry.event)
  })

  const requestDays = async (since: number, until: number) => {
    let answered = false

    const days = Array.from(range(since, until, DAY), t => String(Math.floor(t / DAY)))

    const loaded = await network.get().load({
      relays: [url],
      priority: 1,
      // A relay can accept the request and never send EOSE, so the window needs a ceiling.
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(ms(3))]),
      threshold: 0.8,
      filters: [{kinds: [EVENT_TIME], "#D": days}],
      onEose: () => {
        answered = true
      },
    })

    return {found: loaded.length, answered}
  }

  const loadOlder = async (): Promise<PageResult> => {
    if (isPastHistory(olderCursor)) {
      return {found: 0, answered: true, exhausted: true, behind: false}
    }

    const since = olderCursor - int(5, MONTH)
    const {found, answered} = await requestDays(since, olderCursor)

    if (answered) {
      olderCursor = since
    }

    return {found, answered, exhausted: false, behind: false}
  }

  const loadNewer = async (): Promise<PageResult> => {
    if (newerCursor > now() + int(2, YEAR)) {
      return {found: 0, answered: true, exhausted: true, behind: false}
    }

    const until = newerCursor + int(5, MONTH)
    const {found, answered} = await requestDays(newerCursor, until)

    if (answered) {
      newerCursor = until
    }

    return {found, answered, exhausted: false, behind: false}
  }

  const load = async (since: number, until: number) => {
    await requestDays(since, until)
  }

  const stopEvents = events.subscribe($events => {
    for (const event of $events) {
      if (!reported.has(event.id)) {
        reported.add(event.id)
        onEvent?.(event)
      }
    }
  })

  const stop = () => {
    controller.abort()
    stopEvents()
  }

  return {events, older: makePager(loadOlder), newer: makePager(loadNewer), load, stop}
}
