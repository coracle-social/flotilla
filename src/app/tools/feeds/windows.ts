import {YEAR, ago, now} from "@welshman/lib"
import {sortEventsDesc} from "@welshman/util"
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

export type OlderCursor = {until: number; interval: number}

export type NewerCursor = {since: number; interval: number}

export const olderWalk = (until: number, base: number): Walk<OlderCursor, WindowAnswer> => ({
  start: {until, interval: base},
  isDone: cursor => isPastHistory(cursor.until),
  getWindow: cursor => ({since: cursor.until - cursor.interval, until: cursor.until}),
  // Stepping a second under the old until keeps a window whose events all sit at until from repeating.
  advance: (cursor, window, {found, floor}) => ({
    until: floor !== undefined ? Math.min(floor, window.until - 1) : window.since,
    interval: nextInterval(base, cursor.interval, found),
  }),
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
  window: Window
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
  let answered = false
  let floor: number | undefined

  // Relays send newest first, so the window is complete above the oldest event it has sent so far.
  const track = (event: TrustedEvent) => {
    floor = Math.min(floor ?? event.created_at, event.created_at)

    onCover?.(floor)
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

  return {found: events.length, answered, floor}
}
