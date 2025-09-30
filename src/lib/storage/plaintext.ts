import {getAllFromFile, type FilesystemStorageProvider} from "@lib/storage"
import type {Unsubscriber} from "svelte/store"
import {Filesystem, Directory, Encoding} from "@capacitor/filesystem"
import {fromPairs} from "@welshman/lib"
import {plaintext} from "@welshman/app"

type KV = {key: string; value: any}

export class PlaintextStorageProvider implements FilesystemStorageProvider {
  static filepath = "plaintext.json"
  static directory = Directory.Data
  static encoding = Encoding.UTF8

  async initializeState(): Promise<void> {
    const items = await this.getAll()
    plaintext.set(fromPairs(items.map(item => [item.key, item.value])))
  }

  sync(): Unsubscriber {
    const interval = setInterval(() => {
      this.writeAll(plaintext.get())
    }, 10_000)

    return () => clearInterval(interval)
  }

  async getAll(): Promise<KV[]> {
    return await getAllFromFile(PlaintextStorageProvider.filepath, PlaintextStorageProvider.directory, PlaintextStorageProvider.encoding)
  }

  async writeAll(items: Record<string, any>) {
    const kvs = Object.entries(items).map(([key, value]) => ({key, value}))

    await Filesystem.writeFile({
      path: PlaintextStorageProvider.filepath,
      directory: PlaintextStorageProvider.directory,
      encoding: PlaintextStorageProvider.encoding,
      data: JSON.stringify(kvs),
    })
  }

  static async clearStorage(): Promise<void> {
    await Filesystem.deleteFile({path: PlaintextStorageProvider.filepath, directory: PlaintextStorageProvider.directory})
  }
}
