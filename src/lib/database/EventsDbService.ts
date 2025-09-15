import {EventsMigrationStatements} from "@lib/database/migrations/events"
import type {Repository, RepositoryUpdate} from "@welshman/relay"
import type {TrustedEvent} from "@welshman/util"
import type {Unsubscriber} from "svelte/store"
import {last, on, sortBy} from "@welshman/lib"
import {DatabaseService} from "@lib/database/DatabaseService"

export class EventsDbService extends DatabaseService {
  databaseName = "events"
  versionUpgrades = EventsMigrationStatements
  loadToVersion = last(EventsMigrationStatements).toVersion
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
    super()
    this.limit = limit
    this.repository = repository
    this.rankEvent = rankEvent
  }

  async initializeState(): Promise<void> {
    const events = await this.getEvents()
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

          for (const event of sortBy(e => -this.rankEvent(e), await this.getEvents()).slice(
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

  async getEvents(): Promise<TrustedEvent[]> {
    const events = (await this.db.query("SELECT data FROM events")).values

    if (events) {
      return events.map(event => JSON.parse(event.data) as TrustedEvent)
    } else {
      return []
    }
  }

  async updateEvents(events: TrustedEvent[]): Promise<void> {
    if (events.length === 0) {
      return
    }

    const valuesPlaceholder = events.map(() => "(?, ?)").join(", ")
    const values = events.flatMap(event => [event.id, JSON.stringify(event)])
    await this.db.run(
      `INSERT OR REPLACE INTO events (id, data) VALUES ${valuesPlaceholder}`,
      values,
    )
  }

  async deleteEvents(eventIds: string[]): Promise<void> {
    const valuesPlaceholder = eventIds.map(() => "?").join(", ")
    await this.db.run(`DELETE FROM events WHERE id IN (${valuesPlaceholder})`, eventIds)
  }
}
