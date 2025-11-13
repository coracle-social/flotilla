import twColors from "tailwindcss/colors"
import {Capacitor} from "@capacitor/core"
import {get, derived, writable} from "svelte/store"
import * as nip19 from "nostr-tools/nip19"
import {
  on,
  gt,
  max,
  spec,
  call,
  first,
  assoc,
  remove,
  uniqBy,
  sortBy,
  sort,
  prop,
  uniq,
  pushToMapKey,
  shuffle,
  parseJson,
  memoize,
  addToMapKey,
  identity,
  groupBy,
  always,
  tryCatch,
  fromPairs,
} from "@welshman/lib"
import type {Socket} from "@welshman/net"
import {
  Pool,
  load,
  SocketStatus,
  AuthStateEvent,
  AuthStatus,
  SocketEvent,
  netContext,
} from "@welshman/net"
import {collection, custom, throttled, deriveEvents, deriveEventsMapped} from "@welshman/store"
import {isKindFeed, findFeed} from "@welshman/feeds"
import {
  ALERT_ANDROID,
  ALERT_EMAIL,
  ALERT_IOS,
  ALERT_STATUS,
  ALERT_WEB,
  APP_DATA,
  CLIENT_AUTH,
  COMMENT,
  DELETE,
  DIRECT_MESSAGE_FILE,
  DIRECT_MESSAGE,
  EVENT_TIME,
  MESSAGE,
  REACTION,
  RELAY_ADD_MEMBER,
  RELAY_JOIN,
  RELAY_LEAVE,
  RELAY_MEMBERS,
  RELAY_REMOVE_MEMBER,
  REPORT,
  ROOM_ADD_MEMBER,
  ROOM_CREATE_PERMISSION,
  ROOM_JOIN,
  ROOM_LEAVE,
  ROOM_MEMBERS,
  ROOM_ADMINS,
  ROOM_META,
  ROOM_DELETE,
  ROOM_REMOVE_MEMBER,
  ROOMS,
  THREAD,
  WRAP,
  ZAP_GOAL,
  ZAP_REQUEST,
  ZAP_RESPONSE,
  asDecryptedEvent,
  displayProfile,
  getGroupTags,
  getIdFilters,
  getListTags,
  getPubkeyTagValues,
  getRelaysFromList,
  getRelayTagValues,
  getTagValue,
  getTagValues,
  isRelayUrl,
  makeEvent,
  normalizeRelayUrl,
  readList,
  RelayMode,
  verifyEvent,
  readRoomMeta,
  makeRoomMeta,
  ManagementMethod,
} from "@welshman/util"
import type {
  TrustedEvent,
  RelayProfile,
  PublishedList,
  PublishedRoomMeta,
  List,
  Filter,
} from "@welshman/util"
import {decrypt} from "@welshman/signer"
import {routerContext, Router} from "@welshman/router"
import {
  pubkey,
  repository,
  profilesByPubkey,
  tracker,
  makeTrackerStore,
  makeRepositoryStore,
  createSearch,
  userFollows,
  ensurePlaintext,
  thunks,
  sign,
  signer,
  makeOutboxLoader,
  appContext,
  getThunkError,
  publishThunk,
  userRelaySelections,
  userInboxRelaySelections,
  deriveRelay,
  makeUserData,
  makeUserLoader,
  manageRelay,
} from "@welshman/app"
import type {Thunk} from "@welshman/app"

export const fromCsv = (s: string) => (s || "").split(",").filter(identity)

export const ROOM = "h"

export const PROTECTED = ["-"]

export const ENABLE_ZAPS = Capacitor.getPlatform() != "ios"

export const NOTIFIER_PUBKEY = import.meta.env.VITE_NOTIFIER_PUBKEY

export const NOTIFIER_RELAY = import.meta.env.VITE_NOTIFIER_RELAY

export const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY

export const INDEXER_RELAYS = fromCsv(import.meta.env.VITE_INDEXER_RELAYS)

export const SIGNER_RELAYS = fromCsv(import.meta.env.VITE_SIGNER_RELAYS)

