import type {Readable, Unsubscriber} from "svelte/store"
import {assoc, call, noop} from "@welshman/lib"
import type {Maybe} from "@welshman/lib"
import {FOLLOWS, MUTES, unionFilters} from "@welshman/util"
import type {Filter} from "@welshman/util"
import type {FollowListReader} from "@welshman/domain"
import {FollowLists, RelayLists, SearchRelayLists, Sync} from "@welshman/app"
import {app, deriveUserItem} from "@app/core/app"
import {
  blockedRelayLists,
  blossomServerLists,
  followLists,
  muteLists,
  network,
  profiles,
  relayLists,
  relays,
  searchRelayLists,
} from "@app/core/plugins"
import {INDEXER_RELAYS} from "@app/core/env"
import {outboxUrls} from "@app/core/relays"
import {Settings} from "@app/core/settings"

const syncs: (() => Unsubscriber)[] = []

// Started with the built-in syncs, and restarted with them when login swaps the app.
export const registerSync = (sync: () => Unsubscriber) => {
  syncs.push(sync)
}

// Utils

export const pullAndListen = (url: string, filters: Filter[]) => {
  const controller = new AbortController()

  app
    .get()
    .use(Sync)
    .pull({relays: [url], filters})
  network.get().request({
    relays: [url],
    signal: controller.signal,
    filters: unionFilters(filters.map(assoc("limit", 0))),
  })

  return () => controller.abort()
}

// Runs one sync per key, starting it when the key appears and stopping it when the key goes away.
export const makeKeyedSyncs = (start: (key: string) => Unsubscriber) => {
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

export const syncEach = (
  keys: Readable<Iterable<string>>,
  start: (key: string) => Unsubscriber,
) => {
  const keyedSyncs = makeKeyedSyncs(start)
  const unsubscribe = keys.subscribe(keyedSyncs.reconcile)

  return () => {
    keyedSyncs.stop()
    unsubscribe()
  }
}

export const userRelayList = deriveUserItem(RelayLists)

// The user's lists are read from their outbox, so each is loaded again once the relay list arrives.
export const syncUserList = (load: (pubkey: string) => unknown) => {
  const $pubkey = app.get().user?.pubkey

  if ($pubkey) {
    return userRelayList.subscribe(() => load($pubkey))
  }

  return noop
}

const userFollowList = deriveUserItem(FollowLists)

const userSearchRelayList = deriveUserItem(SearchRelayLists)

// Relays

const syncRelays = () => {
  for (const url of INDEXER_RELAYS) {
    relays.get().load(url)
  }

  return userSearchRelayList.subscribe($searchRelayList => {
    for (const url of $searchRelayList?.urls() ?? []) {
      relays.get().load(url)
    }
  })
}

// User data

const syncFollowNetwork = async ($followList: Maybe<FollowListReader>) => {
  const authors = $followList?.pubkeys() ?? []

  if (authors.length > 0) {
    network.get().load({
      filters: [{kinds: [FOLLOWS, MUTES], authors}],
      relays: await outboxUrls(authors, 8),
    })
  }
}

const syncUserData = () => {
  const $pubkey = app.get().user?.pubkey

  if ($pubkey) {
    relayLists.get().load($pubkey)
  }

  const unsubscribeLists = syncUserList(pubkey => {
    blossomServerLists.get().load(pubkey)
    blockedRelayLists.get().load(pubkey)
    followLists.get().load(pubkey)
    muteLists.get().load(pubkey)
    profiles.get().load(pubkey)
    searchRelayLists.get().load(pubkey)
    app.get().use(Settings).load(pubkey)
  })

  const unsubscribeFollowList = userFollowList.subscribe(syncFollowNetwork)

  return () => {
    unsubscribeLists()
    unsubscribeFollowList()
  }
}

// Merge all synchronization functions

let unsubscribe: Unsubscriber | undefined

export const syncApplicationData = () => {
  unsubscribe?.()

  const unsubscribers = [syncRelays(), syncUserData(), ...syncs.map(call)]

  unsubscribe = () => unsubscribers.forEach(call)

  return () => {
    unsubscribe?.()
    unsubscribe = undefined
  }
}
