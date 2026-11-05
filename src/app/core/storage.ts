import {writable} from "svelte/store"
import type {Unsubscriber} from "svelte/store"
import {SecureStorage} from "@aparajita/capacitor-secure-storage"
import {Capacitor, registerPlugin} from "@capacitor/core"
import {Preferences} from "@capacitor/preferences"
import {noop, batch, call, makeQueue} from "@welshman/lib"
import type {Maybe} from "@welshman/lib"
import type {Handle} from "@welshman/util"
import {MemoryRepository, withGetter} from "@welshman/store"
import {Relay, Zapper} from "@welshman/domain"
import type {RelayInfo, ZapperValues} from "@welshman/domain"
import {Handles, Plaintext, Relays, RelayStats, Zappers} from "@welshman/app"
import type {AppOptions, AppPolicy, IApp, MapPlugin, RelayStatsItem} from "@welshman/app"
import {appPolicies} from "@app/core/app"
import {EventDatabase} from "@app/core/database"

type StringStorage = {
  get: (key: string) => Promise<Maybe<string>>
  set: (key: string, value: string) => Promise<void>
  remove: (key: string) => Promise<void>
  clear: () => Promise<void>
}

const makeJsonStore = (storage: StringStorage) => {
  const enqueue = makeQueue()

  const get = async <T>(key: string): Promise<T | undefined> => {
    const value = await storage.get(key)

    if (value) {
      try {
        return JSON.parse(value)
      } catch (e) {
        return undefined
      }
    }
  }

  const set = async <T>(key: string, value: T): Promise<void> => {
    await enqueue(() => storage.set(key, JSON.stringify(value)))
  }

  const remove = async (key: string) => {
    await enqueue(() => storage.remove(key))
  }

  const clear = async () => {
    await enqueue(() => storage.clear())
  }

  return {get, set, remove, clear}
}

export const kv = makeJsonStore({
  get: async key => (await Preferences.get({key})).value ?? undefined,
  set: (key, value) => Preferences.set({key, value}),
  remove: key => Preferences.remove({key}),
  clear: () => Preferences.clear(),
})

const secretStorage: StringStorage =
  Capacitor.getPlatform() === "electron"
    ? call(() => {
        const plugin = registerPlugin<{
          get(options: {key: string}): Promise<{value?: string}>
          set(options: {key: string; value: string}): Promise<void>
          remove(options: {key: string}): Promise<void>
          clear(): Promise<void>
        }>("DesktopSecureStorage")

        return {
          get: async key => (await plugin.get({key})).value,
          set: (key, value) =>
            value === undefined ? plugin.remove({key}) : plugin.set({key, value}),
          remove: key => plugin.remove({key}),
          clear: () => plugin.clear(),
        }
      })
    : {
        get: async key => (await SecureStorage.getItem(key)) ?? undefined,
        // Android's SecureStorage rejects undefined
        set: (key, value) =>
          value === undefined ? SecureStorage.removeItem(key) : SecureStorage.setItem(key, value),
        remove: key => SecureStorage.removeItem(key),
        clear: () => SecureStorage.clear(),
      }

export const ss = makeJsonStore(secretStorage)

const FLUSH_INTERVAL = 3000

const idleWrite = <T>(f: (xs: T[]) => void): ((xs: T[]) => void) => {
  if (typeof requestIdleCallback !== "undefined") {
    return (xs: T[]) => requestIdleCallback(() => f(xs))
  }

  return f
}

type PlaintextItem = {key: string; value: string}

const IDENTITY = "identity"

// The cache an install kept before the marker existed, which is the only sign of it left
const LEGACY_PREFIX = "flotilla-9gl"

const hasLegacyCache = async () => {
  if (!indexedDB.databases) {
    return false
  }

  const databases = await indexedDB.databases()

  return databases.some(db => db.name?.startsWith(LEGACY_PREFIX))
}

/** True while an identity is set up here, which the keychain the session lives in can outlast. */
export const hasCachedIdentity = async () => {
  if ((await kv.get(IDENTITY)) !== undefined) {
    return true
  }

  // The login this allows records the marker, so the fallback only answers once per install
  return hasLegacyCache()
}

const onSweepError = (error: unknown) => console.error("Failed to sweep the event database", error)

const onClearError = (error: unknown) => console.error("Failed to clear the event database", error)

const onCacheError = (error: unknown): [string, string][] => {
  console.error("Failed to read or write a cached collection", error)

  // Anything missing here comes back from the relays
  return []
}

