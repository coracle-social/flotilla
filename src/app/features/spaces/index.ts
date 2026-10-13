import {page} from "$app/stores"
import {derived} from "svelte/store"
import {ago, int, max, partition, sortBy, spec, MONTH, WEEK} from "@welshman/lib"
import {
  CLASSIFIED,
  COMMENT,
  DELETE,
  EVENT_TIME,
  LONG_FORM,
  MESSAGE,
  PINBOARD,
  POLL,
  POLL_RESPONSE,
  REPORT,
  ROOMS,
  THREAD,
  ZAP_GOAL,
  getIdOrAddress,
  isReplaceableKind,
  tagSpec,
  tagValue,
} from "@welshman/util"
import type {Filter, TrustedEvent} from "@welshman/util"
import {Comment} from "@welshman/domain"
import {RoomLists} from "@welshman/app"
import {makeCommentFilter} from "@lib/util"
import {deriveUserItem, syncUserList} from "@app/core/user"
import {network, relays, roomLists} from "@app/core/plugins"
import {PLATFORM_RELAYS} from "@app/core/env"
import {decodeRelay} from "@app/navigation/pages"
import {registerRetention} from "@app/core/storage"
import {pullAndListen, registerSync, syncEach} from "@app/core/sync"
import {hasBlossomSupport} from "@app/features/uploads"
import {reader} from "@app/core/domain"
import {REACTION_KINDS} from "@app/features/reactions"

// The kinds that each have a section of their own in a space.
export const CONTENT_KINDS = [ZAP_GOAL, EVENT_TIME, THREAD, CLASSIFIED, POLL, PINBOARD, LONG_FORM]

// An event is active as of its own creation or the newest comment on it, keyed by address when addressable.
export const partitionByActivity = (kind: number, events: TrustedEvent[]) => {
  const [items, comments] = partition(spec({kind}), events)
  const commentedAt = new Map<string, number>()

  for (const comment of comments) {
    const {id, address} = reader(Comment)(comment).root()
    const key = isReplaceableKind(kind) ? address : id

    if (key) {
      commentedAt.set(key, max([commentedAt.get(key), comment.created_at]))
    }
  }

  const activeAt = new Map(
    items.map(event => [event.id, max([commentedAt.get(getIdOrAddress(event)), event.created_at])]),
  )

  return {items: sortBy(event => -(activeAt.get(event.id) ?? 0), items), activeAt}
}

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
