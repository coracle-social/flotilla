import {SQLiteDBConnection} from "@capacitor-community/sqlite"
import {ZappersMigrationStatements} from "./migrations/zappers.migration.statements"
import {sqliteService} from "./SQLiteService"
import type {Unsubscriber} from "svelte/store"
import {onZapper, zappers} from "@welshman/app"
import {type Zapper} from "@welshman/util"
import {batch} from "@welshman/lib"

export interface IZappersDbService {
  initializeDatabase(): Promise<void>
  initializeState(): Promise<void>
  sync(): Unsubscriber
  getZappers(): Promise<Zapper[]>
  updateZappers(zappers: Zapper[]): Promise<void>
  getDatabaseName(): string
  getDatabaseVersion(): number
}

class ZappersDbService implements IZappersDbService {
  databaseName: string = "zappers.db"
  versionUpgrades = ZappersMigrationStatements
  loadToVersion = ZappersMigrationStatements[ZappersMigrationStatements.length - 1].toVersion
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
      throw new Error(`zappersDbService.initializeDatabase: ${msg}`)
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
      return zappers.map(zapper => JSON.parse(zapper) as Zapper)
    } else {
      return []
    }
  }

  async updateZappers(zappers: Zapper[]): Promise<void> {
    const valuesPlaceholder = zappers.map(() => "(?, ?)").join(", ")
    const values = zappers.flatMap(zapper => [zapper.lnurl, JSON.stringify(zapper)])
    await this.db.run(
      `INSERT INTO zappers (lnurl, data) VALUES ${valuesPlaceholder} ON CONFLICT(lnurl) DO UPDATE SET data = excluded.data WHERE zappers.data IS NOT excluded.data;`,
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

export const zappersDbService = new ZappersDbService()
