import {SQLiteDBConnection} from "@capacitor-community/sqlite"
import {FreshnessMigrationStatements} from "@lib/database/migrations/freshness"
import {sqliteService} from "@lib/database/SQLiteService"
import {freshness} from "@welshman/store"
import {fromPairs, last} from "@welshman/lib"
import type {Unsubscriber} from "svelte/store"
import type {DatabaseService} from "@lib/database/DatabaseService"

type KV = {key: string; value: any}

export interface IFreshnessDbService extends DatabaseService {
  initializeDatabase(): Promise<void>
  initializeState(): Promise<void>
  sync(): Unsubscriber
  getFreshness(): Promise<KV[]>
  updateFreshness(freshness: Record<string, any>): Promise<void>
  getDatabaseName(): string
  getDatabaseVersion(): number
}

export class FreshnessDbService implements IFreshnessDbService {
  databaseName = "freshness"
  versionUpgrades = FreshnessMigrationStatements
  loadToVersion = last(FreshnessMigrationStatements).toVersion
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
      throw new Error(`freshnessDbService.initializeDatabase: ${err.message || err}`)
    }
  }

  async initializeState(): Promise<void> {
    const items = await this.getFreshness()
    freshness.set(fromPairs(items.map(item => [item.key, item.value])))
  }

  sync(): Unsubscriber {
    const interval = setInterval(() => {
      this.updateFreshness(freshness.get())
    }, 10_000)

    return () => clearInterval(interval)
  }

  async getFreshness(): Promise<KV[]> {
    const freshness = (await this.db.query("SELECT data FROM freshness")).values

    if (freshness) {
      return freshness.map(kv => JSON.parse(kv.data) as KV)
    } else {
      return []
    }
  }

  async updateFreshness(freshness: Record<string, any>): Promise<void> {
    const kvs = Object.entries(freshness).map(([key, value]) => ({key, value}))

    if (kvs.length === 0) {
      return
    }

    const valuesPlaceholder = kvs.map(() => "(?, ?)").join(", ")
    const values = kvs.flatMap(kv => [kv.key, JSON.stringify(kv)])
    await this.db.run(
      `INSERT OR REPLACE INTO freshness (key, data) VALUES ${valuesPlaceholder}`,
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

export const freshnessDbService = new FreshnessDbService()
