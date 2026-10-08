import {writable} from "svelte/store"
import type {Unsubscriber} from "svelte/store"
import {deleteDB} from "idb"
import {SecureStorage} from "@aparajita/capacitor-secure-storage"
import {Capacitor, registerPlugin} from "@capacitor/core"
import {Preferences} from "@capacitor/preferences"
import {MONTH, WEEK, ago, noop, now, on, batch, call, makeQueue} from "@welshman/lib"
import type {Maybe} from "@welshman/lib"
import {
  ALERT_ANDROID,
  ALERT_EMAIL,
  ALERT_IOS,
  ALERT_STATUS,
  ALERT_WEB,
  APP_DATA,
  BLOSSOM_SERVERS,
  COMMAND,
  COMMENT,
  FOLLOWS,
  MESSAGE,
  MESSAGING_RELAYS,
  MUTES,
  POLL_RESPONSE,
  PROFILE,
  RELAY_ADD_MEMBER,
  RELAY_JOIN,
  RELAY_LEAVE,
  RELAY_MEMBERS,
  RELAY_REMOVE_MEMBER,
  RELAYS,
  ROOM_ADD_MEMBER,
  ROOM_CREATE_PERMISSION,
  ROOM_MEMBERS,
  ROOM_ADMINS,
  ROOM_META,
  ROOM_PINS,
  ROOM_DELETE,
  ROOM_REMOVE_MEMBER,
  ROOMS,
  DELETE,
  REACTION,
  REPORT,
  hexTags,
  isSignedEvent,
  tagSpec,
  tagValue,
  tagValues,
  verifiedSymbol,
} from "@welshman/util"
import type {Handle, TrustedEvent} from "@welshman/util"
import {withGetter} from "@welshman/store"
import type {RepositoryUpdate, WrapItem} from "@welshman/net"
import {Relay, Zapper} from "@welshman/domain"
import type {RelayInfo, ZapperValues} from "@welshman/domain"
import {Handles, Plaintext, Relays, RelayStats, User, Zappers} from "@welshman/app"
import type {AppPolicy, IApp, MapPlugin, RelayStatsItem} from "@welshman/app"
import {IDB} from "@lib/indexeddb"
import {appPolicies} from "@app/core"
import {CONTENT_KINDS, DM_KINDS} from "@app/content"

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
        get: async key => {
          let value = await SecureStorage.getItem(key)

          if (!value) {
            const legacy = await Preferences.get({key})

            if (legacy.value) {
              value = legacy.value
              await SecureStorage.setItem(key, legacy.value)
              await Preferences.remove({key})
            }
          }

          return value ?? undefined
        },
        // Android's SecureStorage rejects undefined
        set: (key, value) =>
          value === undefined ? SecureStorage.removeItem(key) : SecureStorage.setItem(key, value),
        remove: key => SecureStorage.removeItem(key),
        clear: () => SecureStorage.clear(),
      }

export const ss = makeJsonStore(secretStorage)

const TABLES = [
  {name: "events", keyPath: "id"},
  {name: "relays", keyPath: "url"},
  {name: "relayStats", keyPath: "url"},
  {name: "handles", keyPath: "nip05"},
  {name: "zappers", keyPath: "lnurl"},
  {name: "plaintext", keyPath: "key"},
  {name: "wrapManager", keyPath: "id"},
]

const FLUSH_INTERVAL = 3000

const idleWrite = <T>(f: (xs: T[]) => void): ((xs: T[]) => void) => {
  if (typeof requestIdleCallback !== "undefined") {
    return (xs: T[]) => requestIdleCallback(() => f(xs))
  }

  return f
}

const kinds = {
  meta: [PROFILE, FOLLOWS, MUTES, RELAYS, BLOSSOM_SERVERS, MESSAGING_RELAYS, APP_DATA, ROOMS],
  alert: [ALERT_STATUS, ALERT_EMAIL, ALERT_WEB, ALERT_IOS, ALERT_ANDROID],
  space: [RELAY_ADD_MEMBER, RELAY_REMOVE_MEMBER, RELAY_MEMBERS, RELAY_JOIN, RELAY_LEAVE, COMMAND],
  room: [
    ROOM_META,
    ROOM_DELETE,
    ROOM_ADMINS,
    ROOM_MEMBERS,
    ROOM_ADD_MEMBER,
    ROOM_REMOVE_MEMBER,
    ROOM_CREATE_PERMISSION,
    ROOM_PINS,
  ],
  content: [MESSAGE, COMMENT, DELETE, REPORT, POLL_RESPONSE, ...CONTENT_KINDS],
}

