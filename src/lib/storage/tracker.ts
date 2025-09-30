import {getAllFromFile, type FilesystemStorageProvider} from "@lib/storage"
import type {Unsubscriber} from "svelte/store"
import {Filesystem, Directory, Encoding} from "@capacitor/filesystem"
import type {Tracker} from "@welshman/net"
import {call, on} from "@welshman/lib"

type Entry = {id: string; relays: string[]}

export class TrackerStorageProvider implements FilesystemStorageProvider {
  static filepath = "tracker.json"
  static directory = Directory.Data
  static encoding = Encoding.UTF8
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
    const updateOne = async (id: string, relay: string) => {
      const relays = new Set(await this.getAll())
      relays.add({id, relays: Array.from(this.tracker.getRelays(id))})
      await this.writeAll([...relays])
    }

    const updateAll = async () => {
      await this.writeAll(Array.from(this.tracker.relaysById.entries()).map(([id, relays]) => ({
        id,
        relays: Array.from(relays),
      })))
    }

    const unsubscribers = [
      on(this.tracker, "add", updateOne),
      on(this.tracker, "remove", updateOne),
      on(this.tracker, "load", updateAll),
      on(this.tracker, "clear", updateAll),
    ]

    return () => {
      unsubscribers.forEach(call)
    }
  }

  async getAll(): Promise<Entry[]> {
    return await getAllFromFile(TrackerStorageProvider.filepath, TrackerStorageProvider.directory, TrackerStorageProvider.encoding)
  }

  async writeAll(relays: Entry[]) {
    await Filesystem.writeFile({
      path: TrackerStorageProvider.filepath,
      directory: TrackerStorageProvider.directory,
      encoding: TrackerStorageProvider.encoding,
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

  static async clearStorage(): Promise<void> {
    await Filesystem.deleteFile({path: TrackerStorageProvider.filepath, directory: TrackerStorageProvider.directory})
  }
}
