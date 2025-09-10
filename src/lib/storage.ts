import {type StorageProvider, type SyncConfig, type SyncedConfig} from "@welshman/store"
import {Preferences} from "@capacitor/preferences"
import {writable} from "svelte/store"
import {relaysDbService} from "./database/RelaysDbService"
import {handlesDbService} from "./database/HandlesDbService"
import {zappersDbService} from "./database/ZappersDbService"
import {freshnessDbService} from "./database/FreshnessDbService"
import {plaintextDbService} from "./database/PlaintextDbService"
import {TrackerDbService} from "./database/TrackerDbService"
import {repository, tracker, unsubscribers} from "@welshman/app"
import {EventsDbService} from "./database/EventsDbService"
import type {DatabaseService} from "./database/DatabaseService"

export class PreferencesStorageProvider implements StorageProvider {
  get = async <T>(key: string): Promise<T | undefined> => {
    const result = await Preferences.get({key})
    if (!result.value) return undefined
    try {
      return JSON.parse(result.value)
    } catch (e) {
      return undefined
    }
  }

  p = Promise.resolve()
  set = async <T>(key: string, value: T): Promise<void> => {
    await this.p
    this.p = Preferences.set({key, value: JSON.stringify(value)})
    await this.p
  }
}

// singleton instance of PreferencesStorageProvider
export const preferencesStorageProvider = new PreferencesStorageProvider()

// Temporary re-implementation of sync function to fix race condition
export const sync = async <T>({key, store, storage}: SyncConfig<T>) => {
  const storedValue = await storage.get(key)

  if (storedValue !== undefined) {
    store.set(storedValue)
  }

  store.subscribe(async (value: T) => {
    await storage.set(key, value)
  })
}

// Temporary implementation of synced function to fix race condition
export const synced = async <T>({key, storage, defaultValue}: SyncedConfig<T>) => {
  const store = writable<T>(defaultValue)

  await sync({key, store, storage})

  return store
}

export const defaultDatabaseServices = {
  relays: relaysDbService,
  handles: handlesDbService,
  zappers: zappersDbService,
  freshness: freshnessDbService,
  plaintext: plaintextDbService,
  tracker: new TrackerDbService(tracker),
  events: new EventsDbService(10_000, repository, () => 1),
}

export const initDatabaseStorage = async (databaseServices: Record<string, DatabaseService>) => {
  await Promise.all(
    Object.values(databaseServices).map(async service => {
      await service.initializeDatabase()
      await service.initializeState()
      unsubscribers.push(service.sync())
    }),
  )
}
