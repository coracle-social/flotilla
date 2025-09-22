import {HandlesMigrationStatements} from "@lib/database/migrations/handles"
import {handles, onHandle, type Handle} from "@welshman/app"
import type {Unsubscriber} from "svelte/store"
import {batch, last} from "@welshman/lib"
import {DatabaseService} from "@lib/database/DatabaseService"

export class HandlesDbService extends DatabaseService {
  databaseName = "handles"
  versionUpgrades = HandlesMigrationStatements
  loadToVersion = last(HandlesMigrationStatements).toVersion

  async initializeState(): Promise<void> {
    handles.set(await this.getHandles())
  }

  sync(): Unsubscriber {
    return onHandle(batch(300, $handles => this.updateHandles($handles)))
  }

  async getHandles(): Promise<Handle[]> {
    const handles = (await this.db.query("SELECT data FROM handles")).values

    if (handles) {
      return handles.map(handle => JSON.parse(handle.data) as Handle)
    } else {
      return []
    }
  }

  async updateHandles(handles: Handle[]): Promise<void> {
    if (handles.length === 0) {
      return
    }

    const valuesPlaceholder = handles.map(() => "(?, ?)").join(", ")
    const values = handles.flatMap(handle => [handle.nip05, JSON.stringify(handle)])
    await this.db.run(
      `INSERT OR REPLACE INTO handles (nip05, data) VALUES ${valuesPlaceholder}`,
      values,
      false,
    )
  }

  async clearStorage(): Promise<void> {
    await this.db.execute("DELETE FROM handles", false)
  }
}
