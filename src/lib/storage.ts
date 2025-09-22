import {type StorageProvider} from "@welshman/store"
import {Preferences} from "@capacitor/preferences"
import {TrackerDbService} from "@lib/database/TrackerDbService"
import {EventsDbService} from "@lib/database/EventsDbService"
import {repository, tracker, unsubscribers} from "@welshman/app"
import {DatabaseService} from "@lib/database/DatabaseService"
import {sqliteService} from "@lib/database/SQLiteService"
import {Capacitor} from "@capacitor/core"
import {defineCustomElements as jeepSqlite} from "jeep-sqlite/loader"
import {RelaysDbService} from "./database/RelaysDbService"
import {HandlesDbService} from "./database/HandlesDbService"
import {ZappersDbService} from "./database/ZappersDbService"
import {FreshnessDbService} from "./database/FreshnessDbService"
import {PlaintextDbService} from "./database/PlaintextDbService"
import {Database} from "emoji-picker-element"

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

const initSqlPlugin = async () => {
  const platform = Capacitor.getPlatform()

  if (window !== undefined) {
    jeepSqlite(window)

    if (platform === "web") {
      const jeepEl = document.createElement("jeep-sqlite")
      document.body.appendChild(jeepEl)
      await customElements.whenDefined("jeep-sqlite")
      jeepEl.autoSave = true
    }
  }

  try {
    if (platform === "web") {
      await sqliteService.sqliteConnection.initWebStore()
    }
  } catch (err: any) {
    throw new Error(`Error while initializing SQL plugin: ${err.message || err}`)
  }
}

export const defaultDatabaseServices = {
  relays: new RelaysDbService(),
  handles: new HandlesDbService(),
  zappers: new ZappersDbService(),
  freshness: new FreshnessDbService(),
  plaintext: new PlaintextDbService(),
  tracker: new TrackerDbService({tracker}),
  events: new EventsDbService({limit: 10_000, repository, rankEvent: () => 1}),
}

export const initializedDatabaseServices: DatabaseService[] = []

export const initDatabaseStorage = async (databaseServices: Record<string, DatabaseService>) => {
  await initSqlPlugin()
  await Promise.all(
    Object.values(databaseServices).map(async service => {
      await service.initializeDatabase()
      await service.initializeState()
      unsubscribers.push(service.sync())
      initializedDatabaseServices.push(service)
    }),
  )
}

export const clearDatabaseStorage = async () => {
  await Promise.all(
    initializedDatabaseServices.map(async service => {
      await service.clearStorage()
    }),
  )
}
