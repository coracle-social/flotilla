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
import {request, pull} from "@welshman/net"
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

export const pullWithFallback = ({url, signal, filters}: SyncOpts) => {
  const relays = [url]
  const events = repository.query(filters).filter(isSignedEvent)

  if (hasNegentropy(url)) {
    pull({relays, signal, events, filters})
  } else {
    request({
      relays,
      signal,
      autoClose: true,
      filters: filters.map(assoc("since", last(events.slice(10))?.created_at || 0)),
    })
  }
}

const listen = ({url, signal, filters}: SyncOpts) => {
  const relays = [url]

  request({relays, signal, filters: unionFilters(filters).map(assoc("limit", 0))})
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

const syncSpace = (url: string) => {
  const controller = new AbortController()

  // These are separated so that old versions of relay29 don't barf

  pullAndListen({
    url,
    signal: controller.signal,
    filters: [{kinds: [RELAY_MEMBERS, RELAY_ADD_MEMBER, RELAY_REMOVE_MEMBER]}],
  })

  pullAndListen({
    url,
    signal: controller.signal,
    filters: [{kinds: [ROOM_META, ROOM_ADMINS, ROOM_MEMBERS]}],
  })

  pullAndListen({
    url,
    signal: controller.signal,
    filters: [{kinds: [ROOM_DELETE, ROOM_ADD_MEMBER, ROOM_REMOVE_MEMBER]}],
  })

  const since = ago(WEEK)

  pullAndListen({
    url,
    signal: controller.signal,
    filters: [{kinds: MESSAGE_KINDS, since}, makeCommentFilter(CONTENT_KINDS, {since})],
  })

  listen({
    url,
    signal: controller.signal,
    filters: [{kinds: REACTION_KINDS, limit: 0}],
  })

  return () => controller.abort()
}

const syncSpaces = () => {
  const store = derived([userSpaceUrls, page], identity)
  const unsubscribersByUrl = new Map<string, Unsubscriber>()
  const unsubscribe = store.subscribe(([$userSpaceUrls, $page]) => {
    const urls = Array.from($userSpaceUrls)

    if ($page.params.relay) {
      urls.push(decodeRelay($page.params.relay))
    }

    // stop syncing removed spaces
    for (const [url, unsubscribe] of unsubscribersByUrl.entries()) {
      if (!urls.includes(url)) {
        unsubscribersByUrl.delete(url)
        unsubscribe()
      }
    }

    // Start syncing newly added spaces
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
