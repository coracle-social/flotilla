import twColors from "tailwindcss/colors"
import {get, derived} from "svelte/store"
import {nip19} from "nostr-tools"
import {
  ctx,
  setContext,
  remove,
  assoc,
  sortBy,
  sort,
  uniq,
  partition,
  nth,
  pushToMapKey,
  nthEq,
  shuffle,
  parseJson,
  fromPairs,
  memoize,
} from "@welshman/lib"
import {
  getIdFilters,
  WRAP,
  CLIENT_AUTH,
  AUTH_JOIN,
  REACTION,
  ZAP_RESPONSE,
  DIRECT_MESSAGE,
  GROUP_META,
  getGroupTags,
  getRelayTagValues,
  getPubkeyTagValues,
  isHashedEvent,
  displayProfile,
  readList,
  getListTags,
  asDecryptedEvent,
  normalizeRelayUrl,
} from "@welshman/util"
import type {TrustedEvent, SignedEvent, PublishedList, List, Filter} from "@welshman/util"
import {Nip59} from "@welshman/signer"
import {
  pubkey,
  repository,
  load,
  collection,
  profilesByPubkey,
  getDefaultAppContext,
  getDefaultNetContext,
  makeRouter,
  tracker,
  makeTrackerStore,
  relay,
  getSession,
  getSigner,
  hasNegentropy,
  pull,
  createSearch,
  userFollows,
  ensurePlaintext,
  thunks,
  walkThunks,
} from "@welshman/app"
import type {AppSyncOpts, Thunk} from "@welshman/app"
import type {SubscribeRequestWithHandlers} from "@welshman/net"
import {deriveEvents, deriveEventsMapped, withGetter, synced} from "@welshman/store"

export const ROOM = "h"

export const GENERAL = "_"

export const PROTECTED = ["-"]

export const MESSAGE = 9

export const LEGACY_MESSAGE = 209

export const THREAD = 11

export const LEGACY_THREAD = 309

export const COMMENT = 1111

export const MEMBERSHIPS = 10009

export const INDEXER_RELAYS = [
  "wss://purplepag.es/",
  "wss://relay.damus.io/",
  "wss://relay.nostr.band/",
]

export const SIGNER_RELAYS = ["wss://relay.nsec.app/", "wss://bucket.coracle.social/"]

export const PLATFORM_URL = window.location.origin

export const PLATFORM_LOGO = PLATFORM_URL + "/pwa-192x192.png"

export const PLATFORM_NAME = import.meta.env.VITE_PLATFORM_NAME

export const PLATFORM_RELAY = import.meta.env.VITE_PLATFORM_RELAY

export const PLATFORM_ACCENT = import.meta.env.VITE_PLATFORM_ACCENT

export const PLATFORM_DESCRIPTION = import.meta.env.VITE_PLATFORM_DESCRIPTION

export const BURROW_URL = import.meta.env.VITE_BURROW_URL

export const DEFAULT_PUBKEYS = import.meta.env.VITE_DEFAULT_PUBKEYS

export const DUFFLEPUD_URL = "https://dufflepud.onrender.com"

export const IMGPROXY_URL = "https://imgproxy.coracle.social"

export const REACTION_KINDS = [REACTION, ZAP_RESPONSE]

export const NIP46_PERMS =
  "nip04_encrypt,nip04_decrypt,nip44_encrypt,nip44_decrypt," +
  [CLIENT_AUTH, AUTH_JOIN, MESSAGE, THREAD, COMMENT, MEMBERSHIPS, WRAP, REACTION]
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

export const imgproxy = (url: string, {w = 640, h = 1024} = {}) => {
  if (!url || url.match("gif$")) {
    return url
  }

  url = url.split("?")[0]

  try {
    return url ? `${IMGPROXY_URL}/x/s:${w}:${h}/${btoa(url)}` : url
  } catch (e) {
    return url
  }
}

export const entityLink = (entity: string) => `https://coracle.social/${entity}`

