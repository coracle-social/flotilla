import {page} from "$app/stores"
import type {Unsubscriber} from "svelte/store"
import {derived, get} from "svelte/store"
import {last, call, assoc, chunk, sleep, identity, WEEK, ago} from "@welshman/lib"
import {
  getListTags,
  getRelayTagValues,
  WRAP,
  ROOM_META,
  ROOM_DELETE,
  ROOM_ADMINS,
  ROOM_MEMBERS,
  ROOM_ADD_MEMBER,
  ROOM_REMOVE_MEMBER,
  ROOM_CREATE_PERMISSION,
  RELAY_MEMBERS,
  RELAY_ADD_MEMBER,
  RELAY_REMOVE_MEMBER,
  isSignedEvent,
  unionFilters,
} from "@welshman/util"
import type {Filter} from "@welshman/util"
import {request, requestOne, Difference, DifferenceEvent} from "@welshman/net"
import {
  pubkey,
  loadRelay,
  userFollowList,
  userRelayList,
  userMessagingRelayList,
  loadRelayList,
  loadMessagingRelayList,
  loadBlossomServerList,
  loadBlockedRelayList,
  loadFollowList,
  loadMuteList,
  loadProfile,
  repository,
  shouldUnwrap,
  hasNegentropy,
} from "@welshman/app"
import {
  REACTION_KINDS,
  MESSAGE_KINDS,
  CONTENT_KINDS,
  INDEXER_RELAYS,
  loadSettings,
  loadGroupList,
  userSpaceUrls,
  userGroupList,
  bootstrapPubkeys,
  decodeRelay,
  getSpaceUrlsFromGroupList,
  getSpaceRoomsFromGroupList,
  makeCommentFilter,
  loadFeedsForPubkey,
} from "@app/core/state"
import {hasBlossomSupport} from "@app/core/commands"

// Utils

type SyncOpts = {
  url: string
  signal: AbortSignal
  filters: Filter[]
}

const pullOneWithFallback = async (url: string, filter: Filter, signal: AbortSignal) => {
  const cachedEvents = repository.query([filter]).filter(isSignedEvent)
  const since = last(cachedEvents.slice(10))?.created_at || 0

  const shouldFallback =
    !hasNegentropy(url) ||
    (await new Promise(resolve => {
      const diff = new Difference({relay: url, filter, events: cachedEvents, signal})

      diff.on(DifferenceEvent.Error, () => {
        resolve(true)
      })

      diff.on(DifferenceEvent.Close, () => {
        for (const ids of chunk(100, Array.from(diff.need))) {
          requestOne({relay: url, signal, autoClose: true, filters: [{ids}]})
        }

        resolve(false)
      })
    }))

  if (shouldFallback && !signal.aborted) {
    request({relays: [url], signal, autoClose: true, filters: [{...filter, since}]})
  }
}

export const pullWithFallback = async ({url, signal, filters}: SyncOpts) => {
  await loadRelay(url)

  if (signal.aborted) return

  for (const filter of filters) {
    pullOneWithFallback(url, filter, signal)
  }
}

const listen = ({url, signal, filters}: SyncOpts) => {
  const relays = [url]

  request({relays, signal, filters: unionFilters(filters.map(assoc("limit", 0)))})
}

const pullAndListen = ({url, filters, signal}: SyncOpts) => {
  pullWithFallback({url, signal, filters})
  listen({url, signal, filters})
}

// Relays

const syncRelays = () => {
  for (const url of INDEXER_RELAYS) {
    loadRelay(url)
  }

  const unsubscribePage = page.subscribe($page => {
    if ($page.params.relay) {
      const url = decodeRelay($page.params.relay)

      loadRelay(url)
      hasBlossomSupport(url)
    }
  })

  const unsubscribeSpaceUrls = userSpaceUrls.subscribe(urls => {
    for (const url of urls) {
      loadRelay(url)
    }
  })

  return () => {
    unsubscribePage()
    unsubscribeSpaceUrls()
  }
}

// User data

