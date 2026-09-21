import {page} from "$app/stores"
import type {Unsubscriber} from "svelte/store"
import {ago, assoc, call, noop, MONTH, WEEK} from "@welshman/lib"
import type {Maybe} from "@welshman/lib"
import {
  APP_DATA,
  FOLLOWS,
  MESSAGE,
  MUTES,
  PIN,
  PINBOARD,
  POLL_RESPONSE,
  RELAY_ADD_MEMBER,
  RELAY_MEMBERS,
  RELAY_REMOVE_MEMBER,
  RELAY_ROLE,
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
import {merged, synced, withGetter} from "@welshman/store"
import {
  FollowLists,
  MessagingRelayLists,
  RelayLists,
  RoomLists,
  Sync,
  makeRoomKey,
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
  router,
} from "@app/core"
import {LIVEKIT_PARTICIPANTS} from "@app/call"
import {REACTION_KINDS, CONTENT_KINDS, makeCommentFilter} from "@app/content"
import {INDEXER_RELAYS, PLATFORM_RELAYS} from "@app/env"
import {FEATURED_CONTENT_D} from "@app/featured"
import {decodeRelay} from "@app/relays"
import {Settings} from "@app/settings"
import {kv} from "@app/storage"
import {hasBlossomSupport} from "@app/uploads"

// Whether to sync gift wraps. Unwrapping itself is unconditional, so this is the only
// thing keeping a signer from being asked to decrypt the user's entire DM history.
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

  return () => {
    unsubscribePage()
    unsubscribeSpaceUrls()
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
      ],
    })
  }

  return () => controller.abort()
}

const syncUserRoomMembership = (url: string, h: string) => {
  const $pubkey = app.get().user?.pubkey
  const controller = new AbortController()

  if ($pubkey) {
    pullAndListen({
      url,
      signal: controller.signal,
      filters: [
        {kinds: [ROOM_ADD_MEMBER], "#p": [$pubkey], "#h": [h], limit: 1},
        {kinds: [ROOM_REMOVE_MEMBER], "#p": [$pubkey], "#h": [h], limit: 1},
      ],
    })
  }

  return () => controller.abort()
}

const syncUserData = () => {
  const unsubscribersByKey = new Map<string, Unsubscriber>()
  const $pubkey = app.get().user?.pubkey

  const syncRoomList = ($roomList: Maybe<RoomListReader>) => {
    if ($roomList) {
      const keys = new Set<string>()

      for (const url of getSpaceUrls($roomList)) {
        if (!unsubscribersByKey.has(url)) {
          unsubscribersByKey.set(url, syncUserSpaceMembership(url))
        }

        keys.add(url)

        for (const h of $roomList.roomsForUrl(url)) {
          const key = makeRoomKey(url, h)

          if (!unsubscribersByKey.has(key)) {
            unsubscribersByKey.set(key, syncUserRoomMembership(url, h))
          }

          keys.add(key)
        }
      }

      for (const [key, unsubscribe] of unsubscribersByKey.entries()) {
        if (!keys.has(key)) {
          unsubscribersByKey.delete(key)
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
      app.get().use(Settings).load($pubkey)
    }
  }

  const syncFollowNetwork = async ($followList: Maybe<FollowListReader>) => {
    const authors = $followList?.pubkeys() ?? []

    if (authors.length > 0) {
      const scenario = await router.get().resolve(authors.map(author => outbox(author)))

      network.get().load({
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
    unsubscribersByKey.forEach(call)
    unsubscribeRoomList()
    unsubscribeRelayList()
    unsubscribeFollowList()
  }
}

// Spaces

const syncSpace = (url: string) => {
  const controller = new AbortController()

  // Low cardinality we want everything for
  pullAndListen({
    url,
    signal: controller.signal,
    filters: [
      {kinds: [RELAY_MEMBERS, RELAY_ROLE]},
      {kinds: [APP_DATA], "#d": [FEATURED_CONTENT_D]},
    ],
  })

  // Higher cardinality stuff we want as much as we can get
  pullAndListen({
    url,
    signal: controller.signal,
    filters: [
      {
        kinds: [
          ROOM_META,
          ROOM_ADMINS,
          ROOM_MEMBERS,
          ROOM_DELETE,
          LIVEKIT_PARTICIPANTS,
          PINBOARD,
          ROOM_PINS,
        ],
      },
    ],
  })

  // Recent stuff, best effort
  pullAndListen({
    url,
    signal: controller.signal,
    filters: [
      {kinds: [...CONTENT_KINDS, MESSAGE, PIN, ROOM_JOIN, ROOM_LEAVE], since: ago(MONTH)},
      {kinds: [...REACTION_KINDS, POLL_RESPONSE], since: ago(WEEK)},
      makeCommentFilter(CONTENT_KINDS, {since: ago(WEEK)}),
    ],
  })

  // Which sections a space offers is a question about its whole history rather than about the
  // recent window above — a space whose newest poll is a year old still has polls. One event
  // per kind answers it.
  network.get().load({
    relays: [url],
    signal: controller.signal,
    filters: CONTENT_KINDS.map(kind => ({kinds: [kind], limit: 1})),
  })

  return () => controller.abort()
}

const syncSpaces = () => {
  const unsubscribersByUrl = new Map<string, Unsubscriber>()

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
        unsubscribersByUrl.set(url, syncSpace(url))
      }
    }
  })

  return () => {
    for (const unsubscriber of unsubscribersByUrl.values()) {
      unsubscriber()
    }

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
