import {derived} from "svelte/store"
import {RoomLists} from "@welshman/app"
import {deriveUserItem} from "@app/core/app"
import {PLATFORM_RELAYS} from "@app/core/env"

export const userRoomList = deriveUserItem(RoomLists)

export const userSpaceUrls = derived(userRoomList, $userRoomList => $userRoomList?.urls() ?? [])

// Platform relays, where configured, stand in for the spaces the user has joined.
export const activeSpaceUrls = derived(userSpaceUrls, $userSpaceUrls =>
  PLATFORM_RELAYS.length > 0 ? PLATFORM_RELAYS : $userSpaceUrls,
)