const isRelayScoped = (event: TrustedEvent) =>
  kinds.space.includes(event.kind) || kinds.room.includes(event.kind)

/** A space is asked for its own content on every load, where the wider network's notes never are. */
const isSpaceContent = (event: TrustedEvent) =>
  kinds.content.includes(event.kind) && Boolean(tagValue(tagSpec("h"), event.tags))

/** A month of a space's content is kept, which is what bounds the read at startup. */
const isRecentSpaceContent = (event: TrustedEvent) =>
  isSpaceContent(event) && event.created_at > ago(1, MONTH)

/** Anything the app reads through a relay is useless without the provenance keying it to one. */
const needsProvenance = (event: TrustedEvent) => isRelayScoped(event) || isSpaceContent(event)

const isMembershipChange = (event: TrustedEvent) =>
  event.kind === ROOM_ADD_MEMBER || event.kind === ROOM_REMOVE_MEMBER

const isConversation = (event: TrustedEvent) =>
  DM_KINDS.includes(event.kind) ||
  ([DELETE, REACTION].includes(event.kind) && !isSignedEvent(event))

const shouldPersistEvent = (event: TrustedEvent, pubkey: string) =>
  isMembershipChange(event)
    ? tagValues(hexTags("p"), event.tags).includes(pubkey)
    : kinds.meta.includes(event.kind) ||
      kinds.alert.includes(event.kind) ||
      isRelayScoped(event) ||
      isConversation(event) ||
      isRecentSpaceContent(event)

type EventItem = {id: string; event: TrustedEvent; relays: string[]; cachedAt?: number}

/** A command definition is advisory, so one not republished in a week is dropped. */
const isStaleCommand = (item: EventItem) =>
  item.event.kind === COMMAND && (item.cachedAt ?? now()) < ago(1, WEEK)

type PlaintextItem = {key: string; value: string}

const DATABASE_PREFIX = "flotilla-9gl"

// indexeddb goes with the app container on every platform; the iOS keychain the session lives in does not.
export const hasCachedIdentity = async () =>
  typeof indexedDB.databases === "function"
    ? (await indexedDB.databases()).some(db => db.name?.startsWith(DATABASE_PREFIX))
    : true

/** Caches an app's repository, tracker and local collections in indexeddb, one database per identity. */
class Storage {
  ready: Promise<void>

  private db: IDB
  private cachedAt = new Map<string, number>()
  private unsubscribers: Unsubscriber[] = []
  private timeouts: ReturnType<typeof setTimeout>[] = []
  private stopped = false

  private readonly pubkey: string

  constructor(private readonly app: IApp) {
    // Every identity used to share one database; drop it rather than leave it on disk.
    void deleteDB(DATABASE_PREFIX)

    this.pubkey = User.require(app).pubkey
    this.db = new IDB({name: `${DATABASE_PREFIX}-${this.pubkey}`, stores: TABLES})
    this.ready = this.start()
  }

  close = () => this.db.close()

  clear = () => this.db.clear()

  cleanup = () => {
    this.stopped = true
    this.timeouts.forEach(clearTimeout)
    this.unsubscribers.forEach(call)
    this.close()
  }

  private start = async () => {
    await this.db.connect()

    const [, unsubscribeRelays] = await Promise.all([this.loadCriticalData(), this.initRelays()])

    this.addUnsubscriber(this.syncEvents())
    this.addUnsubscriber(this.syncTracker())
    this.addUnsubscriber(unsubscribeRelays)

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
    defer(this.initWrapManager)
  }

  private addUnsubscriber = (unsubscriber: Unsubscriber) => {
    if (this.stopped) {
      unsubscriber()
    } else {
      this.unsubscribers.push(unsubscriber)
    }
  }

