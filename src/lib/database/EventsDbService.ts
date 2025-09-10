import {SQLiteDBConnection} from "@capacitor-community/sqlite"
import {EventsMigrationStatements} from "./migrations/events.migration.statements"
import {sqliteService} from "./SQLiteService"

export interface IEventsDbService {
  initializeDatabase(): Promise<void>
  getDatabaseName(): string
  getDatabaseVersion(): number
}

class EventsDbService implements IEventsDbService {
  databaseName: string = "events.db"
  versionUpgrades = EventsMigrationStatements
  loadToVersion = EventsMigrationStatements[EventsMigrationStatements.length - 1].toVersion
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
      throw new Error(`eventsDbService.initializeDatabase: ${msg}`)
    }
  }

  getDatabaseName(): string {
    return this.databaseName
  }

  getDatabaseVersion(): number {
    return this.loadToVersion
  }
}

export const eventsDbService = new EventsDbService()