export const PLATFORM_URL = import.meta.env.VITE_PLATFORM_URL

export const PLATFORM_TERMS = import.meta.env.VITE_PLATFORM_TERMS

export const PLATFORM_PRIVACY = import.meta.env.VITE_PLATFORM_PRIVACY

export const PLATFORM_LOGO = PLATFORM_URL + "/logo.png"

export const PLATFORM_NAME = import.meta.env.VITE_PLATFORM_NAME

export const PLATFORM_RELAYS = fromCsv(import.meta.env.VITE_PLATFORM_RELAYS)

export const PLATFORM_ACCENT = import.meta.env.VITE_PLATFORM_ACCENT

export const PLATFORM_DESCRIPTION = import.meta.env.VITE_PLATFORM_DESCRIPTION

export const DEFAULT_BLOSSOM_SERVERS = fromCsv(import.meta.env.VITE_DEFAULT_BLOSSOM_SERVERS)

export const BURROW_URL = import.meta.env.VITE_BURROW_URL

export const DEFAULT_PUBKEYS = import.meta.env.VITE_DEFAULT_PUBKEYS

export const DUFFLEPUD_URL = "https://dufflepud.onrender.com"

export const NIP46_PERMS =
  "nip44_encrypt,nip44_decrypt," +
  [CLIENT_AUTH, RELAY_JOIN, MESSAGE, THREAD, COMMENT, ROOMS, WRAP, REACTION, ZAP_REQUEST]
    .map(k => `sign_event:${k}`)
    .join(",")

export const colors = [
  ["amber", twColors.amber[600]],
  ["blue", twColors.blue[600]],
  ["cyan", twColors.cyan[600]],
  ["emerald", twColors.emerald[600]],
  ["fuchsia", twColors.fuchsia[600]],
  ["green", twColors.green[600]],
  ["indigo", twColors.indigo[600]],
  ["sky", twColors.sky[600]],
  ["lime", twColors.lime[600]],
  ["orange", twColors.orange[600]],
  ["pink", twColors.pink[600]],
  ["purple", twColors.purple[600]],
  ["red", twColors.red[600]],
  ["rose", twColors.rose[600]],
  ["sky", twColors.sky[600]],
  ["teal", twColors.teal[600]],
  ["violet", twColors.violet[600]],
  ["yellow", twColors.yellow[600]],
  ["zinc", twColors.zinc[600]],
]

export const dufflepud = (path: string) => DUFFLEPUD_URL + "/" + path

export const entityLink = (entity: string) => `https://coracle.social/${entity}`

export const pubkeyLink = (pubkey: string, relays = Router.get().FromPubkeys([pubkey]).getUrls()) =>
  entityLink(nip19.nprofileEncode({pubkey, relays}))

export const bootstrapPubkeys = derived(userFollows, $userFollows => {
  const appPubkeys = DEFAULT_PUBKEYS.split(",")
  const userPubkeys = shuffle(getPubkeyTagValues(getListTags($userFollows)))

  return userPubkeys.length > 5 ? userPubkeys : [...userPubkeys, ...appPubkeys]
})

export const trackerStore = makeTrackerStore()

export const repositoryStore = makeRepositoryStore()

export const deriveEvent = (idOrAddress: string, hints: string[] = []) => {
  let attempted = false

  const filters = getIdFilters([idOrAddress])
  const relays = [...hints, ...INDEXER_RELAYS]

  return derived(
    deriveEvents(repository, {filters, includeDeleted: true}),
    (events: TrustedEvent[]) => {
      if (!attempted && events.length === 0) {
        load({relays, filters})
        attempted = true
      }

      return events[0]
    },
  )
}

export const getUrlsForEvent = derived([trackerStore, thunks], ([$tracker, $thunks]) => {
  const getThunksByEventId = memoize(() => {
    const thunksByEventId = new Map<string, Thunk[]>()

    for (const thunk of $thunks) {
      pushToMapKey(thunksByEventId, thunk.event.id, thunk)
    }

    return thunksByEventId
  })

  return (id: string) => {
    const urls = Array.from($tracker.getRelays(id))

    for (const thunk of getThunksByEventId().get(id) || []) {
      for (const url of thunk.options.relays) {
        urls.push(url)
      }
    }

    return uniq(urls)
  }
})

