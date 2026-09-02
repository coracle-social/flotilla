import type {Page} from "@playwright/test"
import type {TrustedEvent} from "@welshman/util"

// Must match the database name and the `events` table in src/app/storage.ts, which are scoped to
// one identity.
const databaseName = (pubkey: string) => `flotilla-9gl-${pubkey}`

/**
 * What this user's client has written to disk so far. Events reach indexeddb in three-second
 * batches and nothing in the ui says when one has landed, so a spec about what survives a restart
 * has to read the cache to know the restart is testing anything: a reload before the batch would
 * fail whether or not the events were ever going to be persisted.
 */
export const readCachedEvents = (page: Page, pubkey: string): Promise<TrustedEvent[]> =>
  page.evaluate(async name => {
    const open = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(name)

      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })

    // An unversioned open creates the database when it is missing, so a client that has not written
    // anything yet answers with an empty one rather than with a store to read.
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
