import {reject, identity} from "@welshman/lib"
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

export type CollectionOptions<T> = {
  table: string
  getId: (item: T) => string
}

export class Collection<T> {
  constructor(readonly options: CollectionOptions<T>) {}

  static clearAll = async (): Promise<void> => {
    const res = await Filesystem.readdir({
      path: "",
      directory: Directory.Data,
    })

    await Promise.all(
      res.files.map(file =>
        Filesystem.deleteFile({
          path: file.name,
          directory: Directory.Data,
        }),
      ),
    )
  }

  #path = () => `collection_${this.options.table}.json`

  get = async (): Promise<T[]> => {
    try {
      const file = await Filesystem.readFile({
        path: this.#path(),
        directory: Directory.Data,
        encoding: Encoding.UTF8,
      })

      // Speed things up by parsing only once
      return JSON.parse("[" + file.data.toString().split("\n").filter(identity).join(",") + "]")
    } catch (err) {
      // file doesn't exist, or isn't valid json
      return []
    }
  }

  set = (items: T[]) =>
    Filesystem.writeFile({
      path: this.#path(),
      directory: Directory.Data,
      encoding: Encoding.UTF8,
      data: items.map(v => JSON.stringify(v)).join("\n"),
    })

  add = (items: T[]) =>
    Filesystem.appendFile({
      path: this.#path(),
      directory: Directory.Data,
      encoding: Encoding.UTF8,
      data: "\n" + items.map(v => JSON.stringify(v)).join("\n"),
    })

  remove = async (ids: Set<string>) =>
    this.set(reject(item => ids.has(this.options.getId(item)), await this.get()))

  update = async ({add, remove}: {add?: T[]; remove?: Set<string>}) => {
    if (remove && remove.size > 0) {
      const items = reject(item => remove.has(this.options.getId(item)), await this.get())

      if (add) {
        items.push(...add)
      }

      await this.set(items)
    } else if (add && add.length > 0) {
      await this.add(add)
    }
  }
}
