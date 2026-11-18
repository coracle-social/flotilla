import {derived} from "svelte/store"
import {addToMapKey, dec, indexBy, nth, uniq} from "@welshman/lib"
import {Relay} from "@welshman/domain"
import type {RoomListReader} from "@welshman/domain"
import {isRelayUrl, normalizeRelayUrl} from "@welshman/util"
import {throttled} from "@welshman/store"
import {RoomLists, Rooms, Relays, createSearch} from "@welshman/app"
import {fromApp} from "@app/core/app"
import {relays} from "@app/core/plugins"
import * as pages from "@app/navigation/pages"
import {userRoomList, userSpaceUrls} from "@app/core/user"
import {displayRoom} from "@app/areas/spaces/rooms/room"

// `RoomList.urls()` throws on a room tag with no relay hint, so skip those tags rather than the list.
const listUrls = (list: RoomListReader) =>
  uniq(
    [...list.relays(), ...list.roomTags().map(nth(2))]
      .filter(url => url && isRelayUrl(url))
      .map(normalizeRelayUrl),
  )

// Who lists each space, rebuilt once a second while room lists stream in by the hundred.
const spacePubkeysByUrl = derived(
  throttled(
    1000,
    fromApp($app => $app.use(RoomLists).all.$),
  ),
  $roomLists => {
    const result = new Map<string, Set<string>>()

    for (const roomList of $roomLists) {
      for (const url of listUrls(roomList)) {
        addToMapKey(result, url, roomList.author())
      }
    }

    return result
  },
)

export const spacePubkeysForUrl = (url: string) =>
  derived(spacePubkeysByUrl, $pubkeysByUrl =>
    Array.from($pubkeysByUrl.get(normalizeRelayUrl(url)) ?? []),
  )

export const deriveSpaceSearch = () => {
  return derived(
    [
      throttled(
        1000,
        fromApp($app => $app.use(Relays).all.$),
      ),
      spacePubkeysByUrl,
    ],
    ([$relays, $spacePubkeysByUrl]) => {
      const relaysByUrl = indexBy((relay: Relay) => relay.url, $relays)

      return createSearch(
        Array.from($spacePubkeysByUrl.keys(), url => relaysByUrl.get(url) ?? new Relay(url)),
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
      )
    },
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
