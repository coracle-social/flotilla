import {derived} from "svelte/store"
import {Events} from "@welshman/app"
import {TimeEvent} from "@welshman/domain"
import {DAY, MONTH, YEAR, int, now, range, removeUndefined, uniqBy} from "@welshman/lib"
import {EVENT_TIME, compareEventsAsc, getAddress, sortEventsDesc} from "@welshman/util"
import type {TrustedEvent} from "@welshman/util"
import {RelayReasonPrefix, matchReason} from "@welshman/net"
import {strictOrder} from "@lib/order"
import {makeWalkPager} from "@lib/pager"
import type {Walk, Window, WindowResult} from "@lib/pager"
import {app} from "@app/core/app"
import {reader} from "@app/core/domain"
import {network} from "@app/core/plugins"
import {isPastHistory} from "@app/tools/feeds/windows"

export type CalendarFeedOptions = {url: string}

type CalendarEntry = {event: TrustedEvent; start: number}

const daysBack = (until: number): Walk<number, WindowResult> => ({
  start: until,
  isDone: isPastHistory,
  getWindow: cursor => ({since: cursor - int(MONTH), until: cursor}),
  advance: (_, window) => window.since,
})

const daysAhead = (since: number): Walk<number, WindowResult> => ({
  start: since,
  isDone: cursor => cursor > now() + int(2, YEAR),
  getWindow: cursor => ({since: cursor, until: cursor + int(MONTH)}),
  advance: (_, window) => window.until,
})

// A reader throws on an event of another kind, and the source can hold whatever the relay sent.
const getEntry = (event: TrustedEvent): CalendarEntry | undefined => {
  if (event.kind === EVENT_TIME) {
    const time = reader(TimeEvent)(event)
    const start = time.start()

    if (start && time.end()) {
      return {event, start}
    }
  }
}

const compareEntries = (a: CalendarEntry, b: CalendarEntry) =>
  a.start - b.start || compareEventsAsc(a.event, b.event)

export const makeCalendarFeed = ({url}: CalendarFeedOptions) => {
  const source = app
    .get()
    .use(Events)
    .byIdForUrl(url, [{kinds: [EVENT_TIME]}])
  const controller = new AbortController()

  // An edited event replaces the version before it, which shares its address.
  const latest = derived(source.$, $events =>
    uniqBy(
      entry => getAddress(entry.event),
      removeUndefined(sortEventsDesc($events.values()).map(getEntry)),
    ),
  )

  const events = derived(strictOrder(latest, compareEntries), $entries =>
    $entries.map(entry => entry.event),
  )

  const load = async ({since, until}: Window): Promise<WindowResult> => {
    let complete = false
    let retry = false

    const days = Array.from(range(since, until, DAY), t => String(Math.floor(t / DAY)))

    const loaded = await network.get().load({
      relays: [url],
      priority: 1,
      signal: controller.signal,
      threshold: 0.8,
      filters: [{kinds: [EVENT_TIME], "#D": days}],
      onEose: () => {
        complete = true
      },
      // A relay that wants auth may serve the month once it has it
      onClosed: reason => {
        if (matchReason(RelayReasonPrefix.AuthRequired, reason)) {
          retry = true
        }
      },
    })

    return {found: loaded.length, complete, retry}
  }

  const older = makeWalkPager({walk: daysBack(now()), request: load})
  const newer = makeWalkPager({walk: daysAhead(now()), request: load})

  const stop = () => controller.abort()

  return {events, older, newer, load, stop}
}