export const pubkeyLink = (
  pubkey: string,
  relays = ctx.app.router.FromPubkeys([pubkey]).getUrls(),
) => entityLink(nip19.nprofileEncode({pubkey, relays}))

export const tagRoom = (room: string, url: string) => [ROOM, room]

export const getDefaultPubkeys = () => {
  const appPubkeys = DEFAULT_PUBKEYS.split(",")
  const userPubkeys = shuffle(getPubkeyTagValues(getListTags(get(userFollows))))

  return userPubkeys.length > 5 ? userPubkeys : [...userPubkeys, ...appPubkeys]
}

const failedUnwraps = new Set()

export const ensureUnwrapped = async (event: TrustedEvent) => {
  if (event.kind !== WRAP) {
    return event
  }

  let rumor = repository.eventsByWrap.get(event.id)

  if (rumor || failedUnwraps.has(event.id)) {
    return rumor
  }

  for (const recipient of getPubkeyTagValues(event.tags)) {
    const session = getSession(recipient)
    const signer = getSigner(session)

    if (signer) {
      try {
        rumor = await Nip59.fromSigner(signer).unwrap(event as SignedEvent)
        break
      } catch (e) {
        // pass
      }
    }
  }

  if (rumor && isHashedEvent(rumor)) {
    // Copy urls over to the rumor
    tracker.copy(event.id, rumor.id)

    // Send the rumor via our relay so listeners get updated
    relay.send("EVENT", rumor)
  } else {
    failedUnwraps.add(event.id)
  }

  return rumor
}

export const pullConservatively = ({relays, filters}: AppSyncOpts) => {
  const [smart, dumb] = partition(hasNegentropy, relays)
  const promises = [pull({relays: smart, filters})]

  // Since pulling from relays without negentropy is expensive, limit how many
  // duplicates we repeatedly download
  if (dumb.length > 0) {
    const events = sortBy(e => -e.created_at, repository.query(filters))

    if (events.length > 100) {
      filters = filters.map(assoc("since", events[100]!.created_at))
    }

    promises.push(pull({relays: dumb, filters}))
  }

  return Promise.all(promises)
}

export const trackerStore = makeTrackerStore()

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

    for (const thunk of walkThunks(Object.values($thunks))) {
      pushToMapKey(thunksByEventId, thunk.event.id, thunk)
    }

    return thunksByEventId
  })

  return (id: string) => {
    const urls = Array.from($tracker.getRelays(id))

    for (const thunk of getThunksByEventId().get(id) || []) {
      for (const url of thunk.request.relays) {
        urls.push(url)
      }
    }

    return uniq(urls)
  }
})

export const deriveEventsForUrl = (url: string, filters: Filter[]) =>
  derived([deriveEvents(repository, {filters}), getUrlsForEvent], ([$events, $getUrlsForEvent]) =>
    sortBy(
      e => -e.created_at,
      $events.filter(e => $getUrlsForEvent(e.id).includes(url)),
    ),
  )

// Context

setContext({
  net: getDefaultNetContext(),
  app: getDefaultAppContext({
    dufflepudUrl: DUFFLEPUD_URL,
    indexerRelays: INDEXER_RELAYS,
    requestTimeout: 5000,
    router: makeRouter(),
  }),
})

// Settings

export const canDecrypt = synced("canDecrypt", false)

export const SETTINGS = 38489

export type Settings = {
  event: TrustedEvent
  values: {
    show_media: boolean
    hide_sensitive: boolean
    send_delay: number
    upload_type: "nip96" | "blossom"
    nip96_urls: string[]
    blossom_urls: string[]
  }
}

export const defaultSettings = {
  show_media: true,
  hide_sensitive: true,
  send_delay: 3000,
  upload_type: "nip96",
  nip96_urls: ["https://nostr.build"],
  blossom_urls: ["https://cdn.satellite.earth"],
}

