import twColors from "tailwindcss/colors"
import {context as pomadeContext} from "@pomade/core"
import {Capacitor} from "@capacitor/core"
import {derived, readable, writable} from "svelte/store"
import * as nip19 from "nostr-tools/nip19"
import {
  on,
  gt,
  max,
  find,
  spec,
  call,
  first,
  uniqBy,
  sortBy,
  append,
  sort,
  uniq,
  indexBy,
  partition,
  shuffle,
  parseJson,
  memoize,
  addToMapKey,
  identity,
  always,
  randomId,
  tryCatch,
  fromPairs,
  remove,
} from "@welshman/lib"
import type {Override} from "@welshman/lib"
import type {RepositoryUpdate} from "@welshman/net"
import {
  Pool,
  load,
  SocketStatus,
  AuthStateEvent,
  AuthStatus,
  SocketEvent,
  netContext,
} from "@welshman/net"
import {
  getter,
  throttled,
  withGetter,
  deriveArray,
  makeDeriveEvent,
  makeLoadItem,
  makeDeriveItem,
  deriveItemsByKey,
  deriveDeduplicated,
  deriveEventsById,
  deriveEventsByIdByUrl,
  deriveEventsByIdForUrl,
  getEventsByIdForUrl,
  deriveEventsAsc,
  deriveEventsDesc,
} from "@welshman/store"
import {
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
  CLASSIFIED,
  WRAP,
  PROFILE,
  ZAP_GOAL,
  ZAP_REQUEST,
  ZAP_RESPONSE,
  asDecryptedEvent,
  getGroupTags,
  getListTags,
  getPubkeyTagValues,
  getRelayTagValues,
  getTagValues,
  isRelayUrl,
  normalizeRelayUrl,
  readList,
  verifyEvent,
  readRoomMeta,
  makeRoomMeta,
  ManagementMethod,
  sortEventsDesc,
} from "@welshman/util"
import type {TrustedEvent, RelayProfile, PublishedRoomMeta, List, Filter} from "@welshman/util"
import {routerContext, Router} from "@welshman/router"
import {
  pubkey,
  repository,
  tracker,
  createSearch,
  userFollowList,
  ensurePlaintext,
  makeOutboxLoader,
  appContext,
  deriveRelay,
  makeUserData,
  makeUserLoader,
  manageRelay,
  displayProfileByPubkey,
} from "@welshman/app"

export const fromCsv = (s: string) => (s || "").split(",").filter(identity)

export const ROOM = "h"

export const PROTECTED = ["-"]

export const ENABLE_ZAPS = Capacitor.getPlatform() != "ios"

export const PUSH_SERVER = import.meta.env.VITE_PUSH_SERVER

export const PUSH_BRIDGE = normalizeRelayUrl(import.meta.env.VITE_PUSH_BRIDGE)

export const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY

export const SIGNER_RELAYS = fromCsv(import.meta.env.VITE_SIGNER_RELAYS).map(normalizeRelayUrl)

export const BLOCKED_RELAYS = fromCsv(import.meta.env.VITE_BLOCKED_RELAYS).map(normalizeRelayUrl)

export const INDEXER_RELAYS = fromCsv(import.meta.env.VITE_INDEXER_RELAYS).map(normalizeRelayUrl)

export const DEFAULT_RELAYS = fromCsv(import.meta.env.VITE_DEFAULT_RELAYS).map(normalizeRelayUrl)

export const DEFAULT_MESSAGING_RELAYS = fromCsv(import.meta.env.VITE_DEFAULT_MESSAGING_RELAYS).map(
  normalizeRelayUrl,
)

export const PLATFORM_RELAYS = fromCsv(import.meta.env.VITE_PLATFORM_RELAYS).map(normalizeRelayUrl)

export const PLATFORM_URL = import.meta.env.VITE_PLATFORM_URL

export const PLATFORM_TERMS = import.meta.env.VITE_PLATFORM_TERMS

