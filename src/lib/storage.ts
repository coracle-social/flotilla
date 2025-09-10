import {type StorageProvider} from "@welshman/store"
import {Preferences} from "@capacitor/preferences"
import {relaysDbService} from "@lib/database/RelaysDbService"
import {handlesDbService} from "@lib/database/HandlesDbService"
import {zappersDbService} from "@lib/database/ZappersDbService"
import {freshnessDbService} from "@lib/database/FreshnessDbService"
import {plaintextDbService} from "@lib/database/PlaintextDbService"
import {TrackerDbService} from "@lib/database/TrackerDbService"
import {EventsDbService} from "@lib/database/EventsDbService"
import {repository, tracker, unsubscribers} from "@welshman/app"
import type {DatabaseService} from "@lib/database/DatabaseService"
import {sqliteService} from "@lib/database/SQLiteService"
import {Capacitor} from "@capacitor/core"
import {defineCustomElements as jeepSqlite} from "jeep-sqlite/loader"

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

export const initSqlPlugin = async () => {
  const platform = Capacitor.getPlatform()

  if (window !== undefined) {
    jeepSqlite(window)

    if (platform === "web") {
      const jeepEl = document.createElement("jeep-sqlite")
      document.body.appendChild(jeepEl)
    }
  }

  try {
    if (platform === "web") await sqliteService.initWebStore()
  } catch (error) {
    const msg = (error as Error).message ? (error as Error).message : error
    throw new Error(`Error while initializing SQL plugin: ${msg}`)
  }
}

export const defaultDatabaseServices = {
  relays: relaysDbService,
  handles: handlesDbService,
  zappers: zappersDbService,
  freshness: freshnessDbService,
  plaintext: plaintextDbService,
  tracker: new TrackerDbService({tracker}),
  events: new EventsDbService({limit: 10_000, repository, rankEvent: () => 1}),
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