export const settings = deriveEventsMapped<Settings>(repository, {
  filters: [{kinds: [SETTINGS]}],
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
  load: (pubkey: string, request: Partial<SubscribeRequestWithHandlers> = {}) =>
    load({...request, filters: [{kinds: [SETTINGS], authors: [pubkey]}]}),
})

// Membership

export const hasMembershipUrl = (list: List | undefined, url: string) =>
  getListTags(list).some(t => {
    if (t[0] === "r") return t[1] === url
    if (t[0] === "group") return t[2] === url

    return false
  })

export const getMembershipUrls = (list?: List) => {
  const tags = getListTags(list)

  return sort(uniq([...getRelayTagValues(tags), ...getGroupTags(tags).map(nth(2))]))
}

export const getMembershipRooms = (list?: List) =>
  getGroupTags(getListTags(list)).map(t => ({url: t[2], room: t[1]}))

export const getMembershipRoomsByUrl = (url: string, list?: List) =>
  sort(
    getGroupTags(getListTags(list))
      .filter(t => t[2] === url)
      .map(nth(1)),
  )

export const memberships = deriveEventsMapped<PublishedList>(repository, {
  filters: [{kinds: [MEMBERSHIPS]}],
  itemToEvent: item => item.event,
  eventToItem: (event: TrustedEvent) => readList(asDecryptedEvent(event)),
})

export const {
  indexStore: membershipByPubkey,
  deriveItem: deriveMembership,
  loadItem: loadMembership,
} = collection({
  name: "memberships",
  store: memberships,
  getKey: list => list.event.pubkey,
  load: (pubkey: string, request: Partial<SubscribeRequestWithHandlers> = {}) =>
    load({
      ...request,
      filters: [{kinds: [MEMBERSHIPS], authors: [pubkey]}],
    }),
})

// Chats

