import {derived} from "svelte/store"
import type {Maybe} from "@welshman/lib"
import {
  ROOM_ADD_MEMBER,
  ROOM_CREATE_INVITE,
  ROOM_DELETE,
  ROOM_DELETE_EVENT,
  ROOM_EDIT_META,
  ROOM_REMOVE_MEMBER,
  ROOM_UPDATE_PINS,
  tagSpec,
  tagValue,
} from "@welshman/util"
import type {TrustedEvent} from "@welshman/util"
import {MembershipStatus, Rooms} from "@welshman/app"
import {fromApp} from "@app/core/app"
import {user} from "@app/core/user"
import {deriveSpacePermissions, deriveUserIsSpaceOwner} from "@app/features/spaces/management"
import {deriveRoomMembers} from "@app/features/spaces/rooms/room"

// The room's admin list names the moderation kinds each admin may publish.
export const deriveRoomPermissions = (url: string, h: string) =>
  derived(
    [user, fromApp($app => $app.use(Rooms).forRoom(url, h)), deriveUserIsSpaceOwner(url)],
    ([$user, $room, $isOwner]) => {
      const kinds = $room?.admins?.rolesFor($user.pubkey).map(Number) ?? []
      const can = (kind: number) => $isOwner || kinds.includes(kind)

      return {
        addMembers: can(ROOM_ADD_MEMBER),
        removeMembers: can(ROOM_REMOVE_MEMBER),
        editRoom: can(ROOM_EDIT_META),
        deleteContent: can(ROOM_DELETE_EVENT),
        deleteRoom: can(ROOM_DELETE),
        createInvite: can(ROOM_CREATE_INVITE),
        updatePins: can(ROOM_UPDATE_PINS),
      }
    },
  )

// Removal from a room is offered only for a member of it, and nobody moderates themselves.
export const deriveMemberModeration = (url: string, h = "") =>
  derived(
    [user, deriveRoomPermissions(url, h), deriveRoomMembers(url, h), deriveSpacePermissions(url)],
    ([$user, $roomPermissions, $roomMembers, $spacePermissions]) =>
      (pubkey: string) => {
        const other = pubkey !== $user.pubkey
        const removeFromRoom =
          other && Boolean(h) && $roomPermissions.removeMembers && $roomMembers.includes(pubkey)
        const removeFromSpace = other && $spacePermissions.removeMembers
        const ban = other && $spacePermissions.ban

        return {
          removeFromRoom,
          removeFromSpace,
          ban,
          manage: removeFromRoom || removeFromSpace || ban,
        }
      },
  )

// Deleting someone else's content goes one of two ways, and a space answers for either one.
export enum AdminDelete {
  Room = "room",
  Space = "space",
}

// NIP-29 delete is scoped to a room, and NIP-86 is the wider grant, so it comes second.
export const deriveUserAdminDelete = (url: string, event: TrustedEvent) => {
  const h = tagValue(tagSpec("h"), event.tags) ?? ""

  return derived(
    [deriveRoomPermissions(url, h), deriveSpacePermissions(url)],
    ([$roomPermissions, $spacePermissions]): Maybe<AdminDelete> => {
      if (h && $roomPermissions.deleteContent) {
        return AdminDelete.Room
      }

      if ($spacePermissions.deleteContent) {
        return AdminDelete.Space
      }

      return undefined
    },
  )
}

// Room membership is the relay's business, but the owner may read and write every room.
export const deriveUserRoomMembershipStatus = (url: string, h: string) =>
  derived(
    [fromApp($app => $app.use(Rooms).membershipStatus(url, h).$), deriveUserIsSpaceOwner(url)],
    ([$status, $isOwner]) => ($isOwner ? MembershipStatus.Granted : $status),
  )
