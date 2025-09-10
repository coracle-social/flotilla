import {SQLiteDBConnection} from "@capacitor-community/sqlite"
import {EventsMigrationStatements} from "./migrations/events.migration.statements"
import {sqliteService} from "./SQLiteService"
import type {Repository, RepositoryUpdate} from "@welshman/relay"
import type {TrustedEvent} from "@welshman/util"
import type {Unsubscriber} from "svelte/store"
import {sortBy} from "@welshman/lib"

export interface IEventsDbService {
  initializeDatabase(): Promise<void>
  initializeState(): Promise<void>
  sync(): Unsubscriber
  getEvents(): Promise<TrustedEvent[]>
  updateEvents(events: TrustedEvent[]): Promise<void>
  deleteEvents(eventIds: string[]): Promise<void>
  getDatabaseName(): string
  getDatabaseVersion(): number
}

class EventsDbService implements IEventsDbService {
  databaseName: string = "events.db"
  versionUpgrades = EventsMigrationStatements
  loadToVersion = EventsMigrationStatements[EventsMigrationStatements.length - 1].toVersion
  db!: SQLiteDBConnection
  platform = sqliteService.getPlatform()
  limit: number
  repository: Repository
  rankEvent: (event: TrustedEvent) => number
  eventCount: number = 0

  constructor(limit: number, repository: Repository, rankEvent: (event: TrustedEvent) => number) {
    this.limit = limit
    this.repository = repository
    this.rankEvent = rankEvent
  }

  async initializeDatabase(): Promise<void> {
    try {
      await sqliteService.addUpgradeStatement({
        database: this.databaseName,
        upgrade: this.versionUpgrades,
      })

      if (this.db) {
        throw new Error("Database already initialized")
      }

      this.db = await sqliteService.openDatabase(this.databaseName, this.loadToVersion, false)

      await sqliteService.saveToStore(this.databaseName)
    } catch (err) {
      const msg = (err as Error).message ? (err as Error).message : err
      throw new Error(`eventsDbService.initializeDatabase: ${msg}`)
    }
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
      if (this.eventCount > this.limit * 1.5) {
        removed = new Set(removed)

        for (const event of sortBy(e => -this.rankEvent(e), await this.getEvents()).slice(
          this.limit,
        )) {
          removed.add(event.id)
        }
      }

      if (removed.size > 0) {
        await this.deleteEvents(Array.from(removed))
      }

      // Keep track of our total number of events. This isn't strictly accurate, but it's close enough
      this.eventCount = this.eventCount + keep.length - removed.size
    }

    this.repository.on("update", onUpdate)

    return () => this.repository.off("update", onUpdate)
  }

  async getEvents(): Promise<TrustedEvent[]> {
    const events = (await this.db.query("SELECT data FROM events")).values

    if (events) {
      return events.map(event => JSON.parse(event) as TrustedEvent)
    } else {
      return []
    }
  }

  async updateEvents(events: TrustedEvent[]): Promise<void> {
    const valuesPlaceholder = events.map(() => "(?, ?)").join(", ")
    const values = events.flatMap(event => [event.id, JSON.stringify(event)])
    await this.db.run(
      `INSERT INTO events (id, data) VALUES ${valuesPlaceholder} ON CONFLICT(id) DO UPDATE SET data = excluded.data WHERE events.data IS NOT excluded.data;`,
      values,
      true,
    )
  }

  async deleteEvents(eventIds: string[]): Promise<void> {
    const valuesPlaceholder = eventIds.map(() => "?").join(", ")
    await this.db.run(`DELETE FROM events WHERE id IN (${valuesPlaceholder});`, eventIds, true)
  }

  getDatabaseName(): string {
    return this.databaseName
  }

  getDatabaseVersion(): number {
    return this.loadToVersion
  }
}
