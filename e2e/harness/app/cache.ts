import type {Page} from "@playwright/test"
import type {TrustedEvent} from "@welshman/util"

// Must match the database name and the `events` table in src/app/storage.ts.
const databaseName = (pubkey: string) => `flotilla-9gl-${pubkey}`

/** What this user's client has written to disk. Events reach indexeddb in three-second batches. */
export const readCachedEvents = (page: Page, pubkey: string): Promise<TrustedEvent[]> =>
  page.evaluate(async name => {
    const open = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(name)

      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })

    // An unversioned open creates the database when it is missing, so a client with no writes has no store.
    if (!open.objectStoreNames.contains("events")) {
      open.close()

      return []
    }

    const items = await new Promise<{event: TrustedEvent}[]>((resolve, reject) => {
      const request = open.transaction("events", "readonly").objectStore("events").getAll()

      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })

    open.close()

    return items.map(item => item.event)
  }, databaseName(pubkey))
