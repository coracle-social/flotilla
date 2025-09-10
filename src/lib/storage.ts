import {type StorageProvider} from "@welshman/store"
import {Preferences} from "@capacitor/preferences"
import {relaysDbService} from "./database/RelaysDbService"
import {handlesDbService} from "./database/HandlesDbService"
import {zappersDbService} from "./database/ZappersDbService"
import {freshnessDbService} from "./database/FreshnessDbService"
import {plaintextDbService} from "./database/PlaintextDbService"
import {TrackerDbService} from "./database/TrackerDbService"
import {EventsDbService} from "./database/EventsDbService"
import {repository, tracker, unsubscribers} from "@welshman/app"
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
    this.p = this.p.then(async () => await Preferences.set({key, value: JSON.stringify(value)}))
    await this.p
  }

  clear = async (): Promise<void> => {
    await Preferences.clear()
    this.p = Promise.resolve()
  }
}

// singleton instance of PreferencesStorageProvider
export const preferencesStorageProvider = new PreferencesStorageProvider()

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
