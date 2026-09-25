import {page} from "$app/stores"
import type {Unsubscriber} from "svelte/store"
import {ago, assoc, call, noop, MONTH, WEEK} from "@welshman/lib"
import type {Maybe} from "@welshman/lib"
import {
  APP_DATA,
  DELETE,
  FOLLOWS,
  MESSAGE,
  MUTES,
  PINBOARD,
  POLL_RESPONSE,
  RELAY_ADD_MEMBER,
  RELAY_MEMBERS,
  RELAY_REMOVE_MEMBER,
  RELAY_ROLE,
  REPORT,
  ROOM_ADD_MEMBER,
  ROOM_ADMINS,
  ROOM_CREATE_PERMISSION,
  ROOM_DELETE,
  ROOM_JOIN,
  ROOM_LEAVE,
  ROOM_MEMBERS,
  ROOM_META,
  ROOM_PINS,
  ROOM_REMOVE_MEMBER,
  WRAP,
  outbox,
  unionFilters,
} from "@welshman/util"
import type {Filter} from "@welshman/util"
import type {FollowListReader, RoomListReader} from "@welshman/domain"
import {merged, synced, throttled, withGetter} from "@welshman/store"
import {
  FollowLists,
  MessagingRelayLists,
  RelayLists,
  RoomLists,
  SearchRelayLists,
  Sync,
} from "@welshman/app"
import {
  app,
  blockedRelayLists,
  blossomServerLists,
  deriveUserItem,
  followLists,
  messagingRelayLists,
  muteLists,
  network,
  profiles,
  relayLists,
  relays,
  roomLists,
  rooms,
  router,
  searchRelayLists,
} from "@app/core"
import {LIVEKIT_PARTICIPANTS} from "@app/call"
import {CONTENT_KINDS, makeCommentFilter} from "@app/content"
import {INDEXER_RELAYS, PLATFORM_RELAYS} from "@app/env"
import {FEATURED_CONTENT_D} from "@app/featured"
import {decodeRelay} from "@app/relays"
import {Settings} from "@app/settings"
import {kv} from "@app/storage"
import {hasBlossomSupport} from "@app/uploads"

// Unwrapping is unconditional, so this is what keeps a signer from decrypting the whole DM history.
export const shouldUnwrap = withGetter(
  synced({key: "shouldUnwrap", storage: kv, defaultValue: false}),
)

// Utils

type SyncOpts = {
  url: string
  signal: AbortSignal
  filters: Filter[]
}

const pullAndListen = ({url, signal, filters}: SyncOpts) => {
  if (signal.aborted) {
    return
  }

  app
    .get()
    .use(Sync)
    .pull({relays: [url], filters})
  network.get().request({
    relays: [url],
    signal,
    filters: unionFilters(filters.map(assoc("limit", 0))),
  })
}

const userRoomList = deriveUserItem(RoomLists)

const userRelayList = deriveUserItem(RelayLists)

const userFollowList = deriveUserItem(FollowLists)

const userMessagingRelayList = deriveUserItem(MessagingRelayLists)

const userSearchRelayList = deriveUserItem(SearchRelayLists)

const getSpaceUrls = ($roomList: Maybe<RoomListReader>) =>
  PLATFORM_RELAYS.length > 0 ? PLATFORM_RELAYS : ($roomList?.urls() ?? [])

// Relays

const syncRelays = () => {
  for (const url of INDEXER_RELAYS) {
    relays.get().load(url)
  }

  const unsubscribePage = page.subscribe($page => {
    if ($page.params.relay) {
      const url = decodeRelay($page.params.relay)

      relays.get().load(url)
      hasBlossomSupport(url)
    }
  })

  const unsubscribeSpaceUrls = userRoomList.subscribe($roomList => {
    for (const url of $roomList?.urls() ?? []) {
      relays.get().load(url)
    }
  })

  const unsubscribeSearchRelayUrls = userSearchRelayList.subscribe($searchRelayList => {
    for (const url of $searchRelayList?.urls() ?? []) {
      relays.get().load(url)
    }
  })

  return () => {
    unsubscribePage()
    unsubscribeSpaceUrls()
    unsubscribeSearchRelayUrls()
  }
}

// User data