export const getEventsForUrl = (url: string, filters: Filter[]) => {
  const ids = uniq([
    ...tracker.getIds(url),
    ...get(thunks)
      .filter(t => t.options.relays.includes(url))
      .map(t => t.event.id),
  ])

  return repository.query(filters.map(assoc("ids", ids)))
}

export const deriveEventsForUrl = (url: string, filters: Filter[]) =>
  derived([trackerStore, thunks], ([$tracker, $thunks]) => {
    const ids = uniq([
      ...$tracker.getIds(url),
      ...$thunks.filter(t => t.options.relays.includes(url)).map(t => t.event.id),
    ])

    return repository.query(filters.map(assoc("ids", ids)))
  })

export const deriveSignedEventsForUrl = (url: string, filters: Filter[]) =>
  derived(
    [deriveEventsForUrl(url, filters), deriveRelay(url)],
    ([$events, $relay]) => $events,
    // Disable this check for now since khatru doesn't support self
    // $relay?.self ? $events.filter(spec({pubkey: $relay.self})) : [],
  )

// Context

appContext.dufflepudUrl = DUFFLEPUD_URL

routerContext.getIndexerRelays = always(INDEXER_RELAYS)

netContext.isEventValid = (event: TrustedEvent, url: string) =>
  getSetting<string[]>("trusted_relays").includes(url) || verifyEvent(event)

// Filters

export const makeCommentFilter = (kinds: number[], extra: Filter = {}) => ({
  kinds: [COMMENT],
  "#K": kinds.map(String),
  ...extra,
})

export const REACTION_KINDS = [REPORT, DELETE, REACTION]

if (ENABLE_ZAPS) {
  REACTION_KINDS.push(ZAP_RESPONSE)
}

export const CONTENT_KINDS = [ZAP_GOAL, EVENT_TIME, THREAD]

export const MESSAGE_KINDS = [...CONTENT_KINDS, MESSAGE]

// Settings

export const SETTINGS = "flotilla/settings"

export type SettingsValues = {
  show_media: boolean
  hide_sensitive: boolean
  trusted_relays: string[]
  report_usage: boolean
  report_errors: boolean
  send_delay: number
  font_size: number
  play_notification_sound: boolean
  show_notifications_badge: boolean
}

export type Settings = {
  event: TrustedEvent
  values: SettingsValues
}

export const defaultSettings = {
  show_media: true,
  hide_sensitive: true,
  trusted_relays: [],
  report_usage: true,
  report_errors: true,
  send_delay: 0,
  font_size: 1,
  play_notification_sound: true,
  show_notifications_badge: true,
}

export const settings = deriveEventsMapped<Settings>(repository, {
  filters: [{kinds: [APP_DATA], "#d": [SETTINGS]}],
  itemToEvent: item => item.event,
  eventToItem: async (event: TrustedEvent) => ({
    event,
    values: {...defaultSettings, ...parseJson(await ensurePlaintext(event))},
  }),
})

export const {
  indexStore: settingsByPubkey,
  deriveItem: deriveSettings,
  loadItem: loadSettings,
} = collection({
  name: "settings",
  store: settings,
  getKey: settings => settings.event.pubkey,
  load: makeOutboxLoader(APP_DATA, {"#d": [SETTINGS]}),
})

export const userSettings = makeUserData({
  mapStore: settingsByPubkey,
  loadItem: loadSettings,
})

export const loadUserSettings = makeUserLoader(loadSettings)

export const userSettingsValues = derived(userSettings, $s => $s?.values || defaultSettings)

export const getSetting = <T>(key: keyof Settings["values"]) => get(userSettingsValues)[key] as T

// Relays sending events with empty signatures that the user has to choose to trust

