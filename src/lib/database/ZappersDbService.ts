import {ZappersMigrationStatements} from "@lib/database/migrations/zappers"
import type {Unsubscriber} from "svelte/store"
import {onZapper, zappers} from "@welshman/app"
import {type Zapper} from "@welshman/util"
import {batch, last} from "@welshman/lib"
import {DatabaseService} from "@lib/database/DatabaseService"

export class ZappersDbService extends DatabaseService {
  databaseName = "zappers"
  versionUpgrades = ZappersMigrationStatements
  loadToVersion = last(ZappersMigrationStatements).toVersion

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
    if (zappers.length === 0) {
      return
    }
    const valuesPlaceholder = zappers.map(() => "(?, ?)").join(", ")
    const values = zappers.flatMap(zapper => [zapper.lnurl, JSON.stringify(zapper)])
    await this.db.run(
      `INSERT OR REPLACE INTO zappers (lnurl, data) VALUES ${valuesPlaceholder}`,
      values,
    )
  }
}

export const zappersDbService = new ZappersDbService()
