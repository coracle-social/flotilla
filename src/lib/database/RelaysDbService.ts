import {RelaysMigrationStatements} from "@lib/database/migrations/relays"
import {relays, type Relay} from "@welshman/app"
import {throttled} from "@welshman/store"
import type {Unsubscriber} from "svelte/store"
import {DatabaseService} from "@lib/database/DatabaseService"
import {last} from "@welshman/lib"

export class RelaysDbService extends DatabaseService {
  databaseName = "relays"
  versionUpgrades = RelaysMigrationStatements
  loadToVersion = last(RelaysMigrationStatements).toVersion

  async initializeState(): Promise<void> {
    relays.set(await this.getRelays())
  }

  sync(): Unsubscriber {
    return throttled(3000, relays).subscribe($relays => this.updateRelays($relays))
  }

  async getRelays(): Promise<Relay[]> {
    const relays = (await this.db.query("SELECT data FROM relays")).values

    if (relays) {
      return relays.map(relay => JSON.parse(relay.data) as Relay)
    } else {
      return []
    }
  }

  async updateRelays(relays: Relay[]): Promise<void> {
    if (relays.length === 0) {
      return
    }

    const valuesPlaceholder = relays.map(() => "(?, ?)").join(", ")
    const values = relays.flatMap(relay => [relay.url, JSON.stringify(relay)])
    await this.db.run(
      `INSERT OR REPLACE INTO relays (url, data) VALUES ${valuesPlaceholder}`,
      values,
      false,
    )
  }

  async clearStorage(): Promise<void> {
    await this.db.execute("DELETE FROM relays", false)
  }
}
