import {derived} from "svelte/store"
import type {Maybe} from "@welshman/lib"
import {ROOM_DELETE_EVENT, tagSpec, tagValue} from "@welshman/util"
import type {TrustedEvent} from "@welshman/util"
import {MembershipStatus, Rooms} from "@welshman/app"
import {fromApp} from "@app/core/app"
import {user} from "@app/core/user"
import {deriveSpacePermissions, deriveUserIsSpaceStaff} from "@app/features/spaces/management"

// A space's staff administer every room in it, so space staff implies room admin.
export const deriveUserIsRoomAdmin = (url: string, h: string) =>
  derived(
    [user, fromApp($app => $app.use(Rooms).forRoom(url, h)), deriveUserIsSpaceStaff(url)],
    ([$user, $room, $isStaff]) =>
      $isStaff || Boolean($room?.admins?.pubkeys().includes($user.pubkey)),
  )

// The room's admin list names the management kinds each admin may publish.
export const deriveUserRoomPermissions = (url: string, h: string) =>
  derived(
    [user, fromApp($app => $app.use(Rooms).forRoom(url, h))],
    ([$user, $room]) => $room?.admins?.rolesFor($user.pubkey).map(Number) ?? [],
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
    [deriveUserRoomPermissions(url, h), deriveSpacePermissions(url)],
    ([$roomPermissions, $spacePermissions]): Maybe<AdminDelete> => {
      if (h && $roomPermissions.includes(ROOM_DELETE_EVENT)) {
        return AdminDelete.Room
      }

      if ($spacePermissions.deleteContent) {
        return AdminDelete.Space
      }

      return undefined
    },
  )
}

// Room membership is the relay's business, but a space admin outranks it.
export const deriveUserRoomMembershipStatus = (url: string, h: string) =>
  derived(
    [fromApp($app => $app.use(Rooms).membershipStatus(url, h).$), deriveUserIsRoomAdmin(url, h)],
    ([$status, $isAdmin]) => ($isAdmin ? MembershipStatus.Granted : $status),
  )
