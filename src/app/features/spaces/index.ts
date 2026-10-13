import {page} from "$app/stores"
import {derived} from "svelte/store"
import {ago, int, spec, MONTH, WEEK} from "@welshman/lib"
import {
  COMMENT,
  DELETE,
  MESSAGE,
  POLL_RESPONSE,
  REPORT,
  ROOMS,
  tagSpec,
  tagValue,
} from "@welshman/util"
import type {Filter} from "@welshman/util"
import {RoomLists} from "@welshman/app"
import {deriveUserItem, syncUserList} from "@app/core/user"
import {network, relays, roomLists} from "@app/core/plugins"
import {PLATFORM_RELAYS} from "@app/core/env"
import {decodeRelay} from "@app/core/relays"
import {registerRetention} from "@app/core/storage"
import {pullAndListen, registerSync, syncEach} from "@app/core/sync"
import {hasBlossomSupport} from "@app/core/uploads"
import {CONTENT_KINDS, REACTION_KINDS, makeCommentFilter} from "@app/features/content"

export const userRoomList = deriveUserItem(RoomLists)

export const userSpaceUrls = derived(userRoomList, $userRoomList => $userRoomList?.urls() ?? [])

// Platform relays, where configured, stand in for the spaces the user has joined.
export const activeSpaceUrls = derived(userSpaceUrls, $userSpaceUrls =>
  PLATFORM_RELAYS.length > 0 ? PLATFORM_RELAYS : $userSpaceUrls,
)

// The space on screen, as a list so it syncs the same way as the others.
export const currentSpaceUrls = derived(page, $page =>
  $page.params.relay ? [decodeRelay($page.params.relay)] : [],
)

export const syncedSpaceUrls = derived(
  [activeSpaceUrls, currentSpaceUrls],
  ([$activeSpaceUrls, $currentSpaceUrls]) => [...$activeSpaceUrls, ...$currentSpaceUrls],
)

export const syncCurrentSpace = (filters: Filter[]) =>
  syncEach(currentSpaceUrls, url => pullAndListen(url, filters))

const syncSpaceRelays = () => {
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

const syncSpaceContent = (url: string) => {
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

const syncCurrentSpaceContent = (url: string) => {
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

export const registerSpaces = () => {
  registerSync(syncSpaceRelays)
  registerSync(() => syncUserList(pubkey => roomLists.get().load(pubkey)))
  registerSync(() => syncEach(syncedSpaceUrls, syncSpaceContent))
  registerSync(() => syncEach(currentSpaceUrls, syncCurrentSpaceContent))

  registerRetention({match: spec({kind: ROOMS}), ttl: int(1, MONTH)})

  // A space is asked for its own content on every load, so a month of it bounds the read at startup.
  registerRetention({
    match: event =>
      [MESSAGE, COMMENT, DELETE, REPORT, POLL_RESPONSE, ...CONTENT_KINDS].includes(event.kind) &&
      Boolean(tagValue(tagSpec("h"), event.tags)),
    maxAge: int(1, MONTH),
    provenance: true,
  })
}
