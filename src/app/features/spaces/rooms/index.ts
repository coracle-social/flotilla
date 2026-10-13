import * as nip19 from "nostr-tools/nip19"
import {derived, get} from "svelte/store"
import {
  addToMapKey,
  ago,
  dec,
  formatTimestampAsDate,
  int,
  sortBy,
  uniq,
  MINUTE,
  MONTH,
} from "@welshman/lib"
import type {Maybe} from "@welshman/lib"
import {
  MESSAGE,
  ROOM_ADD_MEMBER,
  ROOM_ADMINS,
  ROOM_CREATE_PERMISSION,
  ROOM_DELETE,
  ROOM_DELETE_EVENT,
  ROOM_JOIN,
  ROOM_LEAVE,
  ROOM_MEMBERS,
  ROOM_META,
  ROOM_PINS,
  ROOM_REMOVE_MEMBER,
  hexTags,
  outbox,
  relay,
  seen,
  tagSpec,
  tagValue,
  tagValues,
  toNostrURI,
} from "@welshman/util"
import type {EventContent, TrustedEvent} from "@welshman/util"
import {Comment, Message} from "@welshman/domain"
import type {BaseEventReader, EventWriter, Relay} from "@welshman/domain"
import {throttled} from "@welshman/store"
import {
  MembershipStatus,
  RoomLists,
  Rooms,
  Relays,
  User,
  makeRoomKey,
  createSearch,
  publish,
} from "@welshman/app"
import type {Command, Room, RoomMeta} from "@welshman/app"
import {app, fromApp} from "@app/core/app"
import {user} from "@app/core/user"
import {network, roomLists, rooms, router, publisher, relays} from "@app/core/plugins"
import {command, writer} from "@app/core/domain"
import {INDEXER_RELAYS} from "@app/core/env"
import {
  allowPubkeys,
  deriveSpacePermissions,
  deriveUserIsSpaceStaff,
} from "@app/features/spaces/management"
import {registerRetention} from "@app/core/storage"
import {pullAndListen, registerSync, syncEach} from "@app/core/sync"
import {currentSpaceUrls, syncedSpaceUrls, userRoomList, userSpaceUrls} from "@app/features/spaces"
import * as pages from "@app/navigation/pages"
import {loadSendDelay} from "@app/core/settings"

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

export const addressWriterToSpace = async <W extends EventWriter<BaseEventReader>>(
  eventWriter: W,
  url: string,
  h?: string,
) => {
  const space = await relays.get().load(url)

  eventWriter.setProtected(space?.hasNip(70))

  if (h) {
    eventWriter.setRoom(url, h)
  } else {
    eventWriter.forceRoutes(relay(url))
  }

  return eventWriter
}

export const publishRoomQuote = async ({
  url,
  h,
  parent,
  delay,
}: {
  url: string
  h?: string
  parent: TrustedEvent
  delay?: number
}) => {
  const eventWriter = await addressWriterToSpace(writer(Message).setParent(parent), url, h)

  return publisher.get().publish({
    relays: [url],
    event: await eventWriter.renderTemplate(),
    delay,
  })
}

export const publishComment = async ({
  url,
  event,
  parent = event,
  content,
  tags,
}: EventContent & {
  url: string
  event: TrustedEvent
  parent?: TrustedEvent
}) => {
  const eventWriter = await addressWriterToSpace(
    writer(Comment)
      .setContent(content)
      .addTags(...tags)
      .setRootFromEvent(event)
      .setParentFromEvent(parent),
    url,
    tagValue(tagSpec("h"), event.tags),
  )

  return publisher.get().publish({
    relays: [url],
    event: await eventWriter.renderTemplate(),
    delay: await loadSendDelay(),
  })
}

export const publishToSpace = async (
  eventWriter: EventWriter<BaseEventReader>,
  {url, h, shareToChat}: {url: string; h?: string; shareToChat?: boolean},
) => {
  const publication = await command(await addressWriterToSpace(eventWriter, url, h)).then(publish)
  const error = await publication.getError()

  if (shareToChat && !error) {
    publishRoomQuote({url, h, parent: publication.event})
  }

  return {publication, error}
}

// User

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

// A row of a room transcript: a message, a date divider, or the reader's unread marker.
export type RoomRow =
  | {type: "new-messages"; id: string}
  | {type: "date"; id: string; value: string}
  | {type: "note"; id: string; value: TrustedEvent; showPubkey: boolean}

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

// Sync

const syncSpaceRooms = (url: string) => {
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

const syncCurrentSpaceRooms = (url: string) =>
  pullAndListen(url, [
    {kinds: [ROOM_ADMINS, ROOM_MEMBERS, ROOM_PINS]},
    {kinds: [ROOM_JOIN, ROOM_LEAVE], since: ago(MONTH)},
  ])

export const registerRooms = () => {
  registerSync(() => syncEach(syncedSpaceUrls, syncSpaceRooms))
  registerSync(() => syncEach(currentSpaceUrls, syncCurrentSpaceRooms))

  registerRetention({
    match: event =>
      [
        ROOM_META,
        ROOM_DELETE,
        ROOM_ADMINS,
        ROOM_MEMBERS,
        ROOM_CREATE_PERMISSION,
        ROOM_PINS,
      ].includes(event.kind),
    provenance: true,
  })

  registerRetention({
    match: (event, pubkey) =>
      [ROOM_ADD_MEMBER, ROOM_REMOVE_MEMBER].includes(event.kind) &&
      tagValues(hexTags("p"), event.tags).includes(pubkey),
    provenance: true,
  })
}
