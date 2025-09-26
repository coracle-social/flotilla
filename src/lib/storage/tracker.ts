import {getAllFromFile, type FilesystemStorageProvider} from "@lib/storage"
import type {Unsubscriber} from "svelte/store"
import {Filesystem, Directory, Encoding} from "@capacitor/filesystem"
import type {Tracker} from "@welshman/net"
import {call, on} from "@welshman/lib"

type Entry = {id: string; relays: string[]}

export class TrackerStorageProvider implements FilesystemStorageProvider {
  filepath = "tracker.json"
  directory = Directory.Data
  encoding = Encoding.UTF8
  tracker: Tracker

  constructor({tracker}: {tracker: Tracker}) {
    this.tracker = tracker
  }

  async initializeState(): Promise<void> {
    const relaysByid = new Map<string, Set<string>>()

    for (const {id, relays} of await this.getAll()) {
      relaysByid.set(id, new Set(relays))
    }

    this.tracker.load(relaysByid)
  }

  sync(): Unsubscriber {
    const unsubscribers = [
      on(this.tracker, "add", this.saveState),
      on(this.tracker, "remove", this.saveState),
      on(this.tracker, "load", this.saveState),
      on(this.tracker, "clear", this.saveState),
    ]

    return () => {
      unsubscribers.forEach(call)
    }
  }

  async getAll(): Promise<Entry[]> {
    return await getAllFromFile(this.filepath, this.directory, this.encoding)
  }

  async writeAll(relays: Entry[]) {
    await Filesystem.writeFile({
      path: this.filepath,
      directory: this.directory,
      encoding: this.encoding,
      data: JSON.stringify(relays),
    })
  }

  async saveState() {
    await this.writeAll(
      Array.from(this.tracker.relaysById.entries()).map(([id, relays]) => ({
        id,
        relays: Array.from(relays),
      })),
    )
  }

  async clearStorage(): Promise<void> {
    await Filesystem.deleteFile({path: this.filepath, directory: this.directory})
  }
}
