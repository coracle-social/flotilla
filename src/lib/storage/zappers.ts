import {getAllFromFile, type FilesystemStorageProvider} from "@lib/storage"
import {get, type Unsubscriber} from "svelte/store"
import {Filesystem, Directory, Encoding} from "@capacitor/filesystem"
import {onZapper, zappers} from "@welshman/app"
import {batch} from "@welshman/lib"
import type {Zapper} from "@welshman/util"

export class ZappersStorageProvider implements FilesystemStorageProvider {
  filepath = "zappers.json"
  directory = Directory.Data
  encoding = Encoding.UTF8

  async initializeState(): Promise<void> {
    zappers.set(await this.getAll())
  }

  sync(): Unsubscriber {
    return onZapper(batch(300, () => this.saveState()))
  }

  async getAll(): Promise<Zapper[]> {
    return await getAllFromFile(this.filepath, this.directory, this.encoding)
  }

  async writeAll(zappers: Zapper[]) {
    await Filesystem.writeFile({
      path: this.filepath,
      directory: this.directory,
      encoding: this.encoding,
      data: JSON.stringify(zappers),
    })
  }

  async saveState() {
    await this.writeAll(get(zappers))
  }

  async clearStorage(): Promise<void> {
    await Filesystem.deleteFile({path: this.filepath, directory: this.directory})
  }
}
