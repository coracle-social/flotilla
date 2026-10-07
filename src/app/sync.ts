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
  unionFilters,
} from "@welshman/util"
import type {Filter} from "@welshman/util"
import type {FollowListReader} from "@welshman/domain"
import {merged, synced, throttled, withGetter} from "@welshman/store"
import {FollowLists, MessagingRelayLists, RelayLists, SearchRelayLists, Sync} from "@welshman/app"
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
  searchRelayLists,
} from "@app/core"
import {loadUserBookmarks} from "@app/bookmarks"
import {LIVEKIT_PARTICIPANTS} from "@app/call"
import {CONTENT_KINDS, REACTION_KINDS, makeCommentFilter} from "@app/content"
import {INDEXER_RELAYS} from "@app/env"
import {FEATURED_CONTENT_D} from "@app/featured"
import {getHomeNotificationRelays, homeNotificationFilters} from "@app/notifications"
import {decodeRelay, outboxUrls} from "@app/relays"
import {activeSpaceUrls, userSpaceUrls} from "@app/rooms"
import {Settings} from "@app/settings"
import {kv} from "@app/storage"
import {hasBlossomSupport} from "@app/uploads"

// Unwrapping is unconditional, so this is what keeps a signer from decrypting the whole DM history.
export const shouldUnwrap = withGetter(
  synced({
    key: "shouldUnwrap",
    storage: kv,
    defaultValue: false,
  }),
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

// Runs one sync per key, starting it when the key appears and stopping it when the key goes away.
const makeKeyedSyncs = (start: (key: string) => Unsubscriber) => {
  const stopsByKey = new Map<string, Unsubscriber>()

  const reconcile = (keys: Iterable<string>) => {
    const keep = new Set(keys)

    for (const [key, stop] of stopsByKey) {
      if (!keep.has(key)) {
        stopsByKey.delete(key)
        stop()
      }
    }

    for (const key of keep) {
      if (!stopsByKey.has(key)) {
        stopsByKey.set(key, start(key))
      }
    }
  }

  const stop = () => reconcile([])

  return {reconcile, stop}
}

const userRelayList = deriveUserItem(RelayLists)

const userFollowList = deriveUserItem(FollowLists)

const userMessagingRelayList = deriveUserItem(MessagingRelayLists)

const userSearchRelayList = deriveUserItem(SearchRelayLists)

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

  const unsubscribeSpaceUrls = userSpaceUrls.subscribe($userSpaceUrls => {
    for (const url of $userSpaceUrls) {
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
  const $pubkey = app.get().user?.pubkey
  const membershipSyncs = makeKeyedSyncs(syncUserSpaceMembership)

  const syncUserLists = () => {
    if ($pubkey) {
      blossomServerLists.get().load($pubkey)
      blockedRelayLists.get().load($pubkey)
      followLists.get().load($pubkey)
      roomLists.get().load($pubkey)
      muteLists.get().load($pubkey)
      profiles.get().load($pubkey)
      searchRelayLists.get().load($pubkey)
      loadUserBookmarks($pubkey)
      app.get().use(Settings).load($pubkey)
    }
  }

  const syncFollowNetwork = async ($followList: Maybe<FollowListReader>) => {
    const authors = $followList?.pubkeys() ?? []

    if (authors.length > 0) {
      network.get().loadLenient({
        filters: [{kinds: [FOLLOWS, MUTES], authors}],
        relays: await outboxUrls(authors, 8),
      })
    }
  }

  if ($pubkey) {
    relayLists.get().load($pubkey)
  }

  const unsubscribeSpaceMembership = activeSpaceUrls.subscribe(membershipSyncs.reconcile)
  const unsubscribeRelayList = userRelayList.subscribe(syncUserLists)
  const unsubscribeFollowList = userFollowList.subscribe(syncFollowNetwork)

  return () => {
    membershipSyncs.stop()
    unsubscribeSpaceMembership()
    unsubscribeRelayList()
    unsubscribeFollowList()
  }
}

// Home notifications

// The home badge reads the repository, so these have to arrive whether or not home is open.
const syncHomeNotificationRelay = (url: string, pubkey: string) => {
  const controller = new AbortController()
  const filters = homeNotificationFilters(pubkey)

  network.get().loadLenient({
    relays: [url],
    signal: controller.signal,
    filters: filters.map(filter => ({...filter, limit: 100})),
  })

  network.get().request({
    relays: [url],
    signal: controller.signal,
    filters: unionFilters(filters.map(assoc("limit", 0))),
  })

  return () => controller.abort()
}

const syncHomeNotifications = () => {
  const $pubkey = app.get().user?.pubkey

  if ($pubkey) {
    const relaySyncs = makeKeyedSyncs(url => syncHomeNotificationRelay(url, $pubkey))

    let stopped = false

    const reconcile = async () => {
      const urls = await getHomeNotificationRelays()

      if (!stopped) {
        relaySyncs.reconcile(urls)
      }
    }

    const unsubscribeRelayList = userRelayList.subscribe(reconcile)

    return () => {
      stopped = true
      relaySyncs.stop()
      unsubscribeRelayList()
    }
  }

  return noop
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
      {kinds: REACTION_KINDS, since: ago(WEEK)},
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
  const activitySyncs = makeKeyedSyncs(syncSpaceActivity)

  let detailUrl: Maybe<string>
  let unsubscribeDetail: Unsubscriber = noop

  const unsubscribe = merged([activeSpaceUrls, page]).subscribe(([$activeSpaceUrls, $page]) => {
    const currentUrl = $page.params.relay ? decodeRelay($page.params.relay) : undefined

    activitySyncs.reconcile(currentUrl ? [...$activeSpaceUrls, currentUrl] : $activeSpaceUrls)

    if (detailUrl !== currentUrl) {
      detailUrl = currentUrl
      unsubscribeDetail()
      unsubscribeDetail = currentUrl ? syncSpaceDetail(currentUrl) : noop
    }
  })

  return () => {
    activitySyncs.stop()
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
  const $pubkey = app.get().user?.pubkey

  if ($pubkey) {
    const relaySyncs = makeKeyedSyncs(url => syncDMRelay(url, $pubkey))

    const syncList = () => {
      if (shouldUnwrap.get()) {
        relaySyncs.reconcile(messagingRelayLists.get().urls($pubkey).get())
      }
    }

    const loadList = async ($shouldUnwrap: boolean) => {
      if ($shouldUnwrap) {
        await relayLists.get().load($pubkey).catch(noop)
        await messagingRelayLists.get().load($pubkey).catch(noop)

        syncList()
      }
    }

    const unsubscribeUnwrap = shouldUnwrap.subscribe(loadList)
    const unsubscribeList = userMessagingRelayList.subscribe(syncList)

    return () => {
      relaySyncs.stop()
      unsubscribeUnwrap()
      unsubscribeList()
    }
  }

  return noop
}

// Merge all synchronization functions

let unsubscribe: Unsubscriber | undefined

export const syncApplicationData = () => {
  unsubscribe?.()

  const unsubscribers = [
    syncRelays(),
    syncUserData(),
    syncHomeNotifications(),
    syncSpaces(),
    syncDMs(),
  ]

  unsubscribe = () => unsubscribers.forEach(call)

  return () => {
    unsubscribe?.()
    unsubscribe = undefined
  }
}
