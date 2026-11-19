import {YEAR, ago, max, now} from "@welshman/lib"
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

export type WindowAnswer = WindowResult & {edge?: number}

export type OlderCursor = {until: number; interval: number}

export type NewerCursor = {since: number; interval: number}

export const olderWalk = (until: number, base: number): Walk<OlderCursor, WindowAnswer> => ({
  start: {until, interval: base},
  isDone: cursor => isPastHistory(cursor.until),
  getWindow: cursor => ({since: cursor.until - cursor.interval, until: cursor.until}),
  // Stepping a second under the old until keeps a page that filled up inside one window from being asked for twice.
  advance: (cursor, window, {found, edge}) => ({
    until: edge === undefined ? window.since : Math.min(edge, window.until - 1),
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

// How many events each relay has sent in a window, and the oldest of them.
type RelayPages = Map<string, {count: number; lowest: number}>

const countEvent = (pages: RelayPages, url: string, event: TrustedEvent) => {
  const page = pages.get(url)

  pages.set(url, {
    count: (page?.count ?? 0) + 1,
    lowest: Math.min(page?.lowest ?? event.created_at, event.created_at),
  })
}

// Relays send newest first, so once each has sent something the window is complete above the highest of their oldest.
const getCovered = (pages: RelayPages, relayCount: number) => {
  if (pages.size === relayCount) {
    return max(Array.from(pages.values(), page => page.lowest))
  }
}

// A relay that filled its page has more below its oldest event, so the window is only done above the highest of those.
const getEdge = (pages: RelayPages, limit?: number) => {
  if (limit) {
    const fullPages = Array.from(pages.values()).filter(page => page.count >= limit)

    if (fullPages.length > 0) {
      return max(fullPages.map(page => page.lowest))
    }
  }
}

export type WindowRequest = {
  relays: string[]
  filters: Filter[]
  window: Window
  limit?: number
  quorum: number
  signal: AbortSignal
  onCover?: (timestamp: number) => void
}

export const requestWindow = async ({
  relays,
  filters,
  window,
  limit,
  quorum,
  signal,
  onCover,
}: WindowRequest): Promise<WindowAnswer> => {
  const pages: RelayPages = new Map()
  const relayCount = new Set(relays).size

  let answered = false

  const count = (event: TrustedEvent, url: string) => {
    countEvent(pages, url, event)

    const covered = getCovered(pages, relayCount)

    if (onCover && covered !== undefined) {
      onCover(covered)
    }
  }

  const events = await network.get().load({
    relays,
    filters: filters.map(filter =>
      limit ? {...filter, ...window, limit} : {...filter, ...window},
    ),
    // The socket sends five requests per 100ms first come first served, so the feed on screen goes first.
    priority: 1,
    threshold: quorum,
    // A relay can accept a socket and never send EOSE, so the window has a short ceiling.
    signal: AbortSignal.any([signal, AbortSignal.timeout(3000)]),
    onEvent: count,
    onDuplicate: count,
    onEose: () => {
      answered = true
    },
  })

  return {found: events.length, answered, edge: getEdge(pages, limit)}
}
