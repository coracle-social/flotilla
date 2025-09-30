import {parseJson} from "@welshman/lib"
import {type StorageProvider} from "@welshman/store"
import {Preferences} from "@capacitor/preferences"
import {Encoding, Filesystem, Directory} from "@capacitor/filesystem"

export class PreferencesStorageProvider implements StorageProvider {
  p = Promise.resolve()

  get = async <T>(key: string): Promise<T | undefined> => {
    const result = await Preferences.get({key})
    if (!result.value) return undefined
    try {
      return JSON.parse(result.value)
    } catch (e) {
      return undefined
    }
  }

  set = async <T>(key: string, value: T): Promise<void> => {
    this.p = this.p.then(() => Preferences.set({key, value: JSON.stringify(value)}))

    await this.p
  }

  clear = async () => {
    this.p = this.p.then(() => Preferences.clear())

    await this.p
  }
}

export const preferencesStorageProvider = new PreferencesStorageProvider()

export class CollectionStorageProvider implements StorageProvider {
  p = Promise.resolve()

  get = async <T>(key: string): Promise<T[]> => {
    try {
      const file = await Filesystem.readFile({
        path: key + ".json",
        directory: Directory.Data,
        encoding: Encoding.UTF8,
      })

      const items: T[] = []
      for (const line of file.data.toString().split("\n")) {
        const item = parseJson(line)

        if (item) {
          items.push(item)
        }
      }

      return items
    } catch (err) {
      // file doesn't exist, or isn't valid json
      return []
    }
  }

  set = async <T>(key: string, value: T[]): Promise<void> => {
    this.p = this.p.then(async () => {
      await Filesystem.writeFile({
        path: key + ".json",
        directory: Directory.Data,
        encoding: Encoding.UTF8,
        data: value.map(v => JSON.stringify(v)).join("\n"),
      })
    })

    await this.p
  }

  add = async <T>(key: string, value: T[]): Promise<void> => {
    this.p = this.p.then(async () => {
      await Filesystem.appendFile({
        path: key + ".json",
        directory: Directory.Data,
        encoding: Encoding.UTF8,
        data: value.map(v => JSON.stringify(v)).join("\n"),
      })
    })

    await this.p
  }

  clear = async (): Promise<void> => {
    this.p = this.p.then(async () => {
      try {
        const res = await Filesystem.readdir({path: "./", directory: Directory.Data})

        await Promise.all(
          res.files.map(file =>
            Filesystem.deleteFile({
              path: file.name + ".json",
              directory: Directory.Data,
            }),
          ),
        )
      } catch (e) {
        // Directory might not have been created
      }
    })

    await this.p
  }
}

export const collectionStorageProvider = new CollectionStorageProvider()
