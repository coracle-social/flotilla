import {SQLiteDBConnection} from "@capacitor-community/sqlite"
import {TrackerMigrationStatements} from "@lib/database/migrations/tracker"
import {sqliteService} from "@lib/database/SQLiteService"
import type {Tracker} from "@welshman/net"
import type {Unsubscriber} from "svelte/store"
import type {DatabaseService} from "@lib/database/DatabaseService"
import {call, last, on} from "@welshman/lib"

type Entry = {id: string; relays: string[]}

export interface ITrackerDbService extends DatabaseService {
  initializeDatabase(): Promise<void>
  initializeState(): Promise<void>
  sync(): Unsubscriber
  getTrackers(): Promise<Entry[]>
  updateTrackers(entries: Entry[]): Promise<void>
  getDatabaseName(): string
  getDatabaseVersion(): number
}

export class TrackerDbService implements ITrackerDbService {
  databaseName = "tracker"
  versionUpgrades = TrackerMigrationStatements
  loadToVersion = last(TrackerMigrationStatements).toVersion
  db!: SQLiteDBConnection
  platform = sqliteService.platform
  tracker: Tracker

  constructor({tracker}: {tracker: Tracker}) {
    this.tracker = tracker
  }

  async initializeDatabase(): Promise<void> {
    try {
      await sqliteService.sqlitePlugin.addUpgradeStatement({
        database: this.databaseName,
        upgrade: this.versionUpgrades,
      })

      if (this.db) {
        throw new Error("Database already initialized")
      }

      this.db = await sqliteService.openDatabase(this.databaseName, this.loadToVersion, false)

      // await sqliteService.saveToStore(this.databaseName)
    } catch (err: any) {
      throw new Error(`trackerDbService.initializeDatabase: ${err.message || err}`)
    }
  }

  async initializeState(): Promise<void> {
    const relaysByid = new Map<string, Set<string>>()

    for (const {id, relays} of await this.getTrackers()) {
      relaysByid.set(id, new Set(relays))
    }

    this.tracker.load(relaysByid)
  }

  sync(): Unsubscriber {
    const updateOne = (id: string, relay: string) =>
      this.updateTrackers([{id, relays: Array.from(this.tracker.getRelays(id))}])

    const updateAll = () =>
      this.updateTrackers(
        Array.from(this.tracker.relaysById.entries()).map(([id, relays]) => ({
          id,
          relays: Array.from(relays),
        })),
      )

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

  async getTrackers(): Promise<Entry[]> {
    const entries = (await this.db.query("SELECT data FROM trackers")).values

    if (entries) {
      return entries.map(entry => JSON.parse(entry.data) as Entry)
    } else {
      return []
    }
  }

  async updateTrackers(entries: Entry[]): Promise<void> {
    const valuesPlaceholder = entries.map(() => "(?, ?)").join(", ")
    const values = entries.flatMap(entry => [entry.id, JSON.stringify(entry)])
    await this.db.run(
      `INSERT INTO trackers (id, data) VALUES ${valuesPlaceholder} ON CONFLICT(id) DO UPDATE SET data = excluded.data WHERE trackers.data IS NOT excluded.data;`,
      values,
    )
  }

  getDatabaseName(): string {
    return this.databaseName
  }

  getDatabaseVersion(): number {
    return this.loadToVersion
  }
}
