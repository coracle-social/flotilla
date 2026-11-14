import {derived, get, readable, writable} from "svelte/store"
import type {Readable} from "svelte/store"
import {MONTH, call, int, now, on} from "@welshman/lib"
import type {AsyncProjection, EventsById, RepositoryUpdate} from "@welshman/store"
import {sortEventsAsc} from "@welshman/util"
import type {Filter, TrustedEvent} from "@welshman/util"
import {makePager} from "@lib/pager"
import type {PageResult, Pager} from "@lib/pager"
import {app} from "@app/core/app"
import {
  WINDOW_LIMIT,
  getCacheFloor,
  isPastHistory,
  nextInterval,
  requestWindow,
} from "@app/features/feeds/windows"

export type TimelineOptions = {
  source: AsyncProjection<EventsById>
  relays: string[]
  filters: Filter[]
  at?: number
  quorum: number
  useCache: boolean
  onEvent?: (event: TrustedEvent) => void
}

export type Timeline = {
  events: Readable<TrustedEvent[]>
  older: Pager
  newer: Pager
  stop: () => void
}

// A relay that refuses a publish leaves the source, but the event stays listed with its failure until the repository removes it.
const keepUntilRemoved = (source: AsyncProjection<EventsById>) =>
  readable<EventsById>(new Map(), set => {
    const kept: EventsById = new Map()

    const onUpdate = ({removed}: RepositoryUpdate) => {
      const before = kept.size

      for (const id of removed) {
        kept.delete(id)
      }

      if (kept.size < before) {
        set(kept)
      }
    }

    const unsubscribers = [
      source.$.subscribe($events => {
        for (const [id, event] of $events) {
          kept.set(id, event)
        }

        set(kept)
      }),
      on(app.get().repository, "update", onUpdate),
    ]

    return () => unsubscribers.forEach(call)
  })

export const makeTimeline = (options: TimelineOptions): Timeline => {
  const {source, relays, filters, at = now(), quorum, useCache, onEvent} = options

  const floor = writable(at)
  const controller = new AbortController()
  const reported = new Set<string>()

  let olderCursor = {until: at, interval: int(MONTH)}
  let newerCursor = {since: at, interval: int(MONTH)}

  const lowerFloor = (timestamp: number) => {
    floor.update($floor => Math.min($floor, timestamp))
  }

  const events = derived([keepUntilRemoved(source), floor], ([$events, $floor]) =>
    sortEventsAsc(Array.from($events.values()).filter(event => event.created_at >= $floor)),
  )

  const loadOlder = async (): Promise<PageResult> => {
    const {until, interval} = olderCursor

    if (isPastHistory(until)) {
      return {found: 0, answered: true, exhausted: true, behind: false}
    }

    const since = until - interval
    const {found, answered, edge} = await requestWindow({
      relays,
      filters,
      since,
      until,
      limit: WINDOW_LIMIT,
      quorum,
      signal: controller.signal,
      onCover: lowerFloor,
    })

    if (answered) {
      // Stepping a second under the old until keeps a page that filled up inside one window from being asked for twice.
      const nextUntil = edge === undefined ? since : Math.min(edge, until - 1)

      olderCursor = {until: nextUntil, interval: nextInterval(interval, found)}
    }

    lowerFloor(olderCursor.until)

    return {found, answered, exhausted: false, behind: olderCursor.until > get(floor)}
  }

  const loadNewer = async (): Promise<PageResult> => {
    const {since, interval} = newerCursor
    const current = now()

    if (since >= current) {
      return {found: 0, answered: true, exhausted: true, behind: false}
    }

    const until = Math.min(current, since + interval)
    const {found, answered} = await requestWindow({
      relays,
      filters,
      since,
      until,
      quorum,
      signal: controller.signal,
    })

    if (answered) {
      newerCursor = {since: until, interval: nextInterval(interval, found)}
    }

    return {found, answered, exhausted: false, behind: false}
  }

  const stopEvents = events.subscribe($events => {
    for (const event of $events) {
      if (!reported.has(event.id)) {
        reported.add(event.id)
        onEvent?.(event)
      }
    }
  })

  const loadCache = async () => {
    try {
      const byId = await source.load()
      const cacheFloor = getCacheFloor(byId.values())

      if (cacheFloor) {
        lowerFloor(cacheFloor)
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        console.error(error)
      }
    }
  }

  if (useCache) {
    loadCache()
  }

  const stop = () => {
    controller.abort()
    stopEvents()
  }

  return {events, older: makePager(loadOlder), newer: makePager(loadNewer), stop}
}
