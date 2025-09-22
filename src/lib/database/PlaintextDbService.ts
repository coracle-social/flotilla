import {PlaintextMigrationStatements} from "@lib/database/migrations/plaintext"
import type {Unsubscriber} from "svelte/store"
import {plaintext} from "@welshman/app"
import {fromPairs, last} from "@welshman/lib"
import {DatabaseService} from "@lib/database/DatabaseService"

type KV = {key: string; value: any}

export class PlaintextDbService extends DatabaseService {
  databaseName = "plaintext"
  versionUpgrades = PlaintextMigrationStatements
  loadToVersion = last(PlaintextMigrationStatements).toVersion

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
      return plaintext.map(kv => JSON.parse(kv.data) as KV)
    } else {
      return []
    }
  }

  async updatePlaintext(plaintext: Record<string, any>): Promise<void> {
    const kvs = Object.entries(plaintext).map(([key, value]) => ({key, value}))

    if (kvs.length === 0) {
      return
    }

    const valuesPlaceholder = kvs.map(() => "(?, ?)").join(", ")
    const values = kvs.flatMap(kv => [kv.key, JSON.stringify(kv)])
    await this.db.run(
      `INSERT OR REPLACE INTO plaintext (key, data) VALUES ${valuesPlaceholder}`,
      values,
      false,
    )
  }

  async clearStorage(): Promise<void> {
    await this.db.execute("DELETE FROM plaintext", false)
  }
}
