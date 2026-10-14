import {ago, WEEK} from "@welshman/lib"
import {DELETE, POLL_RESPONSE, REPORT} from "@welshman/util"
import type {Filter} from "@welshman/util"
import {makeCommentFilter} from "@lib/util"
import {network, relays} from "@app/core/plugins"
import {REACTION_KINDS} from "@app/core/env"
import {pullAndListen, syncEach} from "@app/core/sync"
import {hasBlossomSupport} from "@app/features/uploads"
import {CONTENT_KINDS} from "@app/features/spaces/content"
import {currentSpaceUrls, userSpaceUrls} from "@app/features/spaces/urls"

export const syncCurrentSpace = (filters: Filter[]) =>
  syncEach(currentSpaceUrls, url => pullAndListen(url, filters))

export const syncSpaceRelays = () => {
  const unsubscribeCurrent = currentSpaceUrls.subscribe($currentSpaceUrls => {
    for (const url of $currentSpaceUrls) {
      relays.get().load(url)
      hasBlossomSupport(url)
    }
  })

  const unsubscribeUser = userSpaceUrls.subscribe($userSpaceUrls => {
    for (const url of $userSpaceUrls) {
      relays.get().load(url)
    }
  })

  return () => {
    unsubscribeCurrent()
    unsubscribeUser()
  }
}

export const syncSpaceContent = (url: string) => {
  const controller = new AbortController()

  network.get().request({
    relays: [url],
    signal: controller.signal,
    filters: [
      {kinds: CONTENT_KINDS, since: ago(WEEK)},
      makeCommentFilter(CONTENT_KINDS, {since: ago(WEEK)}),
      {kinds: [DELETE, REPORT, POLL_RESPONSE], since: ago(WEEK)},
    ],
  })

  return () => controller.abort()
}

export const syncCurrentSpaceContent = (url: string) => {
  const controller = new AbortController()
  const unsubscribe = pullAndListen(url, [{kinds: REACTION_KINDS, since: ago(WEEK)}])

  // Which sections a space offers is a question about its whole history, and one event per kind answers it.
  network.get().load({
    relays: [url],
    signal: controller.signal,
    filters: CONTENT_KINDS.map(kind => ({kinds: [kind], limit: 1})),
  })

  return () => {
    unsubscribe()
    controller.abort()
  }
}
