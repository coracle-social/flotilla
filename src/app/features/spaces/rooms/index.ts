import {
  ROOM_ADD_MEMBER,
  ROOM_ADMINS,
  ROOM_CREATE_PERMISSION,
  ROOM_DELETE,
  ROOM_MEMBERS,
  ROOM_META,
  ROOM_PINS,
  ROOM_REMOVE_MEMBER,
  hexTags,
  tagValues,
} from "@welshman/util"
import {registerRetention} from "@app/core/storage"
import {registerSync, syncEach} from "@app/core/sync"
import {currentSpaceUrls, syncedSpaceUrls} from "@app/features/spaces/urls"
import {syncCurrentSpaceRooms, syncSpaceRooms} from "@app/features/spaces/rooms/sync"

export * from "@app/features/spaces/rooms/room"
export * from "@app/features/spaces/rooms/publish"
export * from "@app/features/spaces/rooms/lists"
export * from "@app/features/spaces/rooms/permissions"
export * from "@app/features/spaces/rooms/search"
export * from "@app/features/spaces/rooms/transcript"

export const registerRooms = () => {
  registerSync(() => syncEach(syncedSpaceUrls, syncSpaceRooms))
  registerSync(() => syncEach(currentSpaceUrls, syncCurrentSpaceRooms))

  registerRetention({
    match: event =>
      [
        ROOM_META,
        ROOM_DELETE,
        ROOM_ADMINS,
        ROOM_MEMBERS,
        ROOM_CREATE_PERMISSION,
        ROOM_PINS,
      ].includes(event.kind),
    provenance: true,
  })

  registerRetention({
    match: (event, pubkey) =>
      [ROOM_ADD_MEMBER, ROOM_REMOVE_MEMBER].includes(event.kind) &&
      tagValues(hexTags("p"), event.tags).includes(pubkey),
    provenance: true,
  })
}
