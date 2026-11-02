import type {Page} from "@playwright/test"
import type {Filter, TrustedEvent} from "@welshman/util"

// The slice of the `app` store src/routes/+layout.svelte puts on window that this reads.
type AppStore = {
  get: () => {
    user?: {pubkey: string}
    repository: {query: (filters: Filter[]) => Promise<TrustedEvent[]>}
  }
}

/** What this user's client has written to disk, read through the app, which flushes pending writes first. */
export const readCachedEvents = (page: Page, pubkey: string): Promise<TrustedEvent[]> =>
  page.evaluate(async owner => {
    const app: AppStore = Reflect.get(window, "app")
    const $app = app.get()

    // Each identity has a database of its own, which only its app reads.
    return $app.user?.pubkey === owner ? $app.repository.query([{}]) : []
  }, pubkey)