const syncUserSpaceMembership = (url: string) => {
  const $pubkey = app.get().user?.pubkey
  const controller = new AbortController()

  if ($pubkey) {
    pullAndListen({
      url,
      signal: controller.signal,
      filters: [
        {kinds: [RELAY_ADD_MEMBER], "#p": [$pubkey], limit: 1},
        {kinds: [RELAY_REMOVE_MEMBER], "#p": [$pubkey], limit: 1},
        {kinds: [ROOM_CREATE_PERMISSION], "#p": [$pubkey], limit: 1},
        {kinds: [ROOM_ADD_MEMBER, ROOM_REMOVE_MEMBER], "#p": [$pubkey]},
      ],
    })
  }

  return () => controller.abort()
}

const syncUserData = () => {
  const unsubscribersByUrl = new Map<string, Unsubscriber>()
  const $pubkey = app.get().user?.pubkey

  const syncRoomList = ($roomList: Maybe<RoomListReader>) => {
    if ($roomList) {
      const urls = new Set(getSpaceUrls($roomList))

      for (const url of urls) {
        if (!unsubscribersByUrl.has(url)) {
          unsubscribersByUrl.set(url, syncUserSpaceMembership(url))
        }
      }

      for (const [url, unsubscribe] of unsubscribersByUrl.entries()) {
        if (!urls.has(url)) {
          unsubscribersByUrl.delete(url)
          unsubscribe()
        }
      }
    }
  }

  const syncUserLists = () => {
    if ($pubkey) {
      blossomServerLists.get().load($pubkey)
      blockedRelayLists.get().load($pubkey)
      followLists.get().load($pubkey)
      roomLists.get().load($pubkey)
      muteLists.get().load($pubkey)
      profiles.get().load($pubkey)
      searchRelayLists.get().load($pubkey)
      app.get().use(Settings).load($pubkey)
    }
  }

  const syncFollowNetwork = async ($followList: Maybe<FollowListReader>) => {
    const authors = $followList?.pubkeys() ?? []

    if (authors.length > 0) {
      const scenario = await router.get().resolve(authors.map(author => outbox(author)))

      network.get().loadLenient({
        filters: [{kinds: [FOLLOWS, MUTES], authors}],
        relays: scenario.limit(8).getUrls(),
      })
    }
  }

  if ($pubkey) {
    relayLists.get().load($pubkey)
  }

  const unsubscribeRoomList = userRoomList.subscribe(syncRoomList)
  const unsubscribeRelayList = userRelayList.subscribe(syncUserLists)
  const unsubscribeFollowList = userFollowList.subscribe(syncFollowNetwork)

  return () => {
    unsubscribersByUrl.forEach(call)
    unsubscribeRoomList()
    unsubscribeRelayList()
    unsubscribeFollowList()
  }
}

// Spaces

const syncSpaceActivity = (url: string) => {
  const controller = new AbortController()
  const {signal} = controller
  const asked = new Set<string>()

  network.get().request({
    relays: [url],
    signal,
    filters: [
      {kinds: [MESSAGE], limit: 1},
      {kinds: CONTENT_KINDS, since: ago(WEEK)},
      makeCommentFilter(CONTENT_KINDS, {since: ago(WEEK)}),
      {kinds: [DELETE, REPORT, POLL_RESPONSE], since: ago(WEEK)},
    ],
  })

  pullAndListen({url, signal, filters: [{kinds: [ROOM_META, ROOM_DELETE, RELAY_MEMBERS]}]})

  const unsubscribeRooms = throttled(300, rooms.get().forUrl(url).$).subscribe($rooms => {
    const hs = $rooms.map(room => room.h).filter(h => !asked.has(h))

    if (hs.length > 0) {
      for (const h of hs) {
        asked.add(h)
      }

      network.get().request({
        relays: [url],
        signal,
        autoClose: true,
        filters: hs.map(h => ({kinds: [MESSAGE], "#h": [h], limit: 1})),
      })
    }
  })

  return () => {
    unsubscribeRooms()
    controller.abort()
  }
}

const syncSpaceDetail = (url: string) => {
  const controller = new AbortController()

  pullAndListen({
    url,
    signal: controller.signal,
    filters: [
      {kinds: [RELAY_ROLE]},
      {kinds: [APP_DATA], "#d": [FEATURED_CONTENT_D]},
      {kinds: [ROOM_ADMINS, ROOM_MEMBERS, LIVEKIT_PARTICIPANTS, PINBOARD, ROOM_PINS]},
      {kinds: [ROOM_JOIN, ROOM_LEAVE], since: ago(MONTH)},
    ],
  })

  // Which sections a space offers is a question about its whole history, and one event per kind answers it.
  network.get().loadLenient({
    relays: [url],
    signal: controller.signal,
    filters: CONTENT_KINDS.map(kind => ({kinds: [kind], limit: 1})),
  })

  return () => controller.abort()
}

