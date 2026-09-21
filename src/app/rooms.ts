import * as nip19 from "nostr-tools/nip19"
import {derived, get} from "svelte/store"
import {formatTimestampAsDate, int, sortBy, uniq, MINUTE} from "@welshman/lib"
import type {Maybe} from "@welshman/lib"
import {
  ROOM_DELETE_EVENT,
  hexTags,
  outbox,
  relay,
  seen,
  tagSpec,
  tagValue,
  tagValueMatcher,
  toNostrURI,
} from "@welshman/util"
import type {EventContent, TrustedEvent} from "@welshman/util"
import {Message} from "@welshman/domain"
import {MembershipStatus, RoomLists, makeRoomKey, createSearch, publish} from "@welshman/app"
import type {Room, RoomMeta} from "@welshman/app"
import {
  deriveUserItem,
  relayManagement,
  relayMemberLists,
  roomLists,
  rooms,
  router,
  thunks,
  relays,
  user,
  writer,
} from "@app/core"
import {deriveSpaceSupportedMethods, deriveUserIsSpaceStaff} from "@app/management"
import {makeRoomPath} from "@app/routes"

export const PROTECTED = ["-"]

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
  derived(rooms.get().members(url, h).$, $members => Array.from($members))

// A room member also has to be allowed at the relay level, or they won't be able to read the
// room at all.
export const addRoomMembers = async (url: string, room: RoomMeta, pubkeys: string[]) => {
  const members = relayMemberLists.get().get(url)
  const management = relayManagement.get().forUrl(url)

  const responses = await Promise.all(
    pubkeys.filter(pk => !members?.isMember(pk)).map(pk => management.allowPubkey(pk)),
  )

  for (const {error} of responses) {
    if (error) {
      return error
    }
  }

  const errors = await Promise.all(
    pubkeys.map(pk =>
      rooms
        .get()
        .addMember(url, room, pk)
        .then(command => command.publish().waitForError()),
    ),
  )

  for (const error of errors) {
    if (error) {
      return error
    }
  }
}

export const prependParent = async (
  parent: Maybe<TrustedEvent>,
  {content, tags}: EventContent,
  url?: string,
): Promise<EventContent> => {
  if (parent) {
    const resolver = router.get().resolver
    const relays = url ? [url] : await resolver.relays([seen(parent)])
    const hint = url ?? (await resolver.relay([outbox(parent.pubkey)])) ?? ""
    const nevent = nip19.neventEncode({id: parent.id, author: parent.pubkey, relays})

    content = toNostrURI(nevent) + "\n\n" + content
    tags = [...tags, ["q", parent.id, hint, parent.pubkey], ["p", parent.pubkey, hint]]
  }

  return {content, tags}
}

export const publishRoomQuote = async ({
  url,
  h,
  parent,
  protect,
  delay,
}: {
  url: string
  h?: string
  parent: TrustedEvent
  protect: boolean
  delay?: number
}) => {
  const eventWriter = writer(Message).setParent(parent).setProtected(protect)

  if (h) {
    eventWriter.setRoom(url, h)
  } else {
    eventWriter.forceRoutes(relay(url))
  }

  return thunks.get().publish({
    relays: [url],
    event: await eventWriter.renderTemplate(),
    delay,
  })
}

// User

export const userRoomList = deriveUserItem(RoomLists)

export const userSpaceUrls = derived(userRoomList, $userRoomList => $userRoomList?.urls() ?? [])

// Spaces get reordered from lists that show only some of them, so the urls given here go back
// in the slots the ones they replace occupied.
export const reorderSpaceUrls = (urls: string[]) => {
  let index = 0

  const nextUrls = get(userSpaceUrls).map(url => (urls.includes(url) ? urls[index++] : url))

  return roomLists.get().setRelays(nextUrls).then(publish)
}

// Rooms in the space the user has joined, limited to those the relay still advertises.
export const deriveUserRooms = (url: string) =>
  derived(
    [roomLists.get().roomsForUrl(user.get().pubkey, url).$, rooms.get().forUrl(url).$],
    ([$rooms, $spaceRooms]) => {
      const known = new Set($spaceRooms.map(room => room.h))

      return sortBy(roomComparator(url), uniq($rooms.filter(h => known.has(h))))
    },
  )

export const deriveOtherRooms = (url: string) =>
  derived([deriveUserRooms(url), rooms.get().forUrl(url).$], ([$userRooms, $spaceRooms]) => {
    const result = $spaceRooms
      .filter(room => !room.meta?.hasLivekit() && !$userRooms.includes(room.h))
      .map(room => room.h)

    return sortBy(roomComparator(url), uniq(result))
  })

export const deriveOtherVoiceRooms = (url: string) =>
  derived([deriveUserRooms(url), rooms.get().forUrl(url).$], ([$userRooms, $spaceRooms]) => {
    const result = $spaceRooms
      .filter(room => room.meta?.hasLivekit() && !$userRooms.includes(room.h))
      .map(room => room.h)

    return sortBy(roomComparator(url), uniq(result))
  })

