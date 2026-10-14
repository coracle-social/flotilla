import {ago, MONTH} from "@welshman/lib"
import {
  MESSAGE,
  ROOM_ADD_MEMBER,
  ROOM_ADMINS,
  ROOM_CREATE_PERMISSION,
  ROOM_DELETE,
  ROOM_JOIN,
  ROOM_LEAVE,
  ROOM_MEMBERS,
  ROOM_META,
  ROOM_PINS,
  ROOM_REMOVE_MEMBER,
} from "@welshman/util"
import {throttled} from "@welshman/store"
import {app} from "@app/core/app"
import {network, rooms} from "@app/core/plugins"
import {pullAndListen} from "@app/core/sync"

export const syncSpaceRooms = (url: string) => {
  const $pubkey = app.get().user?.pubkey
  const controller = new AbortController()
  const asked = new Set<string>()

  network.get().request({
    relays: [url],
    signal: controller.signal,
    filters: [{kinds: [MESSAGE], limit: 1}],
  })

  const unsubscribeState = pullAndListen(url, [
    {kinds: [ROOM_META, ROOM_DELETE]},
    ...($pubkey
      ? [
          {kinds: [ROOM_CREATE_PERMISSION], "#p": [$pubkey], limit: 1},
          {kinds: [ROOM_ADD_MEMBER, ROOM_REMOVE_MEMBER], "#p": [$pubkey]},
        ]
      : []),
  ])

  const unsubscribeRooms = throttled(300, rooms.get().forUrl(url).$).subscribe($rooms => {
    const hs = $rooms.map(room => room.h).filter(h => !asked.has(h))

    if (hs.length > 0) {
      for (const h of hs) {
        asked.add(h)
      }

      network.get().load({
        relays: [url],
        signal: controller.signal,
        filters: hs.map(h => ({kinds: [MESSAGE], "#h": [h], limit: 1})),
      })
    }
  })

  return () => {
    unsubscribeRooms()
    unsubscribeState()
    controller.abort()
  }
}

export const syncCurrentSpaceRooms = (url: string) =>
  pullAndListen(url, [
    {kinds: [ROOM_ADMINS, ROOM_MEMBERS, ROOM_PINS]},
    {kinds: [ROOM_JOIN, ROOM_LEAVE], since: ago(MONTH)},
  ])
