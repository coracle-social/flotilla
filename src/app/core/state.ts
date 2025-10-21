import twColors from "tailwindcss/colors"
import {Capacitor} from "@capacitor/core"
import {get, derived, writable} from "svelte/store"
import * as nip19 from "nostr-tools/nip19"
import {
  on,
  call,
  assoc,
  remove,
  uniqBy,
  sortBy,
  sort,
  uniq,
  nth,
  pushToMapKey,
  nthEq,
  shuffle,
  parseJson,
  fromPairs,
  memoize,
  addToMapKey,
  identity,
  groupBy,
  always,
  tryCatch,
  last,
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
import {
  collection,
  custom,
  throttled,
  deriveEvents,
  deriveEventsMapped,
  withGetter,
} from "@welshman/store"
import {isKindFeed, findFeed} from "@welshman/feeds"
import {
  getIdFilters,
  WRAP,
  DELETE,
  CLIENT_AUTH,
  AUTH_JOIN,
  REACTION,
  ZAP_REQUEST,
  ZAP_RESPONSE,
  DIRECT_MESSAGE,
  DIRECT_MESSAGE_FILE,
  ROOM_META,
  MESSAGE,
  ROOMS,
  THREAD,
  COMMENT,
  REPORT,
  ROOM_JOIN,
  ROOM_ADD_USER,
  ROOM_REMOVE_USER,
  ROOM_CREATE_PERMISSION,
  ALERT_EMAIL,
  ALERT_WEB,
  ALERT_IOS,
  ALERT_ANDROID,
  ALERT_STATUS,
  APP_DATA,
  ZAP_GOAL,
  EVENT_TIME,
  getGroupTags,
  getRelayTagValues,
  getPubkeyTagValues,
  displayProfile,
  readList,
  getListTags,
  asDecryptedEvent,
  normalizeRelayUrl,
  getTag,
  getTagValue,
  getTagValues,
  verifyEvent,
  makeEvent,
  RelayMode,
  getRelaysFromList,
} from "@welshman/util"
import type {TrustedEvent, PublishedList, List, Filter} from "@welshman/util"
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
  signer,
  makeOutboxLoader,
  appContext,
  getThunkError,
  publishThunk,
  userRelaySelections,
  userInboxRelaySelections,
} from "@welshman/app"
import type {Thunk, Relay} from "@welshman/app"

export const fromCsv = (s: string) => (s || "").split(",").filter(identity)

export const ROOM = "h"

export const PROTECTED = ["-"]

export const ENABLE_ZAPS = Capacitor.getPlatform() != "ios"

export const NOTIFIER_PUBKEY = import.meta.env.VITE_NOTIFIER_PUBKEY

export const NOTIFIER_RELAY = import.meta.env.VITE_NOTIFIER_RELAY

export const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY

export const INDEXER_RELAYS = fromCsv(import.meta.env.VITE_INDEXER_RELAYS)

export const SIGNER_RELAYS = fromCsv(import.meta.env.VITE_SIGNER_RELAYS)

export const PLATFORM_URL = window.location.origin

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
  [CLIENT_AUTH, AUTH_JOIN, MESSAGE, THREAD, COMMENT, ROOMS, WRAP, REACTION, ZAP_REQUEST]
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