const syncUserSpaceMembership = (url: string) => {
  const $pubkey = pubkey.get()
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
  const $pubkey = pubkey.get()
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

  const unsubscribeGroupList = userGroupList.subscribe($userGroupList => {
    if ($userGroupList) {
      const keys = new Set<string>()

      for (const url of getSpaceUrlsFromGroupList($userGroupList)) {
        if (!unsubscribersByKey.has(url)) {
          unsubscribersByKey.set(url, syncUserSpaceMembership(url))
        }

        keys.add(url)

        for (const h of getSpaceRoomsFromGroupList(url, $userGroupList)) {
          const key = `${url}'${h}`

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
  })

  const unsubscribeRelayList = userRelayList.subscribe($userRelayList => {
    if ($userRelayList) {
      loadBlossomServerList($userRelayList.event.pubkey)
      loadBlockedRelayList($userRelayList.event.pubkey)
      loadFollowList($userRelayList.event.pubkey)
      loadGroupList($userRelayList.event.pubkey)
      loadMuteList($userRelayList.event.pubkey)
      loadProfile($userRelayList.event.pubkey)
      loadSettings($userRelayList.event.pubkey)
      loadFeedsForPubkey($userRelayList.event.pubkey)
    }
  })

  const unsubscribeFollows = userFollowList.subscribe(async $userFollowList => {
    for (const pubkeys of chunk(10, get(bootstrapPubkeys))) {
      // This isn't urgent, avoid clogging other stuff up
      await sleep(1000)

      await Promise.all(
        pubkeys.flatMap(pk => [
          loadRelayList(pk),
          loadGroupList(pk),
          loadProfile(pk),
          loadFollowList(pk),
          loadMuteList(pk),
        ]),
      )
    }
  })

  return () => {
    unsubscribersByKey.forEach(call)
    unsubscribeGroupList()
    unsubscribeRelayList()
    unsubscribeFollows()
  }
}

// Spaces

const syncSpace = (url: string, rooms: string[]) => {
  const controller = new AbortController()

  // Relay-level kinds don't need #h tags
  pullAndListen({
    url,
    signal: controller.signal,
    filters: [{kinds: [RELAY_MEMBERS, RELAY_ADD_MEMBER, RELAY_REMOVE_MEMBER]}],
  })

  // Room metadata uses #d tags, not #h, so no filtering needed
  pullAndListen({
    url,
    signal: controller.signal,
    filters: [{kinds: [ROOM_META, ROOM_ADMINS, ROOM_MEMBERS]}],
  })

  // Room-scoped kinds: add #h tags when we know which rooms the user is in.
  // This avoids sending broad filters that picky relays reject.
  const roomKinds = [ROOM_DELETE, ROOM_ADD_MEMBER, ROOM_REMOVE_MEMBER]
  const since = ago(WEEK)

  if (rooms.length > 0) {
    pullAndListen({
      url,
      signal: controller.signal,
      filters: [{kinds: roomKinds, "#h": rooms}],
    })

    pullAndListen({
      url,
      signal: controller.signal,
      filters: [
        {kinds: MESSAGE_KINDS, "#h": rooms, since},
        makeCommentFilter(CONTENT_KINDS, {"#h": rooms, since}),
      ],
    })

    listen({
      url,
      signal: controller.signal,
      filters: [{kinds: REACTION_KINDS, "#h": rooms}],
    })
  } else {
    pullAndListen({
      url,
      signal: controller.signal,
      filters: [{kinds: roomKinds}],
    })

    pullAndListen({
      url,
      signal: controller.signal,
      filters: [{kinds: MESSAGE_KINDS, since}, makeCommentFilter(CONTENT_KINDS, {since})],
    })

    listen({
      url,
      signal: controller.signal,
      filters: [{kinds: REACTION_KINDS}],
    })
  }

  return () => controller.abort()
}

const syncSpaces = () => {
  const store = derived([userGroupList, page], identity)
  const unsubscribersByUrl = new Map<string, Unsubscriber>()
  const roomsByUrl = new Map<string, string>()

  const unsubscribe = store.subscribe(([$userGroupList, $page]) => {
    const urls = new Set(getSpaceUrlsFromGroupList($userGroupList))

    if ($page.params.relay) {
      urls.add(decodeRelay($page.params.relay))
    }

    // Stop syncing removed spaces
    for (const [url, unsubscribe] of unsubscribersByUrl.entries()) {
      if (!urls.has(url)) {
        unsubscribersByUrl.delete(url)
        roomsByUrl.delete(url)
        unsubscribe()
      }
    }

    // Start or restart syncing for each space
    for (const url of urls) {
      const rooms = getSpaceRoomsFromGroupList(url, $userGroupList)
      const roomsKey = rooms.join(",")

      if (unsubscribersByUrl.has(url) && roomsByUrl.get(url) === roomsKey) continue

      // Tear down existing sync if rooms changed
      unsubscribersByUrl.get(url)?.()

      roomsByUrl.set(url, roomsKey)
      unsubscribersByUrl.set(url, syncSpace(url, rooms))
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

  // When pubkey changes, re-sync
  const unsubscribePubkey = derived([pubkey, shouldUnwrap], identity).subscribe(
    ([$pubkey, $shouldUnwrap]) => {
      if ($pubkey !== currentPubkey) {
        unsubscribeAll()
      }

      // If we have a pubkey, refresh our user's relay list then sync our subscriptions
      if ($pubkey && $shouldUnwrap) {
        loadRelayList($pubkey)
          .then(() => loadMessagingRelayList($pubkey))
          .then($l => subscribeAll($pubkey, getRelayTagValues(getListTags($l))))
      }

      currentPubkey = $pubkey
    },
  )

  // When user messaging relays change, update synchronization
  const unsubscribeList = userMessagingRelayList.subscribe($userMessagingRelayList => {
    const $pubkey = pubkey.get()
    const $shouldUnwrap = shouldUnwrap.get()

    if ($pubkey && $shouldUnwrap) {
      subscribeAll($pubkey, getRelayTagValues(getListTags($userMessagingRelayList)))
    }
  })

  return () => {
    unsubscribeAll()
    unsubscribePubkey()
    unsubscribeList()
  }
}

// Merge all synchronization functions

export const syncApplicationData = () => {
  const unsubscribers = [syncRelays(), syncUserData(), syncSpaces(), syncDMs()]

  return () => unsubscribers.forEach(call)
}
