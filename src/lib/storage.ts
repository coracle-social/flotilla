import {hash, range, reject, flatten, identity, groupBy} from "@welshman/lib"
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
  #shardCount = 1000

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

  getShardIds = () => Array.from(range(0, this.#shardCount))

  getShardId = (id: string) => String(hash(id) % this.#shardCount)

  getShardIdFromItem = (item: T) => this.getShardId(this.options.getId(item))

  #path = (shard: string) => `collection_${this.options.table}_${shard}.json`

  getShard = async (shard: string): Promise<T[]> => {
    try {
      const file = await Filesystem.readFile({
        path: this.#path(shard),
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

  get = async (): Promise<T[]> => flatten(await Promise.all(this.getShardIds().map(id => this.getShard(id))))

  setShard = async (shard: string, items: T[]) =>
    Filesystem.writeFile({
      path: this.#path(shard),
      directory: Directory.Data,
      encoding: Encoding.UTF8,
      data: items.map(v => JSON.stringify(v)).join("\n"),
    })

  set = (items: T[]) =>
    Promise.all(
      Array.from(groupBy(this.getShardIdFromItem, items)).map(([shard, chunk]) =>
        this.setShard(shard, chunk),
      ),
    )

  addToShard = (shard: string, items: T[]) =>
    Filesystem.appendFile({
      path: this.#path(shard),
      directory: Directory.Data,
      encoding: Encoding.UTF8,
      data: "\n" + items.map(v => JSON.stringify(v)).join("\n"),
    })

  add = (items: T[]) =>
    Promise.all(
      Array.from(groupBy(this.getShardIdFromItem, items)).map(([shard, chunk]) =>
        this.addToShard(shard, chunk),
      ),
    )

  removeFromShard = async (shard: string, ids: Set<string>) =>
    this.setShard(
      shard,
      reject(item => ids.has(this.options.getId(item)), await this.getShard(shard)),
    )

  remove = (ids: Iterable<string>) =>
    Promise.all(
      Array.from(groupBy(this.getShardId, ids)).map(([shard, chunk]) =>
        this.removeFromShard(shard, new Set(chunk)),
      ),
    )
}
