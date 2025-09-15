import {TrackerMigrationStatements} from "@lib/database/migrations/tracker"
import type {Tracker} from "@welshman/net"
import type {Unsubscriber} from "svelte/store"
import {DatabaseService} from "@lib/database/DatabaseService"
import {call, last, on} from "@welshman/lib"

type Entry = {id: string; relays: string[]}

export class TrackerDbService extends DatabaseService {
  databaseName = "tracker"
  versionUpgrades = TrackerMigrationStatements
  loadToVersion = last(TrackerMigrationStatements).toVersion
  tracker: Tracker

  constructor({tracker}: {tracker: Tracker}) {
    super()
    this.tracker = tracker
  }

  async initializeState(): Promise<void> {
    const relaysByid = new Map<string, Set<string>>()

    for (const {id, relays} of await this.getTrackers()) {
      relaysByid.set(id, new Set(relays))
    }

    this.tracker.load(relaysByid)
  }

  sync(): Unsubscriber {
    const updateOne = (id: string, relay: string) =>
      this.updateTrackers([{id, relays: Array.from(this.tracker.getRelays(id))}])

    const updateAll = () =>
      this.updateTrackers(
        Array.from(this.tracker.relaysById.entries()).map(([id, relays]) => ({
          id,
          relays: Array.from(relays),
        })),
      )

    const unsubscribers = [
      on(this.tracker, "add", updateOne),
      on(this.tracker, "remove", updateOne),
      on(this.tracker, "load", updateAll),
      on(this.tracker, "clear", updateAll),
    ]

    return () => {
      unsubscribers.forEach(call)
    }
  }

  async getTrackers(): Promise<Entry[]> {
    const entries = (await this.db.query("SELECT data FROM trackers")).values

    if (entries) {
      return entries.map(entry => JSON.parse(entry.data) as Entry)
    } else {
      return []
    }
  }

  async updateTrackers(entries: Entry[]): Promise<void> {
    if (entries.length === 0) {
      return
    }

    const valuesPlaceholder = entries.map(() => "(?, ?)").join(", ")
    const values = entries.flatMap(entry => [entry.id, JSON.stringify(entry)])
    await this.db.run(
      `INSERT OR REPLACE INTO trackers (id, data) VALUES ${valuesPlaceholder}`,
      values,
    )
  }
}
