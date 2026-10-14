import {page} from "$app/stores"
import {derived} from "svelte/store"
import {RoomLists} from "@welshman/app"
import {deriveUserItem} from "@app/core/user"
import {PLATFORM_RELAYS} from "@app/core/env"
import {decodeRelay} from "@app/navigation/pages"

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
