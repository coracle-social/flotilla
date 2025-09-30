import {getAllFromFile, type FilesystemStorageProvider} from "@lib/storage"
import {get, type Unsubscriber} from "svelte/store"
import {Filesystem, Directory, Encoding} from "@capacitor/filesystem"
import {batch} from "@welshman/lib"
import {handles, onHandle, type Handle} from "@welshman/app"

export class HandlesStorageProvider implements FilesystemStorageProvider {
  static filepath = "handles.json"
  static directory = Directory.Data
  static encoding = Encoding.UTF8

  async initializeState(): Promise<void> {
    handles.set(await this.getAll())
  }

  sync(): Unsubscriber {
    return onHandle(batch(300, () => this.saveState()))
  }

  async getAll(): Promise<Handle[]> {
    return await getAllFromFile(HandlesStorageProvider.filepath, HandlesStorageProvider.directory, HandlesStorageProvider.encoding)
  }

  async writeAll(handles: Handle[]) {
    await Filesystem.writeFile({
      path: HandlesStorageProvider.filepath,
      directory: HandlesStorageProvider.directory,
      encoding: HandlesStorageProvider.encoding,
      data: JSON.stringify(handles),
    })
  }

  async saveState() {
    await this.writeAll(get(handles))
  }

  static async clearStorage(): Promise<void> {
    await Filesystem.deleteFile({path: HandlesStorageProvider.filepath, directory: HandlesStorageProvider.directory})
  }
}
