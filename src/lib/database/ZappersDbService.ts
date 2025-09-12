import {SQLiteDBConnection} from "@capacitor-community/sqlite"
import {ZappersMigrationStatements} from "@lib/database/migrations/zappers"
import {sqliteService} from "@lib/database/SQLiteService"
import type {Unsubscriber} from "svelte/store"
import {onZapper, zappers} from "@welshman/app"
import {type Zapper} from "@welshman/util"
import {batch, last} from "@welshman/lib"
import type {DatabaseService} from "@lib/database/DatabaseService"

export interface IZappersDbService extends DatabaseService {
  initializeDatabase(): Promise<void>
  initializeState(): Promise<void>
  sync(): Unsubscriber
  getZappers(): Promise<Zapper[]>
  updateZappers(zappers: Zapper[]): Promise<void>
  getDatabaseName(): string
  getDatabaseVersion(): number
}

export class ZappersDbService implements IZappersDbService {
  databaseName = "zappers"
  versionUpgrades = ZappersMigrationStatements
  loadToVersion = last(ZappersMigrationStatements).toVersion
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
      throw new Error(`zappersDbService.initializeDatabase: ${err.message || err}`)
    }
  }

  async initializeState(): Promise<void> {
    zappers.set(await this.getZappers())
  }

  sync(): Unsubscriber {
    return onZapper(batch(300, $zappers => this.updateZappers($zappers)))
  }

  async getZappers(): Promise<Zapper[]> {
    const zappers = (await this.db.query("SELECT data FROM zappers")).values

    if (zappers) {
      return zappers.map(zapper => JSON.parse(zapper.data) as Zapper)
    } else {
      return []
    }
  }

  async updateZappers(zappers: Zapper[]): Promise<void> {
    const valuesPlaceholder = zappers.map(() => "(?, ?)").join(", ")
    const values = zappers.flatMap(zapper => [zapper.lnurl, JSON.stringify(zapper)])
    await this.db.run(
      `INSERT OR REPLACE INTO zappers (lnurl, data) VALUES ${valuesPlaceholder}`,
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

export const zappersDbService = new ZappersDbService()
