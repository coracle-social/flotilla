import type {Readable, Unsubscriber} from "svelte/store"
import {assoc, call} from "@welshman/lib"
import {unionFilters} from "@welshman/util"
import type {Filter} from "@welshman/util"
import {Sync} from "@welshman/app"
import {app} from "@app/core/app"
import {network} from "@app/core/plugins"

// Registry

const syncs: (() => Unsubscriber)[] = []

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

// Merge all synchronization functions

let unsubscribe: Unsubscriber | undefined

export const syncApplicationData = () => {
  unsubscribe?.()

  const unsubscribers = syncs.map(call)

  unsubscribe = () => unsubscribers.forEach(call)

  return () => {
    unsubscribe?.()
    unsubscribe = undefined
  }
}
