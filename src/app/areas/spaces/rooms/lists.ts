import {derived, get, readable} from "svelte/store"
import {sortBy, uniq} from "@welshman/lib"
import {RoomLists, Rooms} from "@welshman/app"
import {fromApp} from "@app/core/app"
import {roomLists} from "@app/core/plugins"
import {userSpaceUrls} from "@app/core/user"
import {publishRoomList} from "@app/tools/publish"
import {RoomType, getRoomType, roomComparator} from "@app/areas/spaces/rooms/room"

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
      fromApp($app =>
        $app.user ? $app.use(RoomLists).roomsForUrl($app.user.pubkey, url).$ : readable([]),
      ),
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
