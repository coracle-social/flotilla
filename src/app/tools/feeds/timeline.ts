import {derived, get, writable} from "svelte/store"
import type {Readable} from "svelte/store"
import {now} from "@welshman/lib"
import type {AsyncProjection, EventsById} from "@welshman/store"
import type {Filter, TrustedEvent} from "@welshman/util"
import {makeWalkPager} from "@lib/pager"
import type {Pager} from "@lib/pager"
import {keepEvents} from "@app/tools/feeds/kept"
import {
  WINDOW_LIMIT,
  getCacheFloor,
  newerWalk,
  olderWalk,
  requestWindow,
} from "@app/tools/feeds/windows"

export type TimelineOptions = {
  source: AsyncProjection<EventsById>
  url: string
  filters: Filter[]
  at?: number
  // The window a page asks for, which an empty window widens.
  interval: number
  useCache: boolean
  // Called when the relay can't complete a window of older history and the timeline stops paging back
  onDrop?: () => void
}

export type Timeline = {
  events: Readable<EventsById>
  floor: Readable<number>
  older: Pager
  newer: Pager
  stop: () => void
}

// The events a timeline holds from its floor up, the part with nothing still missing.
export const getCompleteEvents = ($events: EventsById, $floor: number): TrustedEvent[] =>
  Array.from($events.values()).filter(event => event.created_at >= $floor)

export const makeTimeline = ({
  source,
  url,
  filters,
  at = now(),
  interval,
  useCache,
  onDrop,
}: TimelineOptions): Timeline => {
  const controller = new AbortController()
  const kept = keepEvents(source)
  // The lowest time down to which the relay, or the cache, is known to have sent everything.
  const covered = writable(at)

  const cover = (timestamp: number) => {
    covered.update($covered => Math.min($covered, timestamp))
  }

  // A window the relay has covered below the cursor leaves the pager behind, so settling pages again.
  const older = makeWalkPager({
    walk: olderWalk(at, interval),
    request: window =>
      requestWindow({
        url,
        filters,
        window,
        limit: WINDOW_LIMIT,
        signal: controller.signal,
        onCover: cover,
      }),
    isBehind: cursor => cursor.until > get(covered),
    onDrop,
  })

  const newer = makeWalkPager({
    walk: newerWalk(at, interval),
    request: window => requestWindow({url, filters, window, signal: controller.signal}),
  })

  const floor = derived([older.cursor, covered], ([$cursor, $covered]) =>
    Math.min($cursor.until, $covered),
  )

  if (useCache) {
    source
      .load()
      .then(byId => {
        const cacheFloor = getCacheFloor(byId.values())

        if (cacheFloor) {
          cover(cacheFloor)
        }
      })
      .catch(error => {
        if (!controller.signal.aborted) {
          console.error(error)
        }
      })
  }

  const stop = () => {
    controller.abort()
    kept.stop()
  }

  return {events: kept.events, floor, older, newer, stop}
}
