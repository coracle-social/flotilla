import {type StorageProvider, type SyncConfig} from "@welshman/store"
import {Preferences} from "@capacitor/preferences"

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