export const PLATFORM_PRIVACY = import.meta.env.VITE_PLATFORM_PRIVACY

export const PLATFORM_LOGO = PLATFORM_URL + "/logo.png"

export const PLATFORM_NAME = import.meta.env.VITE_PLATFORM_NAME

export const PLATFORM_ACCENT = import.meta.env.VITE_PLATFORM_ACCENT

export const PLATFORM_DESCRIPTION = import.meta.env.VITE_PLATFORM_DESCRIPTION

export const POMADE_SIGNERS = fromCsv(import.meta.env.VITE_POMADE_SIGNERS)

export const DEFAULT_BLOSSOM_SERVERS = fromCsv(import.meta.env.VITE_DEFAULT_BLOSSOM_SERVERS)

export const DEFAULT_PUBKEYS = import.meta.env.VITE_DEFAULT_PUBKEYS

export const DUFFLEPUD_URL = "https://dufflepud.onrender.com"

export const NIP46_PERMS =
  "nip44_encrypt,nip44_decrypt," +
  [
    CLIENT_AUTH,
    RELAY_JOIN,
    MESSAGE,
    THREAD,
    CLASSIFIED,
    COMMENT,
    ROOMS,
    WRAP,
    REACTION,
    ZAP_REQUEST,
  ]
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

export const bootstrapPubkeys = derived(userFollowList, $userFollowList => {
  const appPubkeys = DEFAULT_PUBKEYS.split(",")
  const userPubkeys = shuffle(getPubkeyTagValues(getListTags($userFollowList)))

  return userPubkeys.length > 5 ? userPubkeys : [...userPubkeys, ...appPubkeys]
})

export const deriveEvent = makeDeriveEvent({
  repository,
  includeDeleted: true,
  onDerive: (filters: Filter[], relays: string[]) => load({filters, relays}),
})

export const deriveEvents = (filters: Filter[] = [{}]) =>
  deriveEventsDesc(deriveEventsById({repository, filters}))

export const getEventsForUrl = (url: string, filters: Filter[] = [{}]) =>
  getEventsByIdForUrl({url, tracker, repository, filters}).values()

export const deriveEventsForUrl = (url: string, filters: Filter[] = [{}]) =>
  deriveArray(deriveEventsByIdForUrl({url, tracker, repository, filters}))

export const deriveEventsForUrlAsc = (url: string, filters: Filter[] = [{}]) =>
  deriveEventsAsc(deriveEventsByIdForUrl({url, tracker, repository, filters}))

export const deriveEventsForUrlDesc = (url: string, filters: Filter[] = [{}]) =>
  deriveEventsDesc(deriveEventsByIdForUrl({url, tracker, repository, filters}))

export const deriveLatestEventForUrl = (url: string, filters: Filter[] = [{}]) =>
  deriveDeduplicated(deriveEventsByIdForUrl({url, tracker, repository, filters}), $eventsById =>
    first(sortEventsDesc($eventsById.values())),
  )

export const deriveRelaySignedEvents = (url: string, filters: Filter[] = [{}]) =>
  derived(
    [deriveRelay(url), deriveEventsForUrl(url, filters)],
    ([relay, events]) => events,
    // khatru doesn't support relay.self, uncomment when it's ready
    // filter(spec({pubkey: relay.self}), events)
  )

// Context

pomadeContext.setSignerPubkeys(POMADE_SIGNERS)

pomadeContext.setArgonWorker(import("@pomade/core/argon-worker.js?worker"))

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

export const CONTENT_KINDS = [ZAP_GOAL, EVENT_TIME, THREAD, CLASSIFIED]

export const MESSAGE_KINDS = [...CONTENT_KINDS, MESSAGE]

export const DM_KINDS = [DIRECT_MESSAGE, DIRECT_MESSAGE_FILE]

// Settings

export const SETTINGS = "flotilla/settings"

export enum RelayAuthMode {
  Aggressive = "aggressive",
  Conservative = "conservative",
}

