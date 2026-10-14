import {derived} from "svelte/store"
import {addToMapKey, dec} from "@welshman/lib"
import type {Relay} from "@welshman/domain"
import {throttled} from "@welshman/store"
import {RoomLists, Rooms, Relays, createSearch} from "@welshman/app"
import {fromApp} from "@app/core/app"
import {relays} from "@app/core/plugins"
import * as pages from "@app/navigation/pages"
import {userRoomList, userSpaceUrls} from "@app/features/spaces/urls"
import {displayRoom} from "@app/features/spaces/rooms/room"

// How many people list each space both scopes and ranks the search.
export const deriveSpaceSearch = () => {
  const spacePubkeysByUrl = derived(
    fromApp($app => $app.use(RoomLists).all.$),
    $roomLists => {
      const result = new Map<string, Set<string>>()

      for (const roomList of $roomLists) {
        for (const url of roomList.urls()) {
          addToMapKey(result, url, roomList.author())
        }
      }

      return result
    },
  )

  return derived(
    [
      throttled(
        1000,
        fromApp($app => $app.use(Relays).all.$),
      ),
      spacePubkeysByUrl,
    ],
    ([$relays, $spacePubkeysByUrl]) =>
      createSearch(
        $relays.filter(r => $spacePubkeysByUrl.has(r.url)),
        {
          getValue: (relay: Relay) => relay.url,
          sortFn: ({score, item}) => {
            if (score && score > 0.1) {
              return -score
            }

            const wotScore = $spacePubkeysByUrl.get(item.url)?.size || 0

            return score ? dec(score) * wotScore : -wotScore
          },
          fuseOptions: {
            keys: ["url", "name", {name: "description", weight: 0.3}],
            shouldSort: false,
          },
        },
      ),
  )
}

export const deriveUserRoomSearch = () =>
  derived(
    [userSpaceUrls, userRoomList, fromApp($app => $app.use(Rooms).byUrl.$)],
    ([$userSpaceUrls, $userRoomList, $roomsByUrl]) => {
      type Option = {url: string; h?: string; path: string; name: string; isFavorite: boolean}

      const options = $userSpaceUrls.flatMap((url): Option[] => {
        if (relays.get().get(url)?.hasNip(29)) {
          const favorites = new Set($userRoomList?.roomsForUrl(url) ?? [])

          return ($roomsByUrl.get(url) ?? []).map(({h}) => ({
            url,
            h,
            path: pages.room.path({url, h}),
            name: displayRoom(url, h),
            isFavorite: favorites.has(h),
          }))
        } else {
          return [{url, path: pages.spaceChat.path({url}), name: "chat", isFavorite: false}]
        }
      })

      return createSearch(options, {
        getValue: option => option.path,
        fuseOptions: {keys: ["name", "url"]},
        sortFn: ({item}) => (item.isFavorite ? 0 : 1),
      })
    },
  )
