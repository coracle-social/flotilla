import {SQLiteDBConnection} from "@capacitor-community/sqlite"
import {PlaintextMigrationStatements} from "@lib/database/migrations/plaintext"
import {sqliteService} from "@lib/database/SQLiteService"
import type {Unsubscriber} from "svelte/store"
import {plaintext} from "@welshman/app"
import {fromPairs, last} from "@welshman/lib"
import type {DatabaseService} from "@lib/database/DatabaseService"

type KV = {key: string; value: any}

export interface IPlaintextDbService extends DatabaseService {
  initializeDatabase(): Promise<void>
  initializeState(): Promise<void>
  sync(): Unsubscriber
  getPlaintext(): Promise<KV[]>
  updatePlaintext(plaintext: Record<string, any>): Promise<void>
  getDatabaseName(): string
  getDatabaseVersion(): number
}

export class PlaintextDbService implements IPlaintextDbService {
  databaseName = "plaintext"
  versionUpgrades = PlaintextMigrationStatements
  loadToVersion = last(PlaintextMigrationStatements).toVersion
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
      throw new Error(`plaintextDbService.initializeDatabase: ${err.message || err}`)
    }
  }

  async initializeState(): Promise<void> {
    const items = await this.getPlaintext()
    plaintext.set(fromPairs(items.map(item => [item.key, item.value])))
  }

  sync(): Unsubscriber {
    const interval = setInterval(() => {
      this.updatePlaintext(plaintext.get())
    }, 10_000)

    return () => clearInterval(interval)
  }

  async getPlaintext(): Promise<KV[]> {
    const plaintext = (await this.db.query("SELECT data FROM plaintext")).values

    if (plaintext) {
      return plaintext.map(kv => JSON.parse(kv) as KV)
    } else {
      return []
    }
  }

  async updatePlaintext(plaintext: Record<string, any>): Promise<void> {
    const kvs = Object.entries(plaintext).map(([key, value]) => ({key, value}))
    const valuesPlaceholder = kvs.map(() => "(?, ?)").join(", ")
    const values = kvs.flatMap(kv => [kv.key, JSON.stringify(kv)])
    await this.db.run(
      `INSERT INTO plaintext (key, data) VALUES ${valuesPlaceholder} ON CONFLICT(key) DO UPDATE SET data = excluded.data WHERE plaintext.data IS NOT excluded.data;`,
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

export const plaintextDbService = new PlaintextDbService()
