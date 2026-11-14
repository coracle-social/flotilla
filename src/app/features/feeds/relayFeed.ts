import {Events} from "@welshman/app"
import type {Filter, TrustedEvent} from "@welshman/util"
import {app} from "@app/core/app"
import type {Timeline} from "@app/features/feeds/timeline"
import {makeTimeline} from "@app/features/feeds/timeline"

export type RelayFeedOptions = {
  url: string
  filters: Filter[]
  at?: number
  onEvent?: (event: TrustedEvent) => void
}

export const makeRelayFeed = (options: RelayFeedOptions): Timeline => {
  const {url, filters, at, onEvent} = options

  return makeTimeline({
    source: app.get().use(Events).byIdForUrl(url, filters),
    relays: [url],
    filters,
    at,
    quorum: 0.8,
    useCache: true,
    onEvent,
  })
}
