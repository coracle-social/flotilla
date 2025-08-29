import {type StorageProvider, type SyncConfig} from "@welshman/store"
import {Preferences} from "@capacitor/preferences"

export class PreferencesStorageProvider implements StorageProvider {
  get = async (key: string): Promise<any> => {
    const result = await Preferences.get({key})
    if (!result.value) return undefined
    try {
      return JSON.parse(result.value)
    } catch (e) {
      return undefined
    }
  }

  set = async (key: string, value: any): Promise<void> => {
    await Preferences.set({key, value: JSON.stringify(value)})
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
