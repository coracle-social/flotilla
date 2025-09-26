import {getAllFromFile, type FilesystemStorageProvider} from "@lib/storage"
import type {Unsubscriber} from "svelte/store"
import {Filesystem, Directory, Encoding} from "@capacitor/filesystem"
import {fromPairs} from "@welshman/lib"
import {freshness} from "@welshman/store"

type KV = {key: string; value: any}

export class FreshnessStorageProvider implements FilesystemStorageProvider {
  filepath = "freshness.json"
  directory = Directory.Data
  encoding = Encoding.UTF8

  async initializeState(): Promise<void> {
    const items = await this.getAll()
    freshness.set(fromPairs(items.map(item => [item.key, item.value])))
  }

  sync(): Unsubscriber {
    const interval = setInterval(() => {
      this.writeAll(freshness.get())
    }, 10_000)

    return () => clearInterval(interval)
  }

  async getAll(): Promise<KV[]> {
    return await getAllFromFile(this.filepath, this.directory, this.encoding)
  }

  async writeAll(items: Record<string, any>) {
    const kvs = Object.entries(items).map(([key, value]) => ({key, value}))

    await Filesystem.writeFile({
      path: this.filepath,
      directory: this.directory,
      encoding: this.encoding,
      data: JSON.stringify(kvs),
    })
  }

  async clearStorage(): Promise<void> {
    await Filesystem.deleteFile({path: this.filepath, directory: this.directory})
  }
}