export const chatMessages = deriveEvents(repository, {filters: [{kinds: [DIRECT_MESSAGE]}]})

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

    return sortBy(
      c => -c.last_activity,
      Array.from(messagesByChatId.entries()).map(([id, events]): Chat => {
        const pubkeys = splitChatId(id)
        const messages = sortBy(e => -e.created_at, events)
        const last_activity = messages[0].created_at
        const search_text = remove($pubkey as string, pubkeys)
          .map(pubkey => {
            const profile = $profilesByPubkey.get(pubkey)

            return profile ? displayProfile(profile) : ""
          })
          .join(" ")

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
})

export const chatSearch = derived(chats, $chats =>
  createSearch($chats, {
    getValue: (chat: Chat) => chat.id,
    fuseOptions: {keys: ["search_text"]},
  }),
)

// Messages

// TODO: remove support for legacy messages
export const messages = derived(
  deriveEvents(repository, {filters: [{kinds: [MESSAGE, LEGACY_MESSAGE]}]}),
  $events =>
    $events.map(e => {
      if (e.kind === LEGACY_MESSAGE) {
        let room = e.tags.find(nthEq(0, "~"))?.[1] || GENERAL

        if (room === "general") {
          room = GENERAL
        }

        return {...e, kind: MESSAGE, tags: [...e.tags, tagRoom(room, "")]}
      }

      return e
    }),
)

// Group Meta

export const groupMeta = deriveEvents(repository, {filters: [{kinds: [GROUP_META]}]})

// Channels

export type ChannelMeta = {
  access: "public" | "private"
  membership: "open" | "closed"
  picture?: string
  about?: string
}

export type Channel = {
  url: string
  room: string
  name: string
  events: TrustedEvent[]
  meta?: ChannelMeta
}

export const makeChannelId = (url: string, room: string) => `${url}|${room}`

export const splitChannelId = (id: string) => id.split("|")

export const channelsById = withGetter(
  derived(
    [groupMeta, memberships, messages, getUrlsForEvent],
    ([$groupMeta, $memberships, $messages, $getUrlsForEvent]) => {
      const eventsByChannelId = new Map<string, TrustedEvent[]>()

      // Add known rooms by membership so we have a full listing even if there are no messages there
      for (const membership of $memberships) {
        for (const {url, room} of getMembershipRooms(membership)) {
          eventsByChannelId.set(makeChannelId(url, room), [])
        }
      }

      // Add known messages to rooms
      for (const event of $messages) {
        const [_, room] = event.tags.find(nthEq(0, ROOM)) || []

        if (room) {
          for (const url of $getUrlsForEvent(event.id)) {
            pushToMapKey(eventsByChannelId, makeChannelId(url, room), event)
          }
        }
      }

      const channelsById = new Map<string, Channel>()

      for (const [id, unsorted] of eventsByChannelId.entries()) {
        const [url, room] = splitChannelId(id)
        const events = sortBy(e => -e.created_at, unsorted)

        let name = room
        for (const event of events) {
          const tag = event.tags.find(t => t[0] === ROOM && t[2])

          if (tag) {
            name = tag[2]
            break
          }
        }

        channelsById.set(id, {url, room, name, events})
      }

      // Add meta using group meta events
      for (const event of $groupMeta) {
        const meta = fromPairs(event.tags)
        const room = meta.d

        if (room) {
          for (const url of $getUrlsForEvent(event.id)) {
            const id = makeChannelId(url, room)
            const channel: Channel = channelsById.get(id) || {
              url,
              room,
              name: room,
              events: [],
            }

            if (meta.name) {
              channel.name = meta.name
            }

            channel.meta = {
              access: meta.public ? "public" : "private",
              membership: meta.open ? "open" : "closed",
              picture: meta.picture,
              about: meta.about,
            }

            channelsById.set(id, channel)
          }
        }
      }

      return channelsById
    },
  ),
)

export const deriveChannel = (url: string, room: string) =>
  derived(channelsById, $channelsById => $channelsById.get(makeChannelId(url, room)))

export const deriveChannelMessages = (url: string, room: string) =>
  derived(channelsById, $channelsById => $channelsById.get(makeChannelId(url, room))?.events || [])

export const channelsByUrl = derived(channelsById, $channelsById => {
  const $channelsByUrl = new Map<string, Channel[]>()

  for (const channel of $channelsById.values()) {
    pushToMapKey($channelsByUrl, channel.url, channel)
  }

  return $channelsByUrl
})

export const displayChannel = (url: string, room: string) => {
  if (room === GENERAL) {
    return "general"
  }

  return channelsById.get().get(makeChannelId(url, room))?.name || room
}

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

export const userSettingValues = withGetter(
  derived(userSettings, $s => $s?.values || defaultSettings),
)

export const getSetting = (key: keyof Settings["values"]) => userSettingValues.get()[key]

export const userMembership = withGetter(
  derived([pubkey, membershipByPubkey], ([$pubkey, $membershipByPubkey]) => {
    if (!$pubkey) return undefined

    loadMembership($pubkey)

    return $membershipByPubkey.get($pubkey)
  }),
)

export const deriveUserRooms = (url: string) =>
  derived(userMembership, $userMembership => [
    GENERAL,
    ...sortBy(roomComparator(url), getMembershipRoomsByUrl(url, $userMembership)),
  ])

export const deriveOtherRooms = (url: string) =>
  derived([deriveUserRooms(url), channelsByUrl], ([$userRooms, $channelsByUrl]) =>
    sortBy(
      roomComparator(url),
      ($channelsByUrl.get(url) || []).filter(c => !$userRooms.includes(c.room)).map(c => c.room),
    ),
  )

// Other utils

export const encodeRelay = (url: string) => encodeURIComponent(normalizeRelayUrl(url))

export const decodeRelay = (url: string) => normalizeRelayUrl(decodeURIComponent(url))

export const displayReaction = (content: string) => {
  if (!content || content === "+") return "❤️"
  if (content === "-") return "👎"
  return content
}