export type SpaceNotificationSettings = {
  url: string
  notify: boolean
  exceptions: string[]
}

export type SettingsValues = {
  show_media: boolean
  hide_sensitive: boolean
  trusted_relays: string[]
  report_usage: boolean
  report_errors: boolean
  relay_auth: RelayAuthMode
  send_delay: number
  font_size: number
  alerts: SpaceNotificationSettings[]
}

export type Settings = {
  event: TrustedEvent
  values: SettingsValues
}

export const defaultSettings: SettingsValues = {
  show_media: true,
  hide_sensitive: true,
  trusted_relays: [],
  report_usage: true,
  report_errors: true,
  relay_auth: RelayAuthMode.Conservative,
  send_delay: 0,
  font_size: 1.1,
  alerts: [],
}

export const settingsByPubkey = deriveItemsByKey({
  repository,
  getKey: settings => settings.event.pubkey,
  filters: [{kinds: [APP_DATA], "#d": [SETTINGS]}],
  eventToItem: async (event: TrustedEvent) => {
    const values = {...defaultSettings, ...parseJson(await ensurePlaintext(event))}

    return {event, values}
  },
})

export const getSettingsByPubkey = getter(settingsByPubkey)

export const loadSettings = makeLoadItem(
  makeOutboxLoader(APP_DATA, {"#d": [SETTINGS]}),
  (pubkey: string) => getSettingsByPubkey().get(pubkey),
)

export const userSettings = makeUserData(settingsByPubkey, loadSettings)

export const loadUserSettings = makeUserLoader(loadSettings)

export const userSettingsValues = derived(userSettings, $s => $s?.values || defaultSettings)

export const getSettings = getter(userSettingsValues)

export const getSetting = <T>(key: keyof Settings["values"]) => getSettings()[key] as T

// Relays sending events with empty signatures that the user has to choose to trust

export const relaysPendingTrust = writable<string[]>([])

// Relays that mostly send restricted responses to requests and events

export const relaysMostlyRestricted = writable<Record<string, string>>({})

// Push notifications

export const device = withGetter(writable(randomId()))

export const notificationSettings = withGetter(
  writable({
    push: false,
    sound: false,
    badge: false,
    spaces: true,
    mentions: true,
    messages: true,
  }),
)

export type PushSubscription = {
  key: string
  callback: string
}

export type PushState = {
  token?: string
  subscription?: PushSubscription
}

export const notificationState = withGetter(writable<PushState>({}))

// Chats

export type Chat = {
  id: string
  pubkeys: string[]
  messages: TrustedEvent[]
  last_activity: number
  search_text: string
}

export const getChatPubkeys = (pubkeys: string[]) => sort(uniq(append(pubkey.get()!, pubkeys)))

export const getChatPubkeysFromEvent = (event: TrustedEvent) =>
  getChatPubkeys(getPubkeyTagValues(event.tags).concat(event.pubkey))

export const makeChatId = (pubkeys: string[]) => {
  const userPubkey = pubkey.get()!
  const otherPubkeys = remove(userPubkey, uniq(pubkeys))
  const visiblePubkeys = otherPubkeys.length === 0 ? [userPubkey] : otherPubkeys

  return sort(visiblePubkeys).join(",")
}

export const splitChatId = (id: string) => getChatPubkeys(id.split(","))

