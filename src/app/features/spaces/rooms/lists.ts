import {derived, get} from "svelte/store"
import {sortBy, uniq} from "@welshman/lib"
import {RoomLists, Rooms, User} from "@welshman/app"
import type {Command} from "@welshman/app"
import {fromApp} from "@app/core/app"
import {roomLists} from "@app/core/plugins"
import {INDEXER_RELAYS} from "@app/core/env"
import {userSpaceUrls} from "@app/features/spaces/urls"
import {RoomType, getRoomType, roomComparator} from "@app/features/spaces/rooms/room"

// Room lists also go to the indexers, which is where the space browser looks for them.
export const publishRoomList = (command: Command) =>
  command.publishToRelays(uniq([...command.relays, ...INDEXER_RELAYS]))

// Spaces get reordered from lists showing only some of them, so urls go back in the slots they replace.
export const reorderSpaceUrls = (urls: string[]) => {
  let index = 0

  const nextUrls = get(userSpaceUrls).map(url => (urls.includes(url) ? urls[index++] : url))

  return roomLists.get().setRelays(nextUrls).then(publishRoomList)
}

// Rooms in the space the user has joined, limited to those the relay still advertises.
export const deriveUserRooms = (url: string) =>
  derived(
    [
      fromApp($app => $app.use(RoomLists).roomsForUrl(User.require($app).pubkey, url).$),
      fromApp($app => $app.use(Rooms).forUrl(url).$),
    ],
    ([$rooms, $spaceRooms]) => {
      const known = new Set($spaceRooms.map(room => room.h))

      return sortBy(roomComparator(url), uniq($rooms.filter(h => known.has(h))))
    },
  )

export const deriveOtherRooms = (url: string, type: RoomType) =>
  derived(
    [deriveUserRooms(url), fromApp($app => $app.use(Rooms).forUrl(url).$)],
    ([$userRooms, $spaceRooms]) => {
      const result = $spaceRooms
        .filter(room => getRoomType(room) === type && !$userRooms.includes(room.h))
        .map(room => room.h)

      return sortBy(roomComparator(url), uniq(result))
    },
  )