const syncSpaces = () => {
  const unsubscribersByUrl = new Map<string, Unsubscriber>()

  let detailUrl: Maybe<string>
  let unsubscribeDetail: Unsubscriber = noop

  const unsubscribe = merged([userRoomList, page]).subscribe(([$roomList, $page]) => {
    const urls = new Set(getSpaceUrls($roomList))
    const currentUrl = $page.params.relay ? decodeRelay($page.params.relay) : undefined

    if (currentUrl) {
      urls.add(currentUrl)
    }

    // Stop syncing removed spaces
    for (const [url, unsubscribe] of unsubscribersByUrl.entries()) {
      if (!urls.has(url)) {
        unsubscribersByUrl.delete(url)
        unsubscribe()
      }
    }

    // Start syncing for new spaces
    for (const url of urls) {
      if (!unsubscribersByUrl.has(url)) {
        unsubscribersByUrl.set(url, syncSpaceActivity(url))
      }
    }

    if (detailUrl !== currentUrl) {
      detailUrl = currentUrl
      unsubscribeDetail()
      unsubscribeDetail = currentUrl ? syncSpaceDetail(currentUrl) : noop
    }
  })

  return () => {
    for (const unsubscriber of unsubscribersByUrl.values()) {
      unsubscriber()
    }

    unsubscribeDetail()
    unsubscribe()
  }
}

// DMs

const syncDMRelay = (url: string, pubkey: string) => {
  const controller = new AbortController()

  pullAndListen({
    url,
    signal: controller.signal,
    filters: [{kinds: [WRAP], "#p": [pubkey]}],
  })

  return () => controller.abort()
}

const syncDMs = () => {
  const unsubscribersByUrl = new Map<string, Unsubscriber>()

  let currentPubkey: string | undefined
  let currentShouldUnwrap = false

  const unsubscribeAll = () => {
    for (const [url, unsubscribe] of unsubscribersByUrl.entries()) {
      unsubscribersByUrl.delete(url)
      unsubscribe()
    }
  }

  const subscribeAll = (pubkey: string, urls: string[]) => {
    // Start syncing newly added relays
    for (const url of urls) {
      if (!unsubscribersByUrl.has(url)) {
        unsubscribersByUrl.set(url, syncDMRelay(url, pubkey))
      }
    }

    // Stop syncing removed spaces
    for (const [url, unsubscribe] of unsubscribersByUrl.entries()) {
      if (!urls.includes(url)) {
        unsubscribersByUrl.delete(url)
        unsubscribe()
      }
    }
  }

  const syncPubkey = async ($pubkey: Maybe<string>, $shouldUnwrap: boolean) => {
    if ($pubkey !== currentPubkey) {
      unsubscribeAll()
    }

    currentPubkey = $pubkey
    currentShouldUnwrap = $shouldUnwrap

    if ($pubkey && $shouldUnwrap) {
      await relayLists.get().load($pubkey).catch(noop)
      await messagingRelayLists.get().load($pubkey).catch(noop)

      if (currentPubkey === $pubkey && currentShouldUnwrap === $shouldUnwrap) {
        subscribeAll($pubkey, messagingRelayLists.get().urls($pubkey).get())
      }
    }
  }

  const syncList = () => {
    const $pubkey = app.get().user?.pubkey

    if ($pubkey && shouldUnwrap.get()) {
      subscribeAll($pubkey, messagingRelayLists.get().urls($pubkey).get())
    }
  }

  const unsubscribeUser = merged([app, shouldUnwrap]).subscribe(([$app, $shouldUnwrap]) => {
    syncPubkey($app.user?.pubkey, $shouldUnwrap)
  })

  const unsubscribeList = userMessagingRelayList.subscribe(syncList)

  return () => {
    unsubscribeAll()
    unsubscribeUser()
    unsubscribeList()
  }
}

// Merge all synchronization functions

let unsubscribe: Unsubscriber | undefined

export const syncApplicationData = () => {
  unsubscribe?.()

  const unsubscribers = [syncRelays(), syncUserData(), syncSpaces(), syncDMs()]

  unsubscribe = () => unsubscribers.forEach(call)

  return () => {
    unsubscribe?.()
    unsubscribe = undefined
  }
}