export const relaysPendingTrust = writable<string[]>([])

// Relays that mostly send restricted responses to requests and events

export const relaysMostlyRestricted = writable<Record<string, string>>({})

// Relay selections

export const userReadRelays = derived(userRelaySelections, $l =>
  getRelaysFromList($l, RelayMode.Read),
)

export const userWriteRelays = derived(userRelaySelections, $l =>
  getRelaysFromList($l, RelayMode.Write),
)

export const userInboxRelays = derived(userInboxRelaySelections, $l => getRelaysFromList($l))

// Alerts

export type Alert = {
  event: TrustedEvent
  tags: string[][]
}

export const alerts = deriveEventsMapped<Alert>(repository, {
  filters: [{kinds: [ALERT_EMAIL, ALERT_WEB, ALERT_IOS, ALERT_ANDROID]}],
  itemToEvent: item => item.event,
  eventToItem: async event => {
    const $signer = signer.get()

    if ($signer) {
      const tags = parseJson(await decrypt($signer, NOTIFIER_PUBKEY, event.content))

      return {event, tags}
    }
  },
})

export const getAlertFeed = (alert: Alert) =>
  tryCatch(() => JSON.parse(getTagValue("feed", alert.tags)!))

export const dmAlert = derived(alerts, $alerts =>
  $alerts.find(alert => {
    const feed = getAlertFeed(alert)

    return findFeed(feed, f => isKindFeed(f) && f.includes(WRAP))
  }),
)

// Alert Statuses

export type AlertStatus = {
  event: TrustedEvent
  tags: string[][]
}

export const alertStatuses = deriveEventsMapped<AlertStatus>(repository, {
  filters: [{kinds: [ALERT_STATUS]}],
  itemToEvent: item => item.event,
  eventToItem: async event => {
    const $signer = signer.get()

    if ($signer) {
      const tags = parseJson(await decrypt($signer, NOTIFIER_PUBKEY, event.content))

      return {event, tags}
    }
  },
})

export const deriveAlertStatus = (address: string) =>
  derived(alertStatuses, statuses => statuses.find(s => getTagValue("d", s.event.tags) === address))

// Chats

export const chatMessages = deriveEvents(repository, {
  filters: [{kinds: [DIRECT_MESSAGE, DIRECT_MESSAGE_FILE]}],
})

export type Chat = {
  id: string
  pubkeys: string[]
  messages: TrustedEvent[]
  last_activity: number
  search_text: string
}

export const makeChatId = (pubkeys: string[]) => sort(uniq(pubkeys.concat(pubkey.get()!))).join(",")

export const splitChatId = (id: string) => id.split(",")

export const chats = derived(
  [pubkey, chatMessages, profilesByPubkey],
  ([$pubkey, $messages, $profilesByPubkey]) => {
    const messagesByChatId = new Map<string, TrustedEvent[]>()

    for (const message of $messages) {
      const chatId = makeChatId(getPubkeyTagValues(message.tags).concat(message.pubkey))

      pushToMapKey(messagesByChatId, chatId, message)
    }

    const displayPubkey = (pubkey: string) => {
      const profile = $profilesByPubkey.get(pubkey)

      return profile ? displayProfile(profile) : ""
    }

    return sortBy(
      c => -c.last_activity,
      Array.from(messagesByChatId.entries()).map(([id, events]): Chat => {
        const pubkeys = remove($pubkey!, splitChatId(id))
        const messages = sortBy(e => -e.created_at, uniqBy(prop("id"), events))
        const last_activity = messages[0].created_at
        const search_text =
          pubkeys.length === 0
            ? displayPubkey($pubkey!) + " note to self"
            : pubkeys.map(displayPubkey).join(" ")

        return {id, pubkeys, messages, last_activity, search_text}
      }),
    )
  },
)

export const {
  indexStore: chatsById,
  deriveItem: deriveChat,
  loadItem: loadChat,
} = collection({
  name: "chats",
  store: chats,
  getKey: chat => chat.id,
  load: always(Promise.resolve()),
})

