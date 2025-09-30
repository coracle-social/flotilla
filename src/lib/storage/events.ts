import {getAllFromFile, type FilesystemStorageProvider} from "@lib/storage"
import type {TrustedEvent} from "@welshman/util"
import type {Unsubscriber} from "svelte/store"
import {Filesystem, Directory, Encoding} from "@capacitor/filesystem"
import type {Repository, RepositoryUpdate} from "@welshman/relay"
import {on, sortBy} from "@welshman/lib"

export class EventsStorageProvider implements FilesystemStorageProvider {
  static filepath = "events.json"
  static directory = Directory.Data
  static encoding = Encoding.UTF8
  limit: number
  repository: Repository
  rankEvent: (event: TrustedEvent) => number
  eventCount: number = 0
  isDeleting = false

  constructor({
    limit,
    repository,
    rankEvent,
  }: {
    limit: number
    repository: Repository
    rankEvent: (event: TrustedEvent) => number
  }) {
    this.limit = limit
    this.repository = repository
    this.rankEvent = rankEvent
  }

  async initializeState(): Promise<void> {
    const events = await this.getAll()
    this.eventCount = events.length
    this.repository.load(events)
  }

  sync(): Unsubscriber {
    const onUpdate = async ({added, removed}: RepositoryUpdate) => {
      // Only add events we want to keep
      const keep = added.filter(e => this.rankEvent(e) > 0)

      // Add new events
      if (keep.length > 0) {
        await this.updateEvents(keep)
      }

      // If we're well above our retention limit, drop lowest-ranked events
      if (!this.isDeleting && this.eventCount > this.limit * 1.5) {
        try {
          this.isDeleting = true

          for (const event of sortBy(e => -this.rankEvent(e), await this.getAll()).slice(
            this.limit,
          )) {
            removed.add(event.id)
          }

          if (removed.size > 0) {
            await this.deleteEvents(Array.from(removed))
          }
        } finally {
          this.isDeleting = false
        }
      }

      // Keep track of our total number of events. This isn't strictly accurate, but it's close enough
      this.eventCount = this.eventCount + keep.length - removed.size
    }

    return on(this.repository, "update", onUpdate)
  }

  async getAll(): Promise<TrustedEvent[]> {
    return await getAllFromFile(EventsStorageProvider.filepath, EventsStorageProvider.directory, EventsStorageProvider.encoding)
  }

  async writeAll(events: TrustedEvent[]) {
    await Filesystem.writeFile({
      path: EventsStorageProvider.filepath,
      directory: EventsStorageProvider.directory,
      encoding: EventsStorageProvider.encoding,
      data: JSON.stringify(events),
    })
  }

  async updateEvents(events: TrustedEvent[]) {
    const existing = await this.getAll()
    const updated = existing.concat(events)
    await this.writeAll(updated)
  }

  async deleteEvents(ids: string[]) {
    const existing = await this.getAll()
    const updated = existing.filter(e => !ids.includes(e.id))
    await this.writeAll(updated)
  }

  static async clearStorage(): Promise<void> {
    await Filesystem.deleteFile({path: EventsStorageProvider.filepath, directory: EventsStorageProvider.directory})
  }
}
