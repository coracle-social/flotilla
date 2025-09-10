import {SQLiteDBConnection} from "@capacitor-community/sqlite"
import {HandlesMigrationStatements} from "@lib/database/migrations/handles"
import {sqliteService} from "@lib/database/SQLiteService"
import {handles, onHandle, type Handle} from "@welshman/app"
import type {Unsubscriber} from "svelte/store"
import {batch, last} from "@welshman/lib"
import type {DatabaseService} from "@lib/database/DatabaseService"

export interface IHandlesDbService extends DatabaseService {
  initializeDatabase(): Promise<void>
  initializeState(): Promise<void>
  sync(): Unsubscriber
  getHandles(): Promise<Handle[]>
  updateHandles(handles: Handle[]): Promise<void>
  getDatabaseName(): string
  getDatabaseVersion(): number
}

export class HandlesDbService implements IHandlesDbService {
  databaseName = "handles.db"
  versionUpgrades = HandlesMigrationStatements
  loadToVersion = last(HandlesMigrationStatements).toVersion
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
      throw new Error(`handlesDbService.initializeDatabase: ${msg}`)
    }
  }

  async initializeState(): Promise<void> {
    handles.set(await this.getHandles())
  }

  sync(): Unsubscriber {
    return onHandle(batch(300, $handles => this.updateHandles($handles)))
  }

  async getHandles(): Promise<Handle[]> {
    const handles = (await this.db.query("SELECT data FROM handles")).values

    if (handles) {
      return handles.map(handle => JSON.parse(handle) as Handle)
    } else {
      return []
    }
  }

  async updateHandles(handles: Handle[]): Promise<void> {
    const valuesPlaceholder = handles.map(() => "(?, ?)").join(", ")
    const values = handles.flatMap(handle => [handle.nip05, JSON.stringify(handle)])
    await this.db.run(
      `INSERT INTO handles (nip05, data) VALUES ${valuesPlaceholder} ON CONFLICT(nip05) DO UPDATE SET data = excluded.data WHERE handles.data IS NOT excluded.data;`,
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

export const handlesDbService = new HandlesDbService()
