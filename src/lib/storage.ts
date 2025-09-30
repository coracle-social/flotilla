import {type StorageProvider} from "@welshman/store"
import {Preferences} from "@capacitor/preferences"
import type {Unsubscriber} from "svelte/store"
import {Encoding, Filesystem, type Directory} from "@capacitor/filesystem"
import {EventsStorageProvider} from "@lib/storage/events"
import {FreshnessStorageProvider} from "@lib/storage/freshness"
import {HandlesStorageProvider} from "@lib/storage/handles"
import {PlaintextStorageProvider} from "@lib/storage/plaintext"
import {RelaysStorageProvider} from "@lib/storage/relays"
import {TrackerStorageProvider} from "@lib/storage/tracker"
import {ZappersStorageProvider} from "@lib/storage/zappers"
import {repository, tracker, unsubscribers} from "@welshman/app"

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

export interface FilesystemStorageProvider {
  initializeState(): Promise<void>
  sync(): Unsubscriber
}

export const getAllFromFile = async <T>(
  filepath: string,
  directory: Directory,
  encoding: Encoding,
): Promise<T[]> => {
  try {
    const contents = (
      await Filesystem.readFile({
        path: filepath,
        directory,
        encoding,
      })
    ).data.toString()

    if (!contents || contents == "") {
      return []
    }

    return JSON.parse(contents)
  } catch (err) {
    // file doesn't exist
    return []
  }
}

export const defaultStorageProviders = {
  relays: new RelaysStorageProvider(),
  handles: new RelaysStorageProvider(),
  zappers: new ZappersStorageProvider(),
  freshness: new FreshnessStorageProvider(),
  plaintext: new PlaintextStorageProvider(),
  tracker: new TrackerStorageProvider({tracker}),
  events: new EventsStorageProvider({limit: 10_000, repository, rankEvent: () => 1}),
}

export const initFileStorage = async (storageProviders: Record<string, FilesystemStorageProvider>) => {
  await Promise.all(Object.values(storageProviders).map(async provider => {
    await provider.initializeState()
    unsubscribers.push(provider.sync())
  }))
}

export const clearFileStorage = async (): Promise<void> => {
  await EventsStorageProvider.clearStorage()
  await FreshnessStorageProvider.clearStorage()
  await HandlesStorageProvider.clearStorage()
  await PlaintextStorageProvider.clearStorage()
  await RelaysStorageProvider.clearStorage()
  await TrackerStorageProvider.clearStorage()
  await ZappersStorageProvider.clearStorage()
}