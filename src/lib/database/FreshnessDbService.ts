import {FreshnessMigrationStatements} from "@lib/database/migrations/freshness"
import {freshness} from "@welshman/store"
import {fromPairs, last} from "@welshman/lib"
import type {Unsubscriber} from "svelte/store"
import {DatabaseService} from "@lib/database/DatabaseService"

type KV = {key: string; value: any}

export class FreshnessDbService extends DatabaseService {
  databaseName = "freshness"
  versionUpgrades = FreshnessMigrationStatements
  loadToVersion = last(FreshnessMigrationStatements).toVersion

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
}

export const freshnessDbService = new FreshnessDbService()
