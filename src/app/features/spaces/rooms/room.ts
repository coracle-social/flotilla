import {derived} from "svelte/store"
import type {Maybe} from "@welshman/lib"
import {Rooms, makeRoomKey} from "@welshman/app"
import type {Room, RoomMeta} from "@welshman/app"
import {fromApp} from "@app/core/app"
import {rooms} from "@app/core/plugins"
import {allowPubkeys} from "@app/features/spaces/management"

export enum RoomType {
  Text = "text",
  Voice = "voice",
}

export const getRoomType = (room: Maybe<Room>) =>
  room?.meta?.hasLivekit() ? RoomType.Voice : RoomType.Text

export const isRoomId = (id: string) => id.includes("'")

export const displayRoom = (url: string, h: string) =>
  rooms.get().get(makeRoomKey(url, h))?.meta?.name() || h

export const roomComparator = (url: string) => (h: string) => displayRoom(url, h).toLowerCase()

export const deriveRoomMembers = (url: string, h: string) =>
  derived(
    fromApp($app => $app.use(Rooms).members(url, h).$),
    $members => Array.from($members),
  )

// A room member also has to be allowed at the relay level to read the room at all.
export const addRoomMembers = async (url: string, room: RoomMeta, pubkeys: string[]) => {
  const allowError = await allowPubkeys(url, pubkeys)

  if (allowError) {
    return allowError
  }

  const errors = await Promise.all(
    pubkeys.map(pk =>
      rooms
        .get()
        .addMember(url, room, pk)
        .then(command => command.publish().getError()),
    ),
  )

  for (const error of errors) {
    if (error) {
      return error
    }
  }
}