export const chatsById = call(() => {
  const chatsById = new Map<string, Chat>()
  const chatsByPubkey = new Map<string, Chat[]>()

  const addSearchText = (chat: Override<Chat, {search_text?: string}>) => {
    chat.search_text =
      chat.pubkeys.length === 1
        ? displayProfileByPubkey(chat.pubkeys[0]) + " note to self"
        : remove(pubkey.get()!, chat.pubkeys).map(displayProfileByPubkey).join(" ")

    return chat as Chat
  }

  return readable(chatsById, set => {
    const addEvents = (events: TrustedEvent[]) => {
      let dirty = false
      for (const event of events) {
        if (DM_KINDS.includes(event.kind)) {
          const pubkeys = getChatPubkeysFromEvent(event)
          const id = makeChatId(pubkeys)
          const chat = chatsById.get(id)
          const messages = sortBy(e => -e.created_at, append(event, chat?.messages || []))
          const last_activity = Math.max(chat?.last_activity || 0, event.created_at)
          const updatedChat = addSearchText({id, pubkeys, messages, last_activity})

          chatsById.set(id, updatedChat)

          for (const pubkey of pubkeys) {
            const pubkeyChats = chatsByPubkey.get(pubkey) || []
            const uniqueChats = uniqBy(chat => chat.id, append(updatedChat, pubkeyChats))

            chatsByPubkey.set(pubkey, uniqueChats)
          }

          dirty = true
        }

        if (event.kind === PROFILE) {
          for (const chat of chatsByPubkey.get(event.pubkey) || []) {
            addSearchText(chat)
            dirty = true
          }
        }
      }

      if (dirty) {
        set(chatsById)
      }
    }

    addEvents(repository.query([{kinds: [DIRECT_MESSAGE, PROFILE]}]))

    const unsubscribers = [
      on(repository, "update", ({added}: RepositoryUpdate) => addEvents(added)),
    ]

    return () => unsubscribers.forEach(call)
  })
})

export const deriveChat = call(() => {
  const _deriveChat = makeDeriveItem(chatsById)

  return (pubkeys: string[]) => _deriveChat(makeChatId(pubkeys))
})

export const chatSearch = derived(throttled(800, chatsById), $chatsByPubkey => {
  return createSearch(
    sortBy(c => -c.last_activity, Array.from($chatsByPubkey.values())),
    {
      getValue: (chat: Chat) => chat.id,
      fuseOptions: {keys: ["search_text"]},
    },
  )
})

// Rooms

export type Room = PublishedRoomMeta & {
  id: string
  url: string
}

export const makeRoomId = (url: string, h: string) => `${url}'${h}`

export const splitRoomId = (id: string) => id.split("'")

export const hasNip29 = (relay?: RelayProfile) =>
  relay?.supported_nips?.map?.(String)?.includes?.("29")

export const roomMetaEventsByIdByUrl = deriveEventsByIdByUrl({
  tracker,
  repository,
  filters: [{kinds: [ROOM_META, ROOM_DELETE]}],
})

export const roomsByUrl = derived(roomMetaEventsByIdByUrl, roomMetaEventsByIdByUrl => {
  const metaByIdByUrl = new Map<string, Map<string, Room>>()

  for (const [url, events] of roomMetaEventsByIdByUrl.entries()) {
    const [metaEvents, deleteEvents] = partition(spec({kind: ROOM_META}), events.values())
    const deletedByH = new Map<string, number>()

    for (const event of deleteEvents) {
      for (const h of getTagValues("h", event.tags)) {
        deletedByH.set(h, max([deletedByH.get(h), event.created_at]))
      }
    }

    for (const event of metaEvents) {
      const meta = tryCatch(() => readRoomMeta(event))

      if (!meta || gt(deletedByH.get(meta.h), meta.event.created_at)) {
        continue
      }

      let metaById = metaByIdByUrl.get(url)
      if (!metaById) {
        metaById = new Map()
        metaByIdByUrl.set(url, metaById)
      }

      const id = makeRoomId(url, meta.h)

      metaById.set(id, {...meta, url, id})
    }
  }

  const result = new Map<string, Room[]>()

  for (const [url, metaById] of metaByIdByUrl.entries()) {
    result.set(url, Array.from(metaById.values()))
  }

  return result
})

export const roomsById = derived(roomsByUrl, roomsByUrl =>
  indexBy(room => room.id, Array.from(roomsByUrl.values()).flatMap(identity)),
)

export const getRoomsById = getter(roomsById)