/** The user's events in sqlite with the wraps already read from them, or memory alone if that fails. */
export const openRepository = async (
  pubkey: string,
): Promise<Pick<AppOptions, "repository" | "wrapManager">> => {
  // Preferences go with the app container on every platform, and the keychain the session lives in does not
  await kv.set(IDENTITY, pubkey)

  let database: Maybe<EventDatabase>

  try {
    database = await EventDatabase.open(pubkey)

    // Neither is needed to read and write, so a failure leaves the database in use
    await database.sweep().catch(onSweepError)
    await database.restoreWraps()

    return {repository: database.repository, wrapManager: database.wrapManager}
  } catch (e) {
    console.error("Failed to open the event database", e)

    void database?.repository.close()

    return {repository: new MemoryRepository()}
  }
}

/** Caches an app's local collections in the database its events are in, one database per identity. */
class Storage {
  ready: Promise<void>

  private unsubscribers: Unsubscriber[] = []
  private timeouts: ReturnType<typeof setTimeout>[] = []
  private stopped = false

  constructor(
    private readonly app: IApp,
    private readonly database: EventDatabase,
  ) {
    this.ready = this.start()
  }

  clear = () => this.database.reset().catch(onClearError)

  cleanup = () => {
    this.stopped = true
    this.timeouts.forEach(clearTimeout)
    this.unsubscribers.forEach(call)
    this.database.close()
  }

  private start = async () => {
    this.addUnsubscriber(await this.initRelays())

    const defer = (init: () => Promise<Unsubscriber>) => {
      this.timeouts.push(
        setTimeout(async () => {
          if (!this.stopped) {
            this.addUnsubscriber(await init())
          }
        }, 0),
      )
    }

    defer(this.initRelayStats)
    defer(this.initHandles)
    defer(this.initZappers)
    defer(this.initPlaintext)
  }

  private addUnsubscriber = (unsubscriber: Unsubscriber) => {
    if (this.stopped) {
      unsubscriber()
    } else {
      this.unsubscribers.push(unsubscriber)
    }
  }

  private persistMapPlugin = async <T, Row>(
    name: string,
    plugin: MapPlugin<T>,
    fromRow: (row: Row) => Maybe<[string, T]>,
    toRow: (key: string, item: T) => Row,
  ) => {
    const {repository} = this.database
    const rows = await repository.call("getPluginItems", name).catch(onCacheError)

    for (const [, json] of rows) {
      const entry = fromRow(JSON.parse(json))

      if (entry) {
        plugin.set(...entry)
      }
    }

    const enqueue = batch(
      FLUSH_INTERVAL,
      idleWrite((items: [string, string][]) =>
        repository.call("putPluginItems", name, items).catch(onCacheError),
      ),
    )

    return plugin.onItem((key, item) => {
      if (item) {
        enqueue([key, JSON.stringify(toRow(key, item))])
      }
    })
  }

  private initRelays = () =>
    this.persistMapPlugin(
      "relays",
      this.app.use(Relays),
      (row: RelayInfo & {url: string}) => [row.url, new Relay(row.url, row)],
      (_url, relay) => ({...relay}),
    )

  private initRelayStats = () =>
    this.persistMapPlugin(
      "relayStats",
      this.app.use(RelayStats),
      (row: RelayStatsItem) => [row.url, row],
      (_url, stats) => stats,
    )

  private initHandles = () =>
    this.persistMapPlugin(
      "handles",
      this.app.use(Handles),
      (row: Handle) => [row.nip05, row],
      (_nip05, handle) => handle,
    )

  // Validation is meaningless without pubkey and nostrPubkey, and rows cached before they were required lack them.
  private initZappers = () =>
    this.persistMapPlugin(
      "zappers",
      this.app.use(Zappers),
      (row: ZapperValues) =>
        row.pubkey && row.nostrPubkey ? [row.lnurl, new Zapper(row)] : undefined,
      (_lnurl, zapper) => ({...zapper}),
    )

  private initPlaintext = () =>
    this.persistMapPlugin(
      "plaintext",
      this.app.use(Plaintext),
      (row: PlaintextItem) => [row.key, row.value],
      (key, value) => ({key, value}),
    )
}

// The current app's cache, which only exists once there's an identity and a database to cache for.
export const storage = withGetter(writable<Maybe<Storage>>(undefined))

// Storage is scoped to one app's caches, so it is built and torn down with it.
export const storagePolicy: AppPolicy = $app => {
  const database = EventDatabase.of($app.repository)

  if ($app.user && database) {
    const $storage = new Storage($app, database)

    storage.set($storage)

    return () => {
      $storage.cleanup()
      storage.set(undefined)
    }
  }

  return noop
}

export const registerStorage = () => {
  appPolicies.push(storagePolicy)
}