export const chatSearch = derived(chats, $chats =>
  createSearch($chats, {
    getValue: (chat: Chat) => chat.id,
    fuseOptions: {keys: ["search_text"]},
  }),
)

// Rooms

export const messages = deriveEvents(repository, {filters: [{kinds: [MESSAGE]}]})

export type Room = PublishedRoomMeta & {
  id: string
  url: string
}

export const makeRoomId = (url: string, h: string) => `${url}'${h}`

export const splitRoomId = (id: string) => id.split("'")

export const hasNip29 = (relay?: RelayProfile) =>
  relay?.supported_nips?.map?.(String)?.includes?.("29")

export const roomMetas = deriveEventsMapped<PublishedRoomMeta>(repository, {
  filters: [{kinds: [ROOM_META]}],
  itemToEvent: item => item.event,
  eventToItem: readRoomMeta,
})

export const roomDeletes = deriveEvents(repository, {
  filters: [{kinds: [ROOM_DELETE]}],
})

export const rooms = derived(
  [roomMetas, roomDeletes, getUrlsForEvent],
  ([$roomMetas, $roomDeletes, $getUrlsForEvent]) => {
    const result = new Map<string, Room>()
    const deletedByH = new Map<string, number>()

    for (const event of $roomDeletes) {
      for (const h of getTagValues("h", event.tags)) {
        deletedByH.set(h, max([deletedByH.get(h), event.created_at]))
      }
    }

    for (const meta of $roomMetas) {
      if (gt(deletedByH.get(meta.h), meta.event.created_at)) {
        continue
      }

      for (const url of $getUrlsForEvent(meta.event.id)) {
        const id = makeRoomId(url, meta.h)

        result.set(id, {...meta, url, id})
      }
    }

    return Array.from(result.values())
  },
)

export const roomsByUrl = derived(rooms, $rooms => groupBy(c => c.url, $rooms))

export const {
  indexStore: roomsById,
  deriveItem: _deriveRoom,
  loadItem: _loadRoom,
} = collection({
  name: "rooms",
  store: rooms,
  getKey: room => room.id,
  load: async (id: string) => {
    const [url, h] = splitRoomId(id)

    await load({
      relays: [url],
      filters: [{kinds: [ROOM_META], "#d": [h]}],
    })
  },
})

export const deriveRoom = (url: string, h: string) =>
  derived(_deriveRoom(makeRoomId(url, h)), $meta => $meta || makeRoomMeta({h}))

export const displayRoom = (url: string, h: string) =>
  roomsById.get().get(makeRoomId(url, h))?.name || h

export const roomComparator = (url: string) => (h: string) => displayRoom(url, h).toLowerCase()

// User space/room selections

export const groupSelections = deriveEventsMapped<PublishedList>(repository, {
  filters: [{kinds: [ROOMS]}],
  itemToEvent: item => item.event,
  eventToItem: (event: TrustedEvent) => readList(asDecryptedEvent(event)),
})

export const {
  indexStore: groupSelectionsByPubkey,
  deriveItem: deriveGroupSelections,
  loadItem: loadGroupSelections,
} = collection({
  name: "groupSelections",
  store: groupSelections,
  getKey: list => list.event.pubkey,
  load: makeOutboxLoader(ROOMS),
})

export const groupSelectionsPubkeysByUrl = derived(groupSelections, $groupSelections => {
  const result = new Map<string, Set<string>>()

  for (const list of $groupSelections) {
    const tags = getListTags(list)

    for (const url of getRelayTagValues(tags)) {
      addToMapKey(result, url, list.event.pubkey)
    }

    for (const tag of getGroupTags(tags)) {
      const url = tag[2] || ""

      if (isRelayUrl(url)) {
        addToMapKey(result, url, list.event.pubkey)
      }
    }
  }

  return result
})

export const getSpaceUrlsFromGroupSelections = ($groupSelections: List | undefined) => {
  const tags = getListTags($groupSelections)
  const urls = getRelayTagValues(tags)

  for (const tag of getGroupTags(tags)) {
    const url = tag[2] || ""

    if (isRelayUrl(url)) {
      urls.push(url)
    }
  }

  return uniq(urls.map(normalizeRelayUrl))
}

