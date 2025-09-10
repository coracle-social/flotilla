import {SQLiteDBConnection} from "@capacitor-community/sqlite"
import {TrackerMigrationStatements} from "./migrations/tracker.migration.statements"
import {sqliteService} from "./SQLiteService"

export interface ITrackerDbService {
  initializeDatabase(): Promise<void>
  getDatabaseName(): string
  getDatabaseVersion(): number
}

class TrackerDbService implements ITrackerDbService {
  databaseName: string = "tracker.db"
  versionUpgrades = TrackerMigrationStatements
  loadToVersion = TrackerMigrationStatements[TrackerMigrationStatements.length - 1].toVersion
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
      throw new Error(`trackerDbService.initializeDatabase: ${msg}`)
    }
  }

  getDatabaseName(): string {
    return this.databaseName
  }

  getDatabaseVersion(): number {
    return this.loadToVersion
  }
}

export const trackerDbService = new TrackerDbService()