  /** An event that lost its provenance can never be keyed to a space again, so drop it. */
  private loadCriticalData = async () => {
    const table = this.db.table<EventItem>("events")
    const items: EventItem[] = []
    const stale: string[] = []

    for (const item of await table.getAll()) {
      // Rows written before provenance was stored inline hold a bare event
      if (
        item.event &&
        shouldPersistEvent(item.event, this.pubkey) &&
        (!needsProvenance(item.event) || item.relays.length > 0) &&
        !isStaleCommand(item)
      ) {
        item.event[verifiedSymbol] = true
        this.cachedAt.set(item.id, item.cachedAt ?? now())
        items.push(item)
      } else {
        stale.push(item.id)
      }
    }

    this.app.repository.load(items.map(item => item.event))

    const relaysById = new Map<string, Set<string>>()

    for (const {id, relays} of items) {
      // Anything the repository rejected was superseded while we were loading.
      if (this.app.repository.getEvent(id)) {
        relaysById.set(id, new Set(relays))
      } else {
        stale.push(id)
      }
    }

    this.app.tracker.load(relaysById)

    if (stale.length > 0) {
      void table.bulkDelete(stale)
    }
  }

  private syncEvents = () => {
    const table = this.db.table<EventItem>("events")

    return on(
      this.app.repository,
      "update",
      batch(3000, async (updates: RepositoryUpdate[]) => {
        const add: TrustedEvent[] = []
        const remove = new Set<string>()

        for (const update of updates) {
          for (const event of update.added) {
            if (shouldPersistEvent(event, this.pubkey)) {
              add.push(event)
              remove.delete(event.id)
            }
          }

          for (const id of update.removed) {
            remove.add(id)
          }
        }

        if (add.length > 0) {
          const cachedAt = now()

          // The ingest policy tracks an event before publishing it, so the tracker already has its provenance.
          await table.bulkPut(
            add.map(event => {
              this.cachedAt.set(event.id, cachedAt)

              return {
                id: event.id,
                event,
                relays: Array.from(this.app.tracker.getRelays(event.id)),
                cachedAt,
              }
            }),
          )
        }

        if (remove.size > 0) {
          remove.forEach(id => this.cachedAt.delete(id))

          await table.bulkDelete(remove)
        }
      }),
    )
  }

  private syncTracker = () => {
    const table = this.db.table<EventItem>("events")

    const _onChange = async (ids: Iterable<string>) => {
      const items: EventItem[] = []

      for (const id of ids) {
        const event = this.app.repository.getEvent(id)

        // A brand-new event isn't queryable here, so syncEvents persists its provenance with the event.
        if (event && shouldPersistEvent(event, this.pubkey)) {
          items.push({
            id,
            event,
            relays: Array.from(this.app.tracker.getRelays(id)),
            cachedAt: this.cachedAt.get(id) ?? now(),
          })
        }
      }

      await table.bulkPut(items)
    }

    const onAdd = batch(3000, _onChange)
    const onRemove = batch(3000, _onChange)
    const onLoad = () => _onChange(this.app.tracker.relaysById.keys())

    this.app.tracker.on("add", onAdd)
    this.app.tracker.on("remove", onRemove)
    this.app.tracker.on("load", onLoad)

    return () => {
      this.app.tracker.off("add", onAdd)
      this.app.tracker.off("remove", onRemove)
      this.app.tracker.off("load", onLoad)
    }
  }

  private persistMapPlugin = async <T, Row>(
    name: string,
    plugin: MapPlugin<T>,
    fromRow: (row: Row) => Maybe<[string, T]>,
    toRow: (key: string, item: T) => Row,
  ) => {
    const table = this.db.table<Row>(name)

    for (const row of await table.getAll()) {
      const entry = fromRow(row)

      if (entry) {
        plugin.set(...entry)
      }
    }

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

  private initWrapManager = async () => {
    const table = this.db.table<WrapItem>("wrapManager")

    this.app.wrapManager.load(await table.getAll())

    const addOne = batch(3000, table.bulkPut)
    const removeOne = batch(3000, (items: WrapItem[]) =>
      table.bulkDelete(items.map(item => item.id)),
    )

    this.app.wrapManager.on("add", addOne)
    this.app.wrapManager.on("remove", removeOne)

    return () => {
      this.app.wrapManager.off("add", addOne)
      this.app.wrapManager.off("remove", removeOne)
    }
  }
}

// The current app's cache, which only exists once there's an identity to cache for.
export const storage = withGetter(writable<Maybe<Storage>>(undefined))

// Storage is scoped to one app's repository, tracker and caches, so it is built and torn down with it.
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

appPolicies.push(storagePolicy)