export const getSpaceRoomsFromGroupSelections = (
  url: string,
  $groupSelections: List | undefined,
) => {
  const rooms: string[] = []

  for (const [_, h, relay] of getGroupTags(getListTags($groupSelections))) {
    if (url === relay) {
      rooms.push(h)
    }
  }

  return sortBy(roomComparator(url), rooms)
}

export const userGroupSelections = makeUserData({
  mapStore: groupSelectionsByPubkey,
  loadItem: loadGroupSelections,
})

export const loadUserGroupSelections = makeUserLoader(loadGroupSelections)

export const userSpaceUrls = derived(userGroupSelections, getSpaceUrlsFromGroupSelections)

export const deriveUserRooms = (url: string) =>
  derived([userGroupSelections, roomsById], ([$userGroupSelections, $roomsById]) => {
    const rooms: string[] = []

    for (const h of getSpaceRoomsFromGroupSelections(url, $userGroupSelections)) {
      if ($roomsById.has(makeRoomId(url, h))) {
        rooms.push(h)
      }
    }

    return sortBy(roomComparator(url), rooms)
  })

export const deriveOtherRooms = (url: string) =>
  derived([deriveUserRooms(url), roomsByUrl], ([$userRooms, $roomsByUrl]) => {
    const rooms: string[] = []

    for (const {h} of $roomsByUrl.get(url) || []) {
      if (!$userRooms.includes(h)) {
        rooms.push(h)
      }
    }

    return sortBy(roomComparator(url), rooms)
  })

// Space/room memberships

export const deriveSpaceMembers = (url: string) =>
  derived(
    deriveSignedEventsForUrl(url, [
      {kinds: [RELAY_ADD_MEMBER, RELAY_REMOVE_MEMBER, RELAY_MEMBERS]},
    ]),
    $events => {
      const membersEvent = $events.find(spec({kind: RELAY_MEMBERS}))

      if (membersEvent) {
        return getTagValues("member", membersEvent.tags)
      }

      const members = new Set<string>()

      for (const event of sortBy(e => e.created_at, $events)) {
        const pubkeys = getPubkeyTagValues(event.tags)

        if (event.kind === RELAY_ADD_MEMBER) {
          for (const pubkey of pubkeys) {
            members.add(pubkey)
          }
        }

        if (event.kind === RELAY_REMOVE_MEMBER) {
          for (const pubkey of pubkeys) {
            members.delete(pubkey)
          }
        }
      }

      return Array.from(members)
    },
  )

export type BannedPubkeyItem = {
  pubkey: string
  reason: string
}

export const spaceBannedPubkeyItems = new Map<string, BannedPubkeyItem[]>()

export const deriveSpaceBannedPubkeyItems = (url: string) => {
  const store = writable(spaceBannedPubkeyItems.get(url) || [])

  manageRelay(url, {method: ManagementMethod.ListBannedPubkeys, params: []}).then(res => {
    spaceBannedPubkeyItems.set(url, res.result)
    store.set(res.result)
  })

  return store
}

export const deriveRoomMembers = (url: string, h: string) =>
  derived(
    deriveEventsForUrl(url, [
      {kinds: [ROOM_MEMBERS], "#d": [h]},
      {kinds: [ROOM_ADD_MEMBER, ROOM_REMOVE_MEMBER], "#h": [h]},
    ]),
    $events => {
      const membersEvent = $events.find(spec({kind: ROOM_MEMBERS}))

      if (membersEvent) {
        return getPubkeyTagValues(membersEvent.tags)
      }

      const members = new Set<string>()

      for (const event of sortBy(e => -e.created_at, $events)) {
        const pubkeys = getPubkeyTagValues(event.tags)

        if (event.kind === ROOM_ADD_MEMBER) {
          for (const pubkey of pubkeys) {
            members.add(pubkey)
          }
        }

        if (event.kind === ROOM_REMOVE_MEMBER) {
          for (const pubkey of pubkeys) {
            members.delete(pubkey)
          }
        }
      }

      return Array.from(members)
    },
  )

