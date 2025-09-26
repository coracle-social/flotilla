import {getAllFromFile, type FilesystemStorageProvider} from "@lib/storage"
import {get, type Unsubscriber} from "svelte/store"
import {Filesystem, Directory, Encoding} from "@capacitor/filesystem"
import {batch} from "@welshman/lib"
import {handles, onHandle, type Handle} from "@welshman/app"

export class HandlesStorageProvider implements FilesystemStorageProvider {
  filepath = "handles.json"
  directory = Directory.Data
  encoding = Encoding.UTF8

  async initializeState(): Promise<void> {
    handles.set(await this.getAll())
  }

  sync(): Unsubscriber {
    return onHandle(batch(300, () => this.saveState()))
  }

  async getAll(): Promise<Handle[]> {
    return await getAllFromFile(this.filepath, this.directory, this.encoding)
  }

  async writeAll(handles: Handle[]) {
    await Filesystem.writeFile({
      path: this.filepath,
      directory: this.directory,
      encoding: this.encoding,
      data: JSON.stringify(handles),
    })
  }

  async saveState() {
    await this.writeAll(get(handles))
  }

  async clearStorage(): Promise<void> {
    await Filesystem.deleteFile({path: this.filepath, directory: this.directory})
  }
}
