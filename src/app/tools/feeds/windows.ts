import {YEAR, ago, max, now} from "@welshman/lib"
import {matchFilter, sortEventsDesc} from "@welshman/util"
import {RelayReasonPrefix, matchReason} from "@welshman/net"
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

export type WindowResponse = WindowResult & {floor?: number}

export type OlderCursor = {until: number; interval: number}

export type NewerCursor = {since: number; interval: number}

// Every relay pages back through the same windows of time, so a fast relay's old events can't reach the feed ahead of a slower relay's recent ones.
export const olderWalk = (until: number, base: number): Walk<OlderCursor, WindowResponse> => ({
  start: {until, interval: base},
  isDone: cursor => isPastHistory(cursor.until),
  getWindow: cursor => ({since: cursor.until - cursor.interval, until: cursor.until}),
  // Stepping a second under the old until keeps a window whose events all sit at until from repeating.
  advance: (cursor, window, {found, floor}) => ({
    until: floor !== undefined ? Math.min(floor, window.until - 1) : window.since,
    interval: nextInterval(base, cursor.interval, found),
  }),
})

export const newerWalk = (since: number, base: number): Walk<NewerCursor, WindowResponse> => ({
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
}: WindowRequest): Promise<WindowResponse> => {
  // The oldest event each filter has brought, since each filter's limit cuts its own page.
  const oldestByFilter = new Map<number, number>()

  let complete = false
  let retry = false

  const track = (event: TrustedEvent) => {
    filters.forEach((filter, i) => {
      if (matchFilter(filter, event)) {
        oldestByFilter.set(i, Math.min(oldestByFilter.get(i) ?? event.created_at, event.created_at))
      }
    })

    // Relays send each filter's events in turn, newest first, so once each has sent something the window is complete above the highest of their oldest.
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
    signal,
    onEvent: track,
    onDuplicate: track,
    onEose: () => {
      complete = true
    },
    // A relay that wants auth may serve the window once it has it
    onClosed: reason => {
      if (matchReason(RelayReasonPrefix.AuthRequired, reason)) {
        retry = true
      }
    },
  })

  // A filter that sent nothing has nothing in the window, so only the others bound where it is complete.
  const floor = oldestByFilter.size > 0 ? max(Array.from(oldestByFilter.values())) : undefined

  return {found: events.length, complete, retry, floor}
}