export const deriveRoomAdmins = (url: string, h: string) =>
  derived(deriveEventsForUrl(url, [{kinds: [ROOM_ADMINS], "#d": [h]}]), $events => {
    const adminsEvent = first($events)

    if (adminsEvent) {
      return getPubkeyTagValues(adminsEvent.tags)
    }

    return []
  })

// User membership status

export enum MembershipStatus {
  Initial,
  Pending,
  Granted,
}

export const deriveUserIsSpaceAdmin = memoize((url: string) => {
  const store = writable(false)

  manageRelay(url, {method: ManagementMethod.SupportedMethods, params: []}).then(res =>
    store.set(Boolean(res.result?.length)),
  )

  return store
})

export const deriveUserSpaceMembershipStatus = (url: string) =>
  derived(
    [
      pubkey,
      deriveSpaceMembers(url),
      deriveEventsForUrl(url, [{kinds: [RELAY_JOIN, RELAY_LEAVE]}]),
      deriveUserIsSpaceAdmin(url),
    ],
    ([$pubkey, $members, $events, $isAdmin]) => {
      const isMember = $members.includes($pubkey!) || $isAdmin

      for (const event of $events) {
        if (event.pubkey !== $pubkey) {
          continue
        }

        if (event.kind === RELAY_JOIN) {
          return isMember ? MembershipStatus.Granted : MembershipStatus.Pending
        }

        if (event.kind === RELAY_LEAVE) {
          return MembershipStatus.Initial
        }
      }

      return isMember ? MembershipStatus.Granted : MembershipStatus.Initial
    },
  )

export const deriveUserIsRoomAdmin = (url: string, h: string) =>
  derived(
    [pubkey, deriveRoomAdmins(url, h), deriveUserIsSpaceAdmin(url)],
    ([$pubkey, $admins, $isSpaceAdmin]) => $isSpaceAdmin || $admins.includes($pubkey!),
  )

export const deriveUserRoomMembershipStatus = (url: string, h: string) =>
  derived(
    [
      pubkey,
      deriveRoomMembers(url, h),
      deriveEventsForUrl(url, [{kinds: [ROOM_JOIN, ROOM_LEAVE], "#h": [h]}]),
      deriveUserIsRoomAdmin(url, h),
    ],
    ([$pubkey, $members, $events, $isAdmin]) => {
      const isMember = $members.includes($pubkey!) || $isAdmin

      for (const event of $events) {
        if (event.pubkey !== $pubkey) {
          continue
        }

        if (event.kind === ROOM_JOIN) {
          return isMember ? MembershipStatus.Granted : MembershipStatus.Pending
        }

        if (event.kind === ROOM_LEAVE) {
          return MembershipStatus.Initial
        }
      }

      return isMember ? MembershipStatus.Granted : MembershipStatus.Initial
    },
  )

export const deriveUserCanCreateRoom = (url: string) =>
  derived(
    [
      pubkey,
      deriveEventsForUrl(url, [{kinds: [ROOM_CREATE_PERMISSION]}]),
      deriveUserIsSpaceAdmin(url),
    ],
    ([$pubkey, $events, $isAdmin]) => {
      for (const event of $events) {
        if (getPubkeyTagValues(event.tags).includes($pubkey!)) {
          return true
        }
      }

      return $isAdmin
    },
  )

// Other utils

