import {getAllFromFile, type FilesystemStorageProvider} from "@lib/storage"
import type {Unsubscriber} from "svelte/store"
import {Filesystem, Directory, Encoding} from "@capacitor/filesystem"
import {relays, type Relay} from "@welshman/app"
import {throttled} from "@welshman/store"

export class RelaysStorageProvider implements FilesystemStorageProvider {
  static filepath = "relays.json"
  static directory = Directory.Data
  static encoding = Encoding.UTF8

  async initializeState(): Promise<void> {
    relays.set(await this.getAll())
  }

  sync(): Unsubscriber {
    return throttled(3000, relays).subscribe(() => this.saveState())
  }

  async getAll(): Promise<Relay[]> {
    return await getAllFromFile(RelaysStorageProvider.filepath, RelaysStorageProvider.directory, RelaysStorageProvider.encoding)
  }

  async writeAll(relays: Relay[]) {
    await Filesystem.writeFile({
      path: RelaysStorageProvider.filepath,
      directory: RelaysStorageProvider.directory,
      encoding: RelaysStorageProvider.encoding,
      data: JSON.stringify(relays),
    })
  }

  async saveState() {
    await this.writeAll(relays.get())
  }

  static async clearStorage(): Promise<void> {
    await Filesystem.deleteFile({path: RelaysStorageProvider.filepath, directory: RelaysStorageProvider.directory})
  }
}
