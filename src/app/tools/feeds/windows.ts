import {YEAR, ago, max, now} from "@welshman/lib"
import {matchFilter, sortEventsDesc} from "@welshman/util"
import type {Filter, TrustedEvent} from "@welshman/util"
import type {Walk, Window, WindowResult} from "@lib/pager"
import {network} from "@app/core/plugins"

export const WINDOW_LIMIT = 100

// A window that found something sets the size back to the feed's own, and an empty one widens the next.
export const nextInterval = (base: number, interval: number, found: number) =>
  found > 0 ? base : Math.round(interval * 1.5)

export const isPastHistory = (timestamp: number) => timestamp < ago(2, YEAR)

export const getCacheFloor = (events: Iterable<TrustedEvent>) => {
  const newestFirst = sortEventsDesc(events)

  if (newestFirst.length > 0) {
    return newestFirst[Math.min(WINDOW_LIMIT, newestFirst.length) - 1].created_at
  }
}

export type WindowAnswer = WindowResult & {floor?: number}

export type OlderCursor = {until: number}

// An older page asks for the newest events below until, with no lower bound.
export type OlderWindow = Pick<Window, "until">

export type NewerCursor = {since: number; interval: number}

// A page is the newest events below until, so the next starts at its oldest, and an empty one leaves nothing below.
export const olderWalk = (until: number): Walk<OlderCursor, WindowAnswer, OlderWindow> => ({
  start: {until},
  isDone: cursor => cursor.until === 0,
  getWindow: cursor => ({until: cursor.until}),
  // Stepping a second under the old until keeps a page whose events all sit at until from repeating.
  advance: (_, window, {floor}) => ({until: floor ? Math.min(floor, window.until - 1) : 0}),
})

export const newerWalk = (since: number, base: number): Walk<NewerCursor, WindowAnswer> => ({
  start: {since, interval: base},
  isDone: cursor => cursor.since >= now(),
  getWindow: cursor => ({
    since: cursor.since,
    until: Math.min(now(), cursor.since + cursor.interval),
  }),
  advance: (cursor, window, {found}) => ({
    since: window.until,
    interval: nextInterval(base, cursor.interval, found),
  }),
})

export type WindowRequest = {
  url: string
  filters: Filter[]
  window: Partial<Window>
  limit?: number
  signal: AbortSignal
  onCover?: (timestamp: number) => void
}

export const requestWindow = async ({
  url,
  filters,
  window,
  limit,
  signal,
  onCover,
}: WindowRequest): Promise<WindowAnswer> => {
  // The oldest event each filter has brought, since each filter's limit cuts its own page.
  const oldestByFilter = new Map<number, number>()

  let answered = false

  const track = (event: TrustedEvent) => {
    filters.forEach((filter, i) => {
      if (matchFilter(filter, event)) {
        oldestByFilter.set(i, Math.min(oldestByFilter.get(i) ?? event.created_at, event.created_at))
      }
    })

    // Relays answer filters one after another, newest first, so once each has sent something the window is complete above the highest of their oldest.
    if (onCover && oldestByFilter.size === filters.length) {
      onCover(max(Array.from(oldestByFilter.values())))
    }
  }

  const events = await network.get().load({
    relays: [url],
    filters: filters.map(filter =>
      limit ? {...filter, ...window, limit} : {...filter, ...window},
    ),
    // The socket sends five requests per 100ms first come first served, so the feed on screen goes first.
    priority: 1,
    // A relay can accept a socket and never send EOSE, so the window has a short ceiling.
    signal: AbortSignal.any([signal, AbortSignal.timeout(3000)]),
    onEvent: track,
    onDuplicate: track,
    onEose: () => {
      answered = true
    },
  })

  // A filter that sent nothing has nothing in the window, so only the others bound where it is complete.
  const floor = oldestByFilter.size > 0 ? max(Array.from(oldestByFilter.values())) : undefined

  return {found: events.length, answered, floor}
}