export const defaultPubkeys = derived(userFollows, $userFollows => {
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

export const MESSAGE_KINDS = [ZAP_GOAL, EVENT_TIME, THREAD, MESSAGE]

export const MESSAGE_FILTER = {kinds: MESSAGE_KINDS}

export const COMMENT_FILTER = makeCommentFilter(MESSAGE_KINDS)

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

// Relays sending events with empty signatures that the user has to choose to trust

export const relaysPendingTrust = withGetter(writable<string[]>([]))

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

export const alerts = withGetter(
  deriveEventsMapped<Alert>(repository, {
    filters: [{kinds: [ALERT_EMAIL, ALERT_WEB, ALERT_IOS, ALERT_ANDROID]}],
    itemToEvent: item => item.event,
    eventToItem: async event => {
      const $signer = signer.get()

      if ($signer) {
        const tags = parseJson(await decrypt($signer, NOTIFIER_PUBKEY, event.content))

        return {event, tags}
      }
    },
  }),
)

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

export const alertStatuses = withGetter(
  deriveEventsMapped<AlertStatus>(repository, {
    filters: [{kinds: [ALERT_STATUS]}],
    itemToEvent: item => item.event,
    eventToItem: async event => {
      const $signer = signer.get()

      if ($signer) {
        const tags = parseJson(await decrypt($signer, NOTIFIER_PUBKEY, event.content))

        return {event, tags}
      }
    },
  }),
)

export const deriveAlertStatus = (address: string) =>
  derived(alertStatuses, statuses => statuses.find(s => getTagValue("d", s.event.tags) === address))

// Membership

export const hasMembershipUrl = (list: List | undefined, url: string) =>
  getListTags(list).some(t => {
    if (t[0] === "r") return t[1] === url
    if (t[0] === "group") return t[2] === url

    return false
  })

export const getMembershipUrls = (list?: List) => {
  const tags = getListTags(list)

  return sort(
    uniq([...getRelayTagValues(tags), ...getGroupTags(tags).map(nth(2))]).map(url =>
      normalizeRelayUrl(url),
    ),
  )
}

export const getMembershipRooms = (list?: List) =>
  getGroupTags(getListTags(list)).map(([_, room, url, name = ""]) => ({url, room, name}))

export const getMembershipRoomsByUrl = (url: string, list?: List) =>
  sort(getGroupTags(getListTags(list)).filter(nthEq(2, url)).map(nth(1)))

export const memberships = deriveEventsMapped<PublishedList>(repository, {
  filters: [{kinds: [ROOMS]}],
  itemToEvent: item => item.event,
  eventToItem: (event: TrustedEvent) => readList(asDecryptedEvent(event)),
})

export const {
  indexStore: membershipsByPubkey,
  deriveItem: deriveMembership,
  loadItem: loadMembership,
} = collection({
  name: "memberships",
  store: memberships,
  getKey: list => list.event.pubkey,
  load: makeOutboxLoader(ROOMS),
})

export const membersByUrl = derived(
  [defaultPubkeys, membershipsByPubkey],
  ([$defaultPubkeys, $membershipsByPubkey]) => {
    const $membersByUrl = new Map<string, Set<string>>()

    for (const pubkey of $defaultPubkeys) {
      for (const url of getMembershipUrls($membershipsByPubkey.get(pubkey))) {
        addToMapKey($membersByUrl, url, pubkey)
      }
    }

    return $membersByUrl
  },
)

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
        const messages = sortBy(e => -e.created_at, events)
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

// Messages

export const messages = deriveEvents(repository, {filters: [{kinds: [MESSAGE]}]})

// Channels

export type Channel = {
  id: string
  url: string
  room: string
  name: string
  event: TrustedEvent
  closed: boolean
  private: boolean
  picture?: string
  about?: string
}

export const makeChannelId = (url: string, room: string) => `${url}'${room}`

export const splitChannelId = (id: string) => id.split("'")

export const hasNip29 = (relay?: Relay) =>
  relay?.profile?.supported_nips?.map?.(String)?.includes?.("29")

export const channelEvents = deriveEvents(repository, {filters: [{kinds: [ROOM_META]}]})

export const channels = derived(
  [channelEvents, getUrlsForEvent],
  ([$channelEvents, $getUrlsForEvent]) => {
    const $channels: Channel[] = []

    for (const event of $channelEvents) {
      const meta = fromPairs(event.tags)
      const room = meta.d

      if (room) {
        for (const url of $getUrlsForEvent(event.id)) {
          const id = makeChannelId(url, room)

          $channels.push({
            id,
            url,
            room,
            event,
            name: meta.name || room,
            closed: Boolean(getTag("closed", event.tags)),
            private: Boolean(getTag("private", event.tags)),
            picture: meta.picture,
            about: meta.about,
          })
        }
      }
    }

    return uniqBy(c => c.id, $channels)
  },
)

export const channelsByUrl = derived(channels, $channels => groupBy(c => c.url, $channels))

export const {
  indexStore: channelsById,
  deriveItem: _deriveChannel,
  loadItem: _loadChannel,
} = collection({
  name: "channels",
  store: channels,
  getKey: channel => channel.id,
  load: async (id: string) => {
    const [url, room] = splitChannelId(id)

    await load({
      relays: [url],
      filters: [{kinds: [ROOM_META], "#d": [room]}],
    })
  },
})

export const deriveChannel = (url: string, room: string) => _deriveChannel(makeChannelId(url, room))

export const loadChannel = (url: string, room: string) => _loadChannel(makeChannelId(url, room))

export const displayChannel = (url: string, room: string) =>
  channelsById.get().get(makeChannelId(url, room))?.name || room

export const roomComparator = (url: string) => (room: string) =>
  displayChannel(url, room).toLowerCase()

// User stuff

export const userSettings = withGetter(
  derived([pubkey, settingsByPubkey], ([$pubkey, $settingsByPubkey]) => {
    if (!$pubkey) return undefined

    loadSettings($pubkey)

    return $settingsByPubkey.get($pubkey)
  }),
)

export const userSettingsValues = withGetter(
  derived(userSettings, $s => $s?.values || defaultSettings),
)

export const getSetting = <T>(key: keyof Settings["values"]) => userSettingsValues.get()[key] as T

export const userMembership = withGetter(
  derived([pubkey, membershipsByPubkey], ([$pubkey, $membershipsByPubkey]) => {
    if (!$pubkey) return undefined

    loadMembership($pubkey)

    return $membershipsByPubkey.get($pubkey)
  }),
)

export const userRoomsByUrl = withGetter(
  derived([userMembership, channelsById], ([$userMembership, $channelsById]) => {
    const tags = getListTags($userMembership)
    const $userRoomsByUrl = new Map<string, Set<string>>()

    for (const url of getRelayTagValues(tags)) {
      $userRoomsByUrl.set(normalizeRelayUrl(url), new Set())
    }

    for (const [_, room, url] of getGroupTags(tags)) {
      if ($channelsById.has(makeChannelId(url, room))) {
        addToMapKey($userRoomsByUrl, normalizeRelayUrl(url), room)
      }
    }

    return $userRoomsByUrl
  }),
)

export const deriveUserRooms = (url: string) =>
  derived(userRoomsByUrl, $userRoomsByUrl =>
    sortBy(roomComparator(url), uniq(Array.from($userRoomsByUrl.get(url) || []))),
  )

export const deriveOtherRooms = (url: string) =>
  derived([deriveUserRooms(url), channelsByUrl], ([$userRooms, $channelsByUrl]) =>
    sortBy(
      roomComparator(url),
      ($channelsByUrl.get(url) || []).filter(c => !$userRooms.includes(c.room)).map(c => c.room),
    ),
  )

export enum MembershipStatus {
  Initial,
  Pending,
  Granted,
}

export const deriveUserMembershipStatus = (url: string, room: string) =>
  derived(
    [
      pubkey,
      deriveEventsForUrl(url, [
        {kinds: [ROOM_JOIN, ROOM_ADD_USER, ROOM_REMOVE_USER], "#h": [room]},
      ]),
    ],
    ([$pubkey, $events]) => {
      let status = MembershipStatus.Initial

      for (const event of $events) {
        if (event.kind === ROOM_JOIN && event.pubkey === $pubkey) {
          status = MembershipStatus.Pending
        }

        if (event.kind === ROOM_REMOVE_USER && getTagValues("p", event.tags).includes($pubkey!)) {
          break
        }

        if (event.kind === ROOM_ADD_USER && getTagValues("p", event.tags).includes($pubkey!)) {
          return MembershipStatus.Granted
        }
      }

      return status
    },
  )

export const deriveUserCanCreateRoom = (url: string) =>
  derived(
    [pubkey, deriveEventsForUrl(url, [{kinds: [ROOM_CREATE_PERMISSION]}])],
    ([$pubkey, $events]) => {
      const latest = last($events)

      if (!latest) {
        return true
      }

      return getTagValues("p", latest.tags).includes($pubkey!)
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

export const deriveRelayAuthError = (url: string, claim = "") => {
  const $signer = signer.get()
  const socket = Pool.get().get(url)
  const stripPrefix = (m: string) => m.replace(/^\w+: /, "")

  // Kick off the auth process
  socket.auth.attemptAuth($signer.sign)

  // Attempt to join the relay
  const thunk = publishThunk({
    event: makeEvent(AUTH_JOIN, {tags: [["claim", claim]]}),
    relays: [url],
  })

  return derived(
    [relaysMostlyRestricted, deriveSocket(url)],
    ([$relaysMostlyRestricted, $socket]) => {
      if ($socket.auth.status === AuthStatus.Forbidden && $socket.auth.details) {
        return stripPrefix($socket.auth.details)
      }

      if ($relaysMostlyRestricted[url]) {
        return stripPrefix($relaysMostlyRestricted[url])
      }

      const error = getThunkError(thunk)

      if (error) {
        const isIgnored = error.startsWith("mute: ")
        const isEmptyInvite = !claim && error.includes("invite code")
        const isStrictNip29Relay = error.includes("missing group (`h`) tag")

        if (!isStrictNip29Relay && !isIgnored && !isEmptyInvite && !isStrictNip29Relay) {
          return stripPrefix(error) || "join request rejected"
        }
      }
    },
  )
}
