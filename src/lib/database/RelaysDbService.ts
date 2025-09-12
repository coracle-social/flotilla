import {SQLiteDBConnection} from "@capacitor-community/sqlite"
import {RelaysMigrationStatements} from "@lib/database/migrations/relays"
import {sqliteService} from "@lib/database/SQLiteService"
import {relays, type Relay} from "@welshman/app"
import {throttled} from "@welshman/store"
import type {Unsubscriber} from "svelte/store"
import type {DatabaseService} from "@lib/database/DatabaseService"
import {last} from "@welshman/lib"

export interface IRelaysDbService extends DatabaseService {
  initializeDatabase(): Promise<void>
  initializeState(): Promise<void>
  sync(): Unsubscriber
  getRelays(): Promise<Relay[]>
  updateRelays(relays: Relay[]): Promise<void>
  getDatabaseName(): string
  getDatabaseVersion(): number
}

export class RelaysDbService implements IRelaysDbService {
  databaseName = "relays"
  versionUpgrades = RelaysMigrationStatements
  loadToVersion = last(RelaysMigrationStatements).toVersion
  db!: SQLiteDBConnection
  platform = sqliteService.platform

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
      throw new Error(`relaysDbService.initializeDatabase: ${err.message || err}`)
    }
  }

  async initializeState(): Promise<void> {
    relays.set(await this.getRelays())
  }

  sync(): Unsubscriber {
    return throttled(3000, relays).subscribe($relays => this.updateRelays($relays))
  }

  async getRelays(): Promise<Relay[]> {
    const relays = (await this.db.query("SELECT data FROM relays")).values

    if (relays) {
      return relays.map(relay => JSON.parse(relay.data) as Relay)
    } else {
      return []
    }
  }

  async updateRelays(relays: Relay[]): Promise<void> {
    const valuesPlaceholder = relays.map(() => "(?, ?)").join(", ")
    const values = relays.flatMap(relay => [relay.url, JSON.stringify(relay)])
    await this.db.run(
      `INSERT OR REPLACE INTO relays (url, data) VALUES ${valuesPlaceholder}`,
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

export const relaysDbService = new RelaysDbService()
