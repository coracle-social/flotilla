import {type StorageProvider} from "@welshman/store"
import {Preferences} from "@capacitor/preferences"
import type {Unsubscriber} from "svelte/store"
import {Encoding, Filesystem, type Directory} from "@capacitor/filesystem"

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
  clearStorage(): Promise<void>
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
