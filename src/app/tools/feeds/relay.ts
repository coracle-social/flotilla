import {derived} from "svelte/store"
import type {Readable} from "svelte/store"
import {Events} from "@welshman/app"
import {YEAR, int} from "@welshman/lib"
import {throttled} from "@welshman/store"
import {compareEventsAsc} from "@welshman/util"
import type {Filter, TrustedEvent} from "@welshman/util"
import {strictOrder} from "@lib/order"
import type {Pager} from "@lib/pager"
import {makeCommentFilter} from "@lib/util"
import {app} from "@app/core/app"
import {getCompleteEvents, makeTimeline} from "@app/tools/feeds/timeline"

export type RelayFeedOptions = {
  url: string
  filters: Filter[]
  at?: number
  interval: number
}

export type RelayFeed = {
  events: Readable<TrustedEvent[]>
  older: Pager
  newer: Pager
  stop: () => void
}

export const makeRelayFeed = ({url, filters, at, interval}: RelayFeedOptions): RelayFeed => {
  const timeline = makeTimeline({
    source: app.get().use(Events).byIdForUrl(url, filters),
    url,
    filters,
    at,
    interval,
    useCache: true,
  })

  // The floor drops with each event a window brings, so the list follows it at most every 150ms
  const complete = derived([timeline.events, throttled(150, timeline.floor)], ([$events, $floor]) =>
    getCompleteEvents($events, $floor),
  )

  // A room and a board read in time order, so an event that arrives late goes where it belongs.
  const events = strictOrder(complete, compareEventsAsc)

  return {events, older: timeline.older, newer: timeline.newer, stop: timeline.stop}
}

export const makeSpaceFeed = (url: string, kind: number) =>
  makeRelayFeed({
    url,
    filters: [{kinds: [kind]}, makeCommentFilter([kind])],
    interval: int(YEAR),
  })
