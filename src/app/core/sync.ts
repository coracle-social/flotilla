import {page} from "$app/stores"
import type {Unsubscriber} from "svelte/store"
import {derived, get} from "svelte/store"
import {call, chunk, sleep, now, identity, WEEK, ago} from "@welshman/lib"
import {
  getListTags,
  getRelayTagValues,
  WRAP,
  MESSAGE,
  ZAP_GOAL,
  THREAD,
  EVENT_TIME,
  COMMENT,
  isSignedEvent,
} from "@welshman/util"
import {request, pull} from "@welshman/net"
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
} from "@welshman/app"
import {
  INDEXER_RELAYS,
  canDecrypt,
  loadSettings,
  userMembership,
  defaultPubkeys,
  decodeRelay,
  loadMembership,
} from "@app/core/state"
import {loadAlerts, loadAlertStatuses} from "@app/core/requests"

const syncRelays = () => {
  for (const url of INDEXER_RELAYS) {
    loadRelay(url)
  }

  const unsubscribePage = page.subscribe($page => {
    if ($page.params.relay) {
      loadRelay(decodeRelay($page.params.relay))
    }
  })

  const unsubscribeMembership = userMembership.subscribe($l => {
    for (const url of getRelayTagValues(getListTags($l))) {
      loadRelay(url)
    }
  })

  return () => {
    unsubscribePage()
    unsubscribeMembership()
  }
}

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
      loadMembership($pubkey)
      loadMutes($pubkey)
      loadProfile($pubkey)
      loadSettings($pubkey)
    }
  })

  const unsubscribeFollows = userFollows.subscribe(async $l => {
    for (const pubkeys of chunk(10, get(defaultPubkeys))) {
      // This isn't urgent, avoid clogging other stuff up
      await sleep(1000)

      for (const pk of pubkeys) {
        loadRelaySelections(pk).then(() => {
          loadMembership(pk)
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

const syncSpace = (url: string) => {
  const controller = new AbortController()

  // Load historical data
  pull({
    relays: [url],
    signal: controller.signal,
    filters: [{kinds: [ZAP_GOAL, EVENT_TIME, THREAD, MESSAGE, COMMENT]}],
    events: repository
      .query([{kinds: [ZAP_GOAL, EVENT_TIME, THREAD, MESSAGE, COMMENT]}])
      .filter(isSignedEvent),
  })

  // Load new events
  request({
    relays: [url],
    signal: controller.signal,
    filters: [{kinds: [ZAP_GOAL, EVENT_TIME, THREAD, MESSAGE, COMMENT], since: now()}],
  })

  return () => controller.abort()
}

const syncSpaces = () => {
  const unsubscribersByUrl = new Map<string, Unsubscriber>()
  const unsubscribeMembership = userMembership.subscribe($l => {
    const urls = getRelayTagValues(getListTags($l))

    // Start syncing newly added spaces
    for (const url of urls) {
      if (!unsubscribersByUrl.has(url)) {
        unsubscribersByUrl.set(url, syncSpace(url))
      }
    }

    // stop syncing removed spaces
    for (const [url, unsubscribe] of unsubscribersByUrl.entries()) {
      if (!urls.includes(url)) {
        unsubscribersByUrl.delete(url)
        unsubscribe()
      }
    }
  })

  return () => {
    Array.from(unsubscribersByUrl.values()).forEach(call)
    unsubscribeMembership()
  }
}

const syncDMRelay = (url: string, pubkey: string) => {
  const controller = new AbortController()

  // Load historical data
  pull({
    relays: [url],
    signal: controller.signal,
    filters: [{kinds: [WRAP], "#p": [pubkey], until: ago(WEEK, 2)}],
    events: repository
      .query([{kinds: [ZAP_GOAL, EVENT_TIME, THREAD, MESSAGE, COMMENT]}])
      .filter(isSignedEvent),
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
  const unsubscribePubkey = derived([pubkey, canDecrypt], identity).subscribe(
    ([$pubkey, $canDecrypt]) => {
      if ($pubkey !== currentPubkey) {
        unsubscribeAll()
      }

      // If we have a pubkey, refresh our user's relay selections then sync our subscriptions
      if ($pubkey && $canDecrypt) {
        loadRelaySelections($pubkey)
          .then(() => loadInboxRelaySelections($pubkey))
          .then($l => subscribeAll($pubkey, getRelayTagValues(getListTags($l))))
      }

      currentPubkey = $pubkey
    },
  )

  // When user inbox relays change, update synchronization
  const unsubscribeSelections = userInboxRelaySelections.subscribe($l => {
    const $pubkey = pubkey.get()

    if ($pubkey && $l) {
      subscribeAll($pubkey, getRelayTagValues(getListTags($l)))
    }
  })

  return () => {
    unsubscribeAll()
    unsubscribePubkey()
    unsubscribeSelections()
  }
}

export const syncApplicationData = () => {
  const unsubscribers = [syncRelays(), syncUserData(), syncSpaces(), syncDMs()]

  return () => unsubscribers.forEach(call)
}
