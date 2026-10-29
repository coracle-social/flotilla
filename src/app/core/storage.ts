import {writable} from "svelte/store"
import type {Unsubscriber} from "svelte/store"
import {deleteDB} from "idb"
import {SecureStorage} from "@aparajita/capacitor-secure-storage"
import {Capacitor, registerPlugin} from "@capacitor/core"
import {Preferences} from "@capacitor/preferences"
import {noop, batch, call, makeQueue} from "@welshman/lib"
import type {Maybe} from "@welshman/lib"
import {isHashedEvent, verifiedSymbol} from "@welshman/util"
import type {Handle, TrustedEvent} from "@welshman/util"
import {MemoryRepository, withGetter} from "@welshman/store"
import type {WrapItem} from "@welshman/net"
import {Relay, Zapper} from "@welshman/domain"
import type {RelayInfo, ZapperValues} from "@welshman/domain"
import {Handles, Plaintext, Relays, RelayStats, User, Zappers} from "@welshman/app"
import type {AppOptions, AppPolicy, IApp, MapPlugin, RelayStatsItem} from "@welshman/app"
import {IDB} from "@lib/indexeddb"
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

const TABLES = [
  {name: "relays", keyPath: "url"},
  {name: "relayStats", keyPath: "url"},
  {name: "handles", keyPath: "nip05"},
  {name: "zappers", keyPath: "lnurl"},
  {name: "plaintext", keyPath: "key"},
  // Read only to carry what was cached here over to sqlite
  {name: "events", keyPath: "id"},
  {name: "wrapManager", keyPath: "id"},
]

const FLUSH_INTERVAL = 3000

const idleWrite = <T>(f: (xs: T[]) => void): ((xs: T[]) => void) => {
  if (typeof requestIdleCallback !== "undefined") {
    return (xs: T[]) => requestIdleCallback(() => f(xs))
  }

  return f
}

type EventItem = {id: string; event: TrustedEvent; relays: string[]}

type PlaintextItem = {key: string; value: string}

const DATABASE_PREFIX = "flotilla-9gl"

const getDatabaseName = (pubkey: string) => `${DATABASE_PREFIX}-${pubkey}`

// indexeddb goes with the app container on every platform; the iOS keychain the session lives in does not.
export const hasCachedIdentity = async () =>
  typeof indexedDB.databases === "function"
    ? (await indexedDB.databases()).some(db => db.name?.startsWith(DATABASE_PREFIX))
    : true

const onMigrateError = (error: unknown) => console.error("Failed to carry the cache over", error)

const onSweepError = (error: unknown) => console.error("Failed to sweep the event database", error)

const onClearError = (error: unknown) => console.error("Failed to clear the event database", error)

// A wrap the index names is never unwrapped again, so the rumors it points at have to come with it.
const migrateCache = async (database: EventDatabase) => {
  const db = new IDB({name: getDatabaseName(database.pubkey), stores: TABLES})
  const items = await db.table<EventItem>("events").getAll()
  const wraps = await db.table<WrapItem>("wrapManager").getAll()

  if (items.length > 0 || wraps.length > 0) {
    // Rows written before provenance was stored inline hold a bare event, and one bad event
    // would fail the whole batch.
    const events = items.filter(item => isHashedEvent(item.event))

    for (const {id, relays} of events) {
      for (const url of relays) {
        database.tracker.track(id, url)
      }
    }

    // A signed event was checked before it was cached, and sqlite stores whether it was
    await Promise.all(
      events.map(({event}) => {
        if (event.sig) {
          event[verifiedSymbol] = true
        }

        return database.publish(event)
      }),
    )

    await database.call("putWraps", wraps)
    await db.table("events").bulkDelete(items.map(item => item.id))
    await db.table("wrapManager").bulkDelete(wraps.map(wrap => wrap.id))
  }

  await db.close()
}

/** The user's events in sqlite with the wraps already read from them, or memory alone if that fails. */
export const openRepository = async (
  pubkey: string,
): Promise<Pick<AppOptions, "repository" | "wrapManager">> => {
  const database = new EventDatabase(pubkey)

  try {
    await database.ready

    // Neither is needed to read and write, so a failure leaves the database in use
    await migrateCache(database).catch(onMigrateError)
    await database.sweep().catch(onSweepError)
    await database.restoreWraps()

    return {repository: database, wrapManager: database.wrapManager}
  } catch (e) {
    console.error("Failed to open the event database", e)

    void database.close()

    return {repository: new MemoryRepository()}
  }
}

/** Caches an app's local collections in indexeddb, one database per identity, beside its events. */
class Storage {
  ready: Promise<void>

  private db: IDB
  private unsubscribers: Unsubscriber[] = []
  private timeouts: ReturnType<typeof setTimeout>[] = []
  private stopped = false

  constructor(private readonly app: IApp) {
    // Every identity used to share one database; drop it rather than leave it on disk.
    void deleteDB(DATABASE_PREFIX)

    this.db = new IDB({name: getDatabaseName(User.require(app).pubkey), stores: TABLES})
    this.ready = this.start()
  }

  close = () => this.db.close()

  // Logout clears the device even when a database fails, as it always has with indexeddb
  clear = async () => {
    const {repository} = this.app

    if (repository instanceof EventDatabase) {
      await repository.reset().catch(onClearError)
    }

    await this.db.clear()
  }

  cleanup = () => {
    this.stopped = true
    this.timeouts.forEach(clearTimeout)
    this.unsubscribers.forEach(call)
    this.close()
  }

  private start = async () => {
    await this.db.connect()

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
    const table = this.db.table<Row>(name)

    await table.each(row => {
      const entry = fromRow(row)

      if (entry) {
        plugin.set(...entry)
      }
    })

    const enqueue = batch(FLUSH_INTERVAL, idleWrite(table.bulkPut))

    return plugin.onItem((key, item) => {
      if (item) {
        enqueue(toRow(key, item))
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

// The current app's cache, which only exists once there's an identity to cache for.
export const storage = withGetter(writable<Maybe<Storage>>(undefined))

// Storage is scoped to one app's caches, so it is built and torn down with it.
export const storagePolicy: AppPolicy = $app => {
  if ($app.user) {
    const $storage = new Storage($app)

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
