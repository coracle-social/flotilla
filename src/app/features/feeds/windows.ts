import {MONTH, YEAR, ago, int, max, sortBy} from "@welshman/lib"
import type {Maybe} from "@welshman/lib"
import type {Filter, TrustedEvent} from "@welshman/util"
import {network} from "@app/core/plugins"

export const WINDOW_LIMIT = 100

export const nextInterval = (interval: number, found: number) =>
  found > 0 ? int(MONTH) : Math.round(interval * 1.5)

export const isPastHistory = (timestamp: number) => timestamp < ago(2, YEAR)

export const getCacheFloor = (events: Iterable<TrustedEvent>) => {
  const newestFirst = sortBy(event => -event.created_at, events)

  if (newestFirst.length > 0) {
    return newestFirst[Math.min(WINDOW_LIMIT, newestFirst.length) - 1].created_at
  }
}

export type RelayPage = {count: number; lowest: number}

export const getWindowEdge = (pages: Map<string, RelayPage>, limit: number) => {
  const full = Array.from(pages.values()).filter(page => page.count >= limit)

  if (full.length > 0) {
    return max(full.map(page => page.lowest))
  }
}

export type WindowRequest = {
  relays: string[]
  filters: Filter[]
  since: number
  until: number
  limit?: number
  quorum: number
  signal: AbortSignal
  onCover?: (timestamp: number) => void
}

export type WindowAnswer = {found: number; answered: boolean; edge: Maybe<number>}

export const requestWindow = async (request: WindowRequest): Promise<WindowAnswer> => {
  const {relays, filters, since, until, limit, quorum, signal, onCover} = request
  const pages = new Map<string, RelayPage>()
  const distinctRelays = new Set(relays).size

  let answered = false

  const count = (event: TrustedEvent, url: string) => {
    const relayPage = pages.get(url)

    pages.set(url, {
      count: (relayPage?.count ?? 0) + 1,
      lowest: Math.min(relayPage?.lowest ?? event.created_at, event.created_at),
    })

    if (onCover && pages.size === distinctRelays) {
      onCover(max(Array.from(pages.values(), page => page.lowest)))
    }
  }

  const windowFilters = filters.map(filter =>
    limit ? {...filter, since, until, limit} : {...filter, since, until},
  )

  const events = await network.get().load({
    relays,
    filters: windowFilters,
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

  return {found: events.length, answered, edge: limit ? getWindowEdge(pages, limit) : undefined}
}
