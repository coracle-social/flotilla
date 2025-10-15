import {page} from "$app/stores"
import type {Unsubscriber} from "svelte/store"
import {derived, get} from "svelte/store"
import {
  partition,
  call,
  sortBy,
  assoc,
  chunk,
  sleep,
  now,
  identity,
  WEEK,
  MONTH,
  ago,
} from "@welshman/lib"
import {
  getListTags,
  getRelayTagValues,
  WRAP,
  ROOM_META,
  ROOM_ADD_MEMBER,
  ROOM_REMOVE_MEMBER,
  isSignedEvent,
} from "@welshman/util"
import type {Filter, TrustedEvent} from "@welshman/util"
import {request, load, pull} from "@welshman/net"
import {
  pubkey,
  loadRelay,
  userFollows,
  userRelaySelections,
  userInboxRelaySelections,
  loadRelaySelections,
  loadInboxRelaySelections,
  loadBlossomServers,
  loadFollows,
  loadMutes,
  loadProfile,
  repository,
  shouldUnwrap,
  hasNegentropy,
} from "@welshman/app"
import {
  MESSAGE_FILTER,
  COMMENT_FILTER,
  MEMBERSHIP_FILTER,
  INDEXER_RELAYS,
  REACTION_KINDS,
  loadSettings,
  loadGroupSelections,
  userSpaceUrls,
  bootstrapPubkeys,
  decodeRelay,
  getUrlsForEvent,
} from "@app/core/state"
import {loadAlerts, loadAlertStatuses} from "@app/core/requests"
import {hasBlossomSupport} from "@app/core/commands"

// Utils

type PullOpts = {
  relays: string[]
  filters: Filter[]
  signal: AbortSignal
}

const pullConservatively = ({relays, filters, signal}: PullOpts) => {
  const $getUrlsForEvent = get(getUrlsForEvent)
  const [smart, dumb] = partition(hasNegentropy, relays)
  const events = repository.query(filters, {shouldSort: false}).filter(isSignedEvent)
  const promises: Promise<TrustedEvent[]>[] = [pull({relays: smart, filters, signal, events})]

  // Since pulling from relays without negentropy is expensive, limit how many
  // duplicates we repeatedly download
  for (const url of dumb) {
    const urlEvents = events.filter(e => $getUrlsForEvent(e.id).includes(url))

    if (urlEvents.length >= 100) {
      filters = filters.map(assoc("since", sortBy(e => -e.created_at, urlEvents)[10]!.created_at))
    }

    promises.push(load({relays: [url], filters, signal}))
  }

  return Promise.all(promises)
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

const syncUserData = () => {
  const unsubscribePubkey = pubkey.subscribe($pubkey => {
    if ($pubkey) {
      loadRelaySelections($pubkey)
    }
  })

  const unsubscribeSelections = userRelaySelections.subscribe($l => {
    const $pubkey = pubkey.get()

    if ($pubkey) {
      loadAlerts($pubkey)
      loadAlertStatuses($pubkey)
      loadBlossomServers($pubkey)
      loadFollows($pubkey)
      loadGroupSelections($pubkey)
      loadMutes($pubkey)
      loadProfile($pubkey)
      loadSettings($pubkey)
    }
  })

  const unsubscribeFollows = userFollows.subscribe(async $l => {
    for (const pubkeys of chunk(10, get(bootstrapPubkeys))) {
      // This isn't urgent, avoid clogging other stuff up
      await sleep(1000)

      for (const pk of pubkeys) {
        loadRelaySelections(pk).then(() => {
          loadGroupSelections(pk)
          loadProfile(pk)
          loadFollows(pk)
          loadMutes(pk)
        })
      }
    }
  })

  return () => {
    unsubscribePubkey()
    unsubscribeSelections()
    unsubscribeFollows()
  }
}

// Memberships

const syncMembership = (url: string) => {
  const controller = new AbortController()

  // Load group metadata
  pullConservatively({
    relays: [url],
    signal: controller.signal,
    filters: [{kinds: [ROOM_META]}],
  })

  // Load historical data from up to a month ago for quick page loading
  pullConservatively({
    relays: [url],
    signal: controller.signal,
    filters: [MESSAGE_FILTER, COMMENT_FILTER, MEMBERSHIP_FILTER].map(assoc("since", ago(MONTH))),
  })

  // Listen for new events
  request({
    relays: [url],
    signal: controller.signal,
    filters: [MESSAGE_FILTER, COMMENT_FILTER, MEMBERSHIP_FILTER].map(assoc("since", now())),
  })

  return () => controller.abort()
}

const syncMemberships = () => {
  const unsubscribersByUrl = new Map<string, Unsubscriber>()

  const unsubscribeSpaceUrls = userSpaceUrls.subscribe(urls => {
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
        unsubscribersByUrl.set(url, syncMembership(url))
      }
    }
  })

  return () => {
    Array.from(unsubscribersByUrl.values()).forEach(call)
    unsubscribeSpaceUrls()
  }
}