export const encodeRelay = (url: string) =>
  encodeURIComponent(
    normalizeRelayUrl(url)
      .replace(/^wss:\/\//, "")
      .replace(/\/$/, ""),
  )

export const decodeRelay = (url: string) => normalizeRelayUrl(decodeURIComponent(url))

export const displayReaction = (content: string) => {
  if (!content || content === "+") return "❤️"
  if (content === "-") return "👎"
  return content
}

export const deriveSocket = (url: string) =>
  custom<Socket>(set => {
    const pool = Pool.get()
    const socket = pool.get(url)

    set(socket)

    const subs = [
      on(socket, SocketEvent.Error, () => set(socket)),
      on(socket, SocketEvent.Status, () => set(socket)),
      on(socket.auth, AuthStateEvent.Status, () => set(socket)),
    ]

    return () => subs.forEach(call)
  })

export const deriveSocketStatus = (url: string) =>
  throttled(
    800,
    derived([deriveSocket(url), relaysMostlyRestricted], ([$socket, $relaysMostlyRestricted]) => {
      if ($socket.status === SocketStatus.Opening) {
        return {theme: "warning", title: "Connecting"}
      }

      if ($socket.status === SocketStatus.Closing) {
        return {theme: "gray-500", title: "Not Connected"}
      }

      if ($socket.status === SocketStatus.Closed) {
        return {theme: "gray-500", title: "Not Connected"}
      }

      if ($socket.status === SocketStatus.Error) {
        return {theme: "error", title: "Failed to Connect"}
      }

      if ($socket.auth.status === AuthStatus.Requested) {
        return {theme: "warning", title: "Authenticating"}
      }

      if ($socket.auth.status === AuthStatus.PendingSignature) {
        return {theme: "warning", title: "Authenticating"}
      }

      if ($socket.auth.status === AuthStatus.DeniedSignature) {
        return {theme: "error", title: "Failed to Authenticate"}
      }

      if ($socket.auth.status === AuthStatus.PendingResponse) {
        return {theme: "warning", title: "Authenticating"}
      }

      if ($socket.auth.status === AuthStatus.Forbidden) {
        return {theme: "error", title: "Access Denied"}
      }

      if ($relaysMostlyRestricted[url]) {
        return {theme: "error", title: "Access Denied"}
      }

      return {theme: "success", title: "Connected"}
    }),
  )

export const deriveTimeout = (timeout: number) => {
  const store = writable<boolean>(false)

  setTimeout(() => store.set(true), timeout)

  return derived(store, identity)
}

export const shouldIgnoreError = (error: string) => {
  const isIgnored = error.startsWith("mute: ")
  const isAborted = error.includes("Signing was aborted")
  const isStrictNip29Relay = error.includes("missing group (`h`) tag")

  return isIgnored || isAborted || isStrictNip29Relay
}

export const deriveRelayAuthError = (url: string, claim = "") => {
  const stripPrefix = (m: string) => m.replace(/^\w+: /, "")

  // Kick off the auth process
  Pool.get().get(url).auth.attemptAuth(sign)

  // Attempt to join the relay
  const thunk = publishThunk({
    event: makeEvent(RELAY_JOIN, {tags: [["claim", claim]]}),
    relays: [url],
  })

  return derived(
    [thunk, relaysMostlyRestricted, deriveSocket(url)],
    ([$thunk, $relaysMostlyRestricted, $socket]) => {
      if ($socket.auth.status === AuthStatus.Forbidden && $socket.auth.details) {
        return stripPrefix($socket.auth.details)
      }

      if ($relaysMostlyRestricted[url]) {
        return stripPrefix($relaysMostlyRestricted[url])
      }

      const error = getThunkError($thunk)

      if (error) {
        const isEmptyInvite = !claim && error.includes("invite code")

        if (!shouldIgnoreError(error) && !isEmptyInvite) {
          return stripPrefix(error) || "join request rejected"
        }
      }
    },
  )
}

export type InviteData = {url: string; claim: string}

export const parseInviteLink = (invite: string): InviteData | undefined =>
  tryCatch(() => {
    const {r: relay = "", c: claim = ""} = fromPairs(Array.from(new URL(invite).searchParams))
    const url = normalizeRelayUrl(relay)

    if (isRelayUrl(url)) {
      return {url, claim}
    }
  }) ||
  tryCatch(() => {
    const url = normalizeRelayUrl(invite)

    if (isRelayUrl(url)) {
      return {url, claim: ""}
    }
  })
