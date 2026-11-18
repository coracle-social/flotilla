import {Events} from "@welshman/app"
import type {Filter} from "@welshman/util"
import {makeCommentFilter} from "@lib/util"
import {app} from "@app/core/app"
import type {Timeline} from "@app/tools/feeds/timeline"
import {makeTimeline} from "@app/tools/feeds/timeline"

export type RelayFeedOptions = {
  url: string
  filters: Filter[]
  at?: number
}

export const makeRelayFeed = (options: RelayFeedOptions): Timeline => {
  const {url, filters, at} = options

  return makeTimeline({
    source: app.get().use(Events).byIdForUrl(url, filters),
    relays: [url],
    filters,
    at,
    quorum: 0.8,
    useCache: true,
  })
}

export const makeSpaceFeed = (url: string, kind: number) =>
  makeRelayFeed({url, filters: [{kinds: [kind]}, makeCommentFilter([kind])]})
