import {SQLiteDBConnection} from "@capacitor-community/sqlite"
import {TrackerMigrationStatements} from "@lib/database/migrations/tracker"
import {sqliteService} from "@lib/database/SQLiteService"
import type {Tracker} from "@welshman/net"
import type {Unsubscriber} from "svelte/store"
import type {DatabaseService} from "@lib/database/DatabaseService"

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
  databaseName: string = "tracker.db"
  versionUpgrades = TrackerMigrationStatements
  loadToVersion = TrackerMigrationStatements[TrackerMigrationStatements.length - 1].toVersion
  db!: SQLiteDBConnection
  platform = sqliteService.getPlatform()
  tracker: Tracker

  constructor({tracker}: {tracker: Tracker}) {
    this.tracker = tracker
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
      throw new Error(`trackerDbService.initializeDatabase: ${msg}`)
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

    this.tracker.on("add", updateOne)
    this.tracker.on("remove", updateOne)
    this.tracker.on("load", updateAll)
    this.tracker.on("clear", updateAll)

    return () => {
      this.tracker.off("add", updateOne)
      this.tracker.off("remove", updateOne)
      this.tracker.off("load", updateAll)
      this.tracker.off("clear", updateAll)
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
      true,
    )
  }

  getDatabaseName(): string {
    return this.databaseName
  }

  getDatabaseVersion(): number {
    return this.loadToVersion
  }
}