// A space's staff administer every room in it, so space staff implies room admin.
export const deriveUserIsRoomAdmin = (url: string, h: string) =>
  derived(
    [user, rooms.get().forRoom(url, h), deriveUserIsSpaceStaff(url)],
    ([$user, $room, $isStaff]) =>
      $isStaff || Boolean($room?.admins?.pubkeys().includes($user.pubkey)),
  )

// The room's admin list names the management kinds each admin may publish, so the ops the relay
// will answer for the user are readable before one is sent.
export const deriveUserRoomPermissions = (url: string, h: string) =>
  derived([user, rooms.get().forRoom(url, h)], ([$user, $room]) => {
    const tag = $room?.admins?.tags().find(tagValueMatcher(hexTags("p"), $user.pubkey))

    return tag?.slice(2).map(Number) ?? []
  })

// Deleting someone else's content goes one of two ways, and a space answers for either one.
export enum AdminDelete {
  Room = "room",
  Space = "space",
}

// A room admin deletes over NIP-29, which is scoped to the room the content is in. NIP-86 is the
// wider grant and the only one that reaches content belonging to no room, so it comes second.
export const deriveUserAdminDelete = (url: string, event: TrustedEvent) => {
  const h = tagValue(tagSpec("h"), event.tags) ?? ""

  return derived(
    [deriveUserRoomPermissions(url, h), deriveSpaceSupportedMethods(url)],
    ([$permissions, $methods]): Maybe<AdminDelete> => {
      if (h && $permissions.includes(ROOM_DELETE_EVENT)) {
        return AdminDelete.Room
      }

      if ($methods.includes("banevent")) {
        return AdminDelete.Space
      }

      return undefined
    },
  )
}

// Room membership is the relay's business, but a space admin outranks it.
export const deriveUserRoomMembershipStatus = (url: string, h: string) =>
  derived(
    [rooms.get().membershipStatus(url, h).$, deriveUserIsRoomAdmin(url, h)],
    ([$status, $isAdmin]) => ($isAdmin ? MembershipStatus.Granted : $status),
  )

export const deriveUserRoomSearch = () =>
  derived(
    [userSpaceUrls, userRoomList, rooms.get().byUrl.$],
    ([$userSpaceUrls, $userRoomList, $roomsByUrl]) => {
      const options = $userSpaceUrls.flatMap(url => {
        const favorites = new Set($userRoomList?.roomsForUrl(url) ?? [])
        // Spaces that aren't NIP-29 relays keep all their messages in the space-wide chat
        const roomIds = relays.get().get(url)?.hasNip(29)
          ? ($roomsByUrl.get(url) ?? []).map(room => room.h)
          : ["chat"]

        return roomIds.map(h => ({
          url,
          h,
          name: displayRoom(url, h),
          isFavorite: favorites.has(h),
        }))
      })

      return createSearch(options, {
        getValue: option => makeRoomPath(option.url, option.h),
        fuseOptions: {keys: ["name", "url"]},
        sortFn: ({item}) => (item.isFavorite ? 0 : 1),
      })
    },
  )

// A row of a room transcript: the messages themselves, the date dividers between them, and the
// marker for where the reader left off.
export type RoomRow =
  | {type: "new-messages"; id: string}
  | {type: "date"; id: string; value: string}
  | {type: "note"; id: string; value: TrustedEvent; showPubkey: boolean}

// Groups messages for display: a divider wherever the day changes, an unread marker at the point
// the reader left off, and the author shown only when it changes or enough quiet has passed.
// Returned newest first, which is the order a reversed transcript renders in.
export const groupRoomMessages = ({
  events,
  pubkey,
  addMemberKind,
  unreadAfter,
  unreadBefore,
}: {
  events: TrustedEvent[]
  pubkey: string
  addMemberKind: number
  unreadAfter: number
  unreadBefore: number
}) => {
  const rows: RoomRow[] = []
  const seenIds = new Set<string>()

  // Messages the reader sent from another device aren't unread to them
  const lastOwn = events.findLast(event => event.pubkey === pubkey)
  const after = unreadAfter && lastOwn ? Math.max(lastOwn.created_at, unreadAfter) : unreadAfter

  let markedUnread = false
  let previousDate: Maybe<string>
  let previousKind: Maybe<number>
  let previousPubkey: Maybe<string>
  let previousCreatedAt = 0

  for (const event of events) {
    if (seenIds.has(event.id)) {
      continue
    }

    seenIds.add(event.id)

    const date = formatTimestampAsDate(event.created_at)

    if (
      !markedUnread &&
      after &&
      event.pubkey !== pubkey &&
      event.created_at > after &&
      event.created_at < unreadBefore
    ) {
      rows.push({type: "new-messages", id: "new-messages"})
      markedUnread = true
    }

    if (date !== previousDate) {
      rows.push({type: "date", id: date, value: date})
    }

    rows.push({
      type: "note",
      id: event.id,
      value: event,
      showPubkey:
        previousPubkey !== event.pubkey ||
        event.created_at - previousCreatedAt > int(3, MINUTE) ||
        previousKind === addMemberKind,
    })

    previousDate = date
    previousKind = event.kind
    previousPubkey = event.pubkey
    previousCreatedAt = event.created_at
  }

  rows.reverse()

  return rows
}
