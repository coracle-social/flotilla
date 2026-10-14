import {randomId} from "@welshman/lib"
import {RoomCreateInvite, RoomJoin, RoomLeave} from "@welshman/domain"
import {publish} from "@welshman/app"
import {roomLists} from "@app/core/plugins"
import {command, writer} from "@app/core/domain"
import {publishRoomList} from "@app/features/spaces/rooms"

// "duplicate:" and "already a member" both leave us where we wanted to be.
const isMembershipRefusal = (error: string) =>
  !error.startsWith("duplicate:") && !error.includes("already")

// Joining takes two publishes: the NIP-29 request the relay can refuse, and the user's room list.
export const joinRoom = async (url: string, h: string, code?: string) => {
  const eventWriter = writer(RoomJoin).setRoom(url, h)

  if (code) {
    eventWriter.setClaim(code)
  }

  const publication = await command(eventWriter).then(publish)
  const error = await publication.getError()

  if (error && isMembershipRefusal(error)) {
    return error
  }

  await roomLists.get().addRoom(h, url).then(publishRoomList)
}

export const leaveRoom = async (url: string, h: string) => {
  const publication = await command(writer(RoomLeave).setRoom(url, h)).then(publish)
  const error = await publication.getError()

  if (error && isMembershipRefusal(error)) {
    return error
  }

  await roomLists.get().removeRoom(h, url).then(publishRoomList)
}

export const publishRoomInvite = async (url: string, h: string) => {
  const code = randomId()
  const eventWriter = writer(RoomCreateInvite).setRoom(url, h).setCode(code)
  const publication = await command(eventWriter).then(publish)
  const error = await publication.getError()

  if (error) {
    return {error, code: undefined}
  }

  return {error: undefined, code}
}
