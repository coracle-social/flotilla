import {page} from "$app/stores"
import type {Unsubscriber} from "svelte/store"
import {derived, get} from "svelte/store"
import {partition, call, sortBy, assoc, chunk, sleep, identity, WEEK, ago} from "@welshman/lib"
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
import type {Filter, TrustedEvent} from "@welshman/util"
import {request, load, pull} from "@welshman/net"
import {
  pubkey,
  loadRelay,
  userFollowList,
  userRelayList,
  userMessagingRelayList,
  loadRelayList,
  loadMessagingRelayList,
  loadBlossomServerList,
  loadFollowList,
  loadMuteList,
  loadProfile,
  tracker,
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
} from "@app/core/state"
import {loadAlerts, loadAlertStatuses} from "@app/core/requests"
import {hasBlossomSupport} from "@app/core/commands"

// Utils

type PullOpts = {
  relays: string[]
  filters: Filter[]
  signal: AbortSignal
}

const pullWithFallback = ({relays, filters, signal}: PullOpts) => {
  const [smart, dumb] = partition(hasNegentropy, relays)
  const events = repository.query(filters, {shouldSort: false}).filter(isSignedEvent)
  const promises: Promise<TrustedEvent[]>[] = [pull({relays: smart, filters, signal, events})]

  // Since pulling from relays without negentropy is expensive, limit how many
  // duplicates we repeatedly download
  for (const url of dumb) {
    const urlEvents = events.filter(e => tracker.getRelays(e.id).has(url))

    if (urlEvents.length >= 100) {
      filters = filters.map(assoc("since", sortBy(e => -e.created_at, urlEvents)[10]!.created_at))
    }

    promises.push(load({relays: [url], filters, signal}))
  }

  return Promise.all(promises)
}

const pullAndListen = ({relays, filters, signal}: PullOpts) => {
  pullWithFallback({
    relays,
    signal,
    filters: filters.map(f => ({limit: 100, ...f})),
  })

  request({
    relays,
    signal,
    filters: unionFilters(filters).map(assoc("limit", 0)),
  })
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
      relays: [url],
      signal: controller.signal,
      filters: [
        {
          kinds: [RELAY_ADD_MEMBER, RELAY_REMOVE_MEMBER, ROOM_CREATE_PERMISSION],
          "#p": [$pubkey],
        },
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
      relays: [url],
      signal: controller.signal,
      filters: [
        {
          kinds: [ROOM_ADD_MEMBER, ROOM_REMOVE_MEMBER],
          "#p": [$pubkey],
          "#h": [h],
        },
      ],
    })
  }

  return () => controller.abort()
}

const syncUserData = () => {
  const unsubscribersByKey = new Map<string, Unsubscriber>()

  const unsubscribeGroupList = userGroupList.subscribe($l => {
    const $pubkey = pubkey.get()

    if ($pubkey) {
      const keys = new Set<string>()

      for (const url of getSpaceUrlsFromGroupList($l)) {
        if (!unsubscribersByKey.has(url)) {
          unsubscribersByKey.set(url, syncUserSpaceMembership(url))
        }

        keys.add(url)

        for (const h of getSpaceRoomsFromGroupList(url, $l)) {
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

  const unsubscribeList = userRelayList.subscribe($l => {
    const $pubkey = pubkey.get()

    if ($pubkey) {
      loadAlerts($pubkey)
      loadAlertStatuses($pubkey)
      loadBlossomServerList($pubkey)
      loadFollowList($pubkey)
      loadGroupList($pubkey)
      loadMuteList($pubkey)
      loadProfile($pubkey)
      loadSettings($pubkey)
    }
  })

  const unsubscribeFollows = userFollowList.subscribe(async $l => {
    for (const pubkeys of chunk(10, get(bootstrapPubkeys))) {
      // This isn't urgent, avoid clogging other stuff up
      await sleep(1000)

      await Promise.all(
        pubkeys.map(async pk => {
          await loadRelayList(pk)
          await loadGroupList(pk)
          await loadProfile(pk)
          await loadFollowList(pk)
          await loadMuteList(pk)
        }),
      )
    }
  })

  const unsubscribePubkey = pubkey.subscribe($pubkey => {
    if ($pubkey) {
      loadRelayList($pubkey)
    }
  })

  return () => {
    unsubscribersByKey.forEach(call)
    unsubscribeGroupList()
    unsubscribeList()
    unsubscribeFollows()
    unsubscribePubkey()
  }
}

// Spaces

const syncSpace = (url: string) => {
  const controller = new AbortController()

  pullAndListen({
    relays: [url],
    signal: controller.signal,
    filters: [
      {kinds: [RELAY_MEMBERS]},
      {kinds: [ROOM_META, ROOM_DELETE]},
      {kinds: [ROOM_ADMINS, ROOM_MEMBERS]},
      {kinds: [ROOM_ADD_MEMBER, ROOM_REMOVE_MEMBER]},
      {kinds: [RELAY_ADD_MEMBER, RELAY_REMOVE_MEMBER]},
      ...MESSAGE_KINDS.map(kind => ({kinds: [kind]})),
      makeCommentFilter(CONTENT_KINDS),
      {kinds: REACTION_KINDS, limit: 0},
    ],
  })

  return () => controller.abort()
}

const syncSpaces = () => {
  const membershipUnsubscribersByUrl = new Map<string, Unsubscriber>()

  const unsubscribeSpaceUrls = userSpaceUrls.subscribe(urls => {
    // stop syncing removed spaces
    for (const [url, unsubscribe] of membershipUnsubscribersByUrl.entries()) {
      if (!urls.includes(url)) {
        membershipUnsubscribersByUrl.delete(url)
        unsubscribe()
      }
    }

    // Start syncing newly added spaces
    for (const url of urls) {
      if (!membershipUnsubscribersByUrl.has(url)) {
        membershipUnsubscribersByUrl.set(url, syncSpace(url))
      }
    }
  })

  const pageUnsubscribersByUrl = new Map<string, Unsubscriber>()

  // Sync the space the user is currently visiting
  const unsubscribePage = page.subscribe($page => {
    if ($page.params.relay) {
      const url = decodeRelay($page.params.relay)

      // Don't subscribe twice if the user is a member
      if (!pageUnsubscribersByUrl.has(url) && !get(userSpaceUrls).includes(url)) {
        pageUnsubscribersByUrl.set(url, syncSpace(url))
      }

      // Clean up old subscriptions
      for (const [oldUrl, unsubscribe] of pageUnsubscribersByUrl.entries()) {
        if (url !== oldUrl) {
          pageUnsubscribersByUrl.delete(oldUrl)
          unsubscribe()
        }
      }
    } else {
      Array.from(pageUnsubscribersByUrl.values()).forEach(call)
    }
  })

  return () => {
    Array.from(membershipUnsubscribersByUrl.values()).forEach(call)
    Array.from(pageUnsubscribersByUrl.values()).forEach(call)
    unsubscribeSpaceUrls()
    unsubscribePage()
  }
}

// DMs

const syncDMRelay = (url: string, pubkey: string) => {
  const controller = new AbortController()

  // Load historical data
  pullWithFallback({
    relays: [url],
    signal: controller.signal,
    filters: [{kinds: [WRAP], "#p": [pubkey], until: ago(WEEK, 2)}],
  })

  // Load new events
  request({
    relays: [url],
    signal: controller.signal,
    filters: [{kinds: [WRAP], "#p": [pubkey], since: ago(WEEK, 2)}],
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