// Sync extra stuff for the current space

const syncSpace = (url: string) => {
  const $pubkey = pubkey.get()
  const controller = new AbortController()

  // Load all membership changes for the current user
  if ($pubkey) {
    pullConservatively({
      relays: [url],
      signal: controller.signal,
      filters: [
        {
          kinds: [ROOM_ADD_MEMBER, ROOM_REMOVE_MEMBER],
          "#p": [$pubkey],
        },
      ],
    })
  }

  // Listen actively for all current membership changes, reports, reactions, zaps, etc
  request({
    relays: [url],
    signal: controller.signal,
    filters: [
      {
        kinds: [ROOM_ADD_MEMBER, ROOM_REMOVE_MEMBER, ...REACTION_KINDS],
        since: now(),
      },
    ],
  })

  return () => controller.abort()
}

const syncCurrentSpace = () => {
  const unsubscribersByUrl = new Map<string, Unsubscriber>()

  // Sync the space the user is currently visiting
  const unsubscribePage = page.subscribe($page => {
    if ($page.params.relay) {
      const url = decodeRelay($page.params.relay)

      if (!unsubscribersByUrl.has(url)) {
        unsubscribersByUrl.set(url, syncSpace(url))
      }

      for (const [oldUrl, unsubscribe] of unsubscribersByUrl.entries()) {
        if (url !== oldUrl) {
          unsubscribersByUrl.delete(oldUrl)
          unsubscribe()
        }
      }
    } else {
      Array.from(unsubscribersByUrl.values()).forEach(call)
    }
  })

  return () => {
    Array.from(unsubscribersByUrl.values()).forEach(call)
    unsubscribePage()
  }
}

// DMs

const syncDMRelay = (url: string, pubkey: string) => {
  const controller = new AbortController()

  // Load historical data
  pullConservatively({
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

      // If we have a pubkey, refresh our user's relay selections then sync our subscriptions
      if ($pubkey && $shouldUnwrap) {
        loadRelaySelections($pubkey)
          .then(() => loadInboxRelaySelections($pubkey))
          .then($l => subscribeAll($pubkey, getRelayTagValues(getListTags($l))))
      }

      currentPubkey = $pubkey
    },
  )

  // When user inbox relays change, update synchronization
  const unsubscribeSelections = userInboxRelaySelections.subscribe($userInboxRelaySelections => {
    const $pubkey = pubkey.get()
    const $shouldUnwrap = shouldUnwrap.get()

    if ($pubkey && $shouldUnwrap) {
      subscribeAll($pubkey, getRelayTagValues(getListTags($userInboxRelaySelections)))
    }
  })

  return () => {
    unsubscribeAll()
    unsubscribePubkey()
    unsubscribeSelections()
  }
}

// Merge all synchronization functions

export const syncApplicationData = () => {
  const unsubscribers = [
    syncRelays(),
    syncUserData(),
    syncMemberships(),
    syncCurrentSpace(),
    syncDMs(),
  ]

  return () => unsubscribers.forEach(call)
}
