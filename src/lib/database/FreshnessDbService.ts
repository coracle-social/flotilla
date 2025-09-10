import {SQLiteDBConnection} from "@capacitor-community/sqlite"
import {FreshnessMigrationStatements} from "./migrations/freshness.migration.statements"
import {sqliteService} from "./SQLiteService"
import {freshness} from "@welshman/store"
import {fromPairs} from "@welshman/lib"
import type {Unsubscriber} from "svelte/store"

type KV = {key: string; value: any}

export interface IFreshnessDbService {
  initializeDatabase(): Promise<void>
  initializeState(): Promise<void>
  sync(): Unsubscriber
  getFreshness(): Promise<KV[]>
  updateFreshness(freshness: Record<string, any>): Promise<void>
  getDatabaseName(): string
  getDatabaseVersion(): number
}

class FreshnessDbService implements IFreshnessDbService {
  databaseName: string = "freshness.db"
  versionUpgrades = FreshnessMigrationStatements
  loadToVersion = FreshnessMigrationStatements[FreshnessMigrationStatements.length - 1].toVersion
  db!: SQLiteDBConnection
  platform = sqliteService.getPlatform()

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
      throw new Error(`freshnessDbService.initializeDatabase: ${msg}`)
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
      return freshness.map(kv => JSON.parse(kv) as KV)
    } else {
      return []
    }
  }

  async updateFreshness(freshness: Record<string, any>): Promise<void> {
    const kvs = Object.entries(freshness).map(([key, value]) => ({key, value}))
    const valuesPlaceholder = kvs.map(() => "(?, ?)").join(", ")
    const values = kvs.flatMap(kv => [kv.key, JSON.stringify(kv)])
    await this.db.run(
      `INSERT INTO freshness (key, data) VALUES ${valuesPlaceholder} ON CONFLICT(key) DO UPDATE SET data = excluded.data WHERE freshness.data IS NOT excluded.data;`,
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

export const freshnessDbService = new FreshnessDbService()