export const getRoom = (id: string) => getRoomsById().get(id)

export const loadRoom = call(() => {
  const _fetchRoom = async (id: string) => {
    const [url, h] = splitRoomId(id)

    await load({
      relays: [url],
      filters: [{kinds: [ROOM_META], "#d": [h]}],
    })
  }

  const _loadRoom = makeLoadItem(_fetchRoom, getRoom)

  return (url: string, h: string) => _loadRoom(makeRoomId(url, h))
})

export const deriveRoom = call(() => {
  const _deriveRoom = makeDeriveItem(roomsById, loadRoom)

  return (url: string, h: string) =>
    derived(
      _deriveRoom(makeRoomId(url, h)),
      room => room || {url, id: makeRoomId(url, h), ...makeRoomMeta({h})},
    )
})

export const displayRoom = (url: string, h: string) => getRoom(makeRoomId(url, h))?.name || h

export const roomComparator = (url: string) => (h: string) => displayRoom(url, h).toLowerCase()

// User space/room lists

export const groupListsByPubkey = deriveItemsByKey({
  repository,
  filters: [{kinds: [ROOMS]}],
  getKey: list => list.event.pubkey,
  eventToItem: (event: TrustedEvent) => readList(asDecryptedEvent(event)),
})

export const getGroupListsByPubkey = getter(groupListsByPubkey)

export const getGroupList = (pubkey: string) => getGroupListsByPubkey().get(pubkey)

export const loadGroupList = makeLoadItem(makeOutboxLoader(ROOMS), getGroupList)

export const deriveGroupList = makeDeriveItem(groupListsByPubkey, loadGroupList)

