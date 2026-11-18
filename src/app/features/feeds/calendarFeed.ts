import {derived} from "svelte/store"
import {Events} from "@welshman/app"
import {TimeEvent} from "@welshman/domain"
import {DAY, MONTH, YEAR, int, ms, now, range, removeUndefined, sortBy, uniqBy} from "@welshman/lib"
import {EVENT_TIME, compareEventsAsc, getAddress} from "@welshman/util"
import type {TrustedEvent} from "@welshman/util"
import {makePager} from "@lib/pager"
import type {PageResult} from "@lib/pager"
import {app} from "@app/core/app"
import {reader} from "@app/core/domain"
import {network} from "@app/core/plugins"
import {isPastHistory} from "@app/features/feeds/windows"

export type CalendarFeedOptions = {url: string}

type CalendarEntry = {event: TrustedEvent; start: number}

export const makeCalendarFeed = (options: CalendarFeedOptions) => {
  const {url} = options

  const source = app
    .get()
    .use(Events)
    .byIdForUrl(url, [{kinds: [EVENT_TIME]}])
  const controller = new AbortController()

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
    const entries = removeUndefined(Array.from($events.values(), getEntry))
    const newestFirst = sortBy(entry => -entry.event.created_at, entries)
    const latestByAddress = uniqBy(entry => getAddress(entry.event), newestFirst)

    latestByAddress.sort((a, b) => a.start - b.start || compareEventsAsc(a.event, b.event))

    return latestByAddress.map(entry => entry.event)
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

  const stop = () => controller.abort()

  return {events, older: makePager(loadOlder), newer: makePager(loadNewer), load: requestDays, stop}
}
