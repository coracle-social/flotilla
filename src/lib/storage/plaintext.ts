import {getAllFromFile, type FilesystemStorageProvider} from "@lib/storage"
import type {Unsubscriber} from "svelte/store"
import {Filesystem, Directory, Encoding} from "@capacitor/filesystem"
import {fromPairs} from "@welshman/lib"
import {plaintext} from "@welshman/app"

type KV = {key: string; value: any}

export class PlaintextStorageProvider implements FilesystemStorageProvider {
  filepath = "plaintext.json"
  directory = Directory.Data
  encoding = Encoding.UTF8

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
