import type {SQLiteDBConnection} from "@capacitor-community/sqlite"
import type {Unsubscriber} from "svelte/store"
import {sqliteService} from "./SQLiteService"

export type IDatabaseService = {
  initializeDatabase(): Promise<void>
  initializeState(): Promise<void>
  sync(): Unsubscriber
}

export type VersionUpgrades = {
  toVersion: number
  statements: string[]
}

export abstract class DatabaseService implements IDatabaseService {
  abstract databaseName: string
  abstract versionUpgrades: VersionUpgrades[]
  abstract loadToVersion: number
  platform = sqliteService.platform
  db!: SQLiteDBConnection
  isInitializing = false

  async initializeDatabase(): Promise<void> {
    try {
      if (this.db || this.isInitializing) {
        throw new Error(`Database ${this.databaseName} is already initialized`)
      }
      this.isInitializing = true

      await sqliteService.sqlitePlugin.addUpgradeStatement({
        database: this.databaseName,
        upgrade: this.versionUpgrades,
      })

      this.db = await sqliteService.openDatabase(this.databaseName, this.loadToVersion, false)

      await sqliteService.saveToStore(this.databaseName)
    } catch (err: any) {
      throw new Error(`Failed to initialize ${this.databaseName} database: ${err.message}`)
    } finally {
      this.isInitializing = false
    }
  }

  abstract initializeState(): Promise<void>

  abstract sync(): Unsubscriber
}