export const groupListPubkeysByUrl = derived(groupListsByPubkey, $groupListsByPubkey => {
  const result = new Map<string, Set<string>>()

  for (const list of $groupListsByPubkey.values()) {
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

export const deriveGroupListPubkeys = (url: string) =>
  derived(groupListPubkeysByUrl, $groupListPubkeysByUrl => new Set($groupListPubkeysByUrl.get(url)))

export const getSpaceUrlsFromGroupList = (groupList: List | undefined) => {
  const tags = getListTags(groupList)
  const urls = getRelayTagValues(tags)

  for (const tag of getGroupTags(tags)) {
    const url = tag[2] || ""

    if (isRelayUrl(url)) {
      urls.push(url)
    }
  }

  return uniq(urls.map(normalizeRelayUrl))
}

export const getSpaceRoomsFromGroupList = (url: string, groupList: List | undefined) => {
  const rooms: string[] = []

  for (const [_, h, relay] of getGroupTags(getListTags(groupList))) {
    if (url === relay) {
      rooms.push(h)
    }
  }

  return sortBy(roomComparator(url), uniq(rooms))
}

export const userGroupList = makeUserData(groupListsByPubkey, loadGroupList)

export const loadUserGroupList = makeUserLoader(loadGroupList)

export const userSpaceUrls = derived(userGroupList, getSpaceUrlsFromGroupList)

export const deriveUserRooms = (url: string) =>
  derived([userGroupList, roomsById], ([$userGroupList, $roomsById]) => {
    const rooms: string[] = []

    for (const h of getSpaceRoomsFromGroupList(url, $userGroupList)) {
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

    return sortBy(roomComparator(url), uniq(rooms))
  })

// Space/room memberships

export const deriveSpaceMembers = (url: string) =>
  derived(
    deriveRelaySignedEvents(url, [{kinds: [RELAY_ADD_MEMBER, RELAY_REMOVE_MEMBER, RELAY_MEMBERS]}]),
    $events => {
      const membersEvent = $events.find(spec({kind: RELAY_MEMBERS}))

      if (membersEvent) {
        return uniq(getTagValues("member", membersEvent.tags))
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

export const deriveRoomMembers = (url: string, h: string) => {
  const filters: Filter[] = [
    {kinds: [ROOM_MEMBERS], "#d": [h]},
    {kinds: [ROOM_ADD_MEMBER, ROOM_REMOVE_MEMBER], "#h": [h]},
  ]

  return derived(deriveEventsForUrl(url, filters), $events => {
    const membersEvent = find(spec({kind: ROOM_MEMBERS}), $events)

    if (membersEvent) {
      return uniq(getPubkeyTagValues(membersEvent.tags))
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
  })
}

export const deriveRoomAdmins = (url: string, h: string) => {
  const filters: Filter[] = [{kinds: [ROOM_ADMINS], "#d": [h]}]

  return derived(deriveEventsForUrl(url, filters), $events => {
    const adminsEvent = first($events)

    if (adminsEvent) {
      return getPubkeyTagValues(adminsEvent.tags)
    }

    return []
  })
}

// User membership status

export enum MembershipStatus {
  Initial,
  Pending,
  Granted,
}

export const deriveUserIsSpaceAdmin = memoize((url?: string) => {
  const store = writable(false)

  if (url) {
    manageRelay(url, {method: ManagementMethod.SupportedMethods, params: []}).then(res =>
      store.set(Boolean(res.result?.length)),
    )
  }

  return store
})

export const deriveUserSpaceMembershipStatus = (url: string) => {
  const filters: Filter[] = [{kinds: [RELAY_JOIN, RELAY_LEAVE]}]

  return derived(
    [
      pubkey,
      deriveSpaceMembers(url),
      deriveEventsForUrl(url, filters),
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
}

export const deriveUserIsRoomAdmin = (url: string, h: string) =>
  derived(
    [pubkey, deriveRoomAdmins(url, h), deriveUserIsSpaceAdmin(url)],
    ([$pubkey, $admins, $isSpaceAdmin]) => $isSpaceAdmin || $admins.includes($pubkey!),
  )

export const deriveUserRoomMembershipStatus = (url: string, h: string) => {
  const filters: Filter[] = [{kinds: [ROOM_JOIN, ROOM_LEAVE], "#h": [h]}]

  return derived(
    [
      pubkey,
      deriveRoomMembers(url, h),
      deriveEventsForUrl(url, filters),
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
}

export const deriveUserCanCreateRoom = (url: string) => {
  const filters: Filter[] = [{kinds: [ROOM_CREATE_PERMISSION]}]

  return derived(
    [pubkey, deriveEventsForUrl(url, filters), deriveUserIsSpaceAdmin(url)],
    ([$pubkey, $events, $isAdmin]) => {
      for (const event of $events) {
        if (getPubkeyTagValues(event.tags).includes($pubkey!)) {
          return true
        }
      }

      return $isAdmin
    },
  )
}

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

export const deriveSocket = (url: string) => {
  const socket = Pool.get().get(url)

  return readable(socket, set => {
    const subs = [
      on(socket, SocketEvent.Error, () => set(socket)),
      on(socket, SocketEvent.Status, () => set(socket)),
      on(socket.auth, AuthStateEvent.Status, () => set(socket)),
    ]

    return () => subs.forEach(call)
  })
}

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

export const stripPrefix = (m: string) => m.replace(/^\w+: /, "")

export type InviteData = {url: string; claim: string}

export const parseInviteLink = (invite: string): InviteData | undefined => {
  if (invite.length < 3 || !invite.includes(".")) {
    return
  }

  return (
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
  )
}

// Hierarchical notification helpers

export const getShouldNotify = ({alerts}: SettingsValues, url: string, h?: string) => {
  const pref = alerts.find(spec({url}))

  if (!pref) return true
  if (!h) return pref.notify
  if (pref.notify) return !pref.exceptions.includes(h)
  if (!pref.notify) return pref.exceptions.includes(h)
}

export const shouldNotify = (url: string, h?: string) => getShouldNotify(getSettings(), url, h)

export const deriveShouldNotify = (url: string, h?: string) =>
  derived(userSettingsValues, $settings => getShouldNotify($settings, url, h))
