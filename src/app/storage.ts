import {writable} from "svelte/store"
import type {Unsubscriber} from "svelte/store"
import {deleteDB} from "idb"
import {SecureStorage} from "@aparajita/capacitor-secure-storage"
import {Capacitor, registerPlugin} from "@capacitor/core"
import {Preferences} from "@capacitor/preferences"
import {WEEK, ago, noop, now, on, throttle, batch, call, makeQueue} from "@welshman/lib"
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
  FOLLOWS,
  MESSAGING_RELAYS,
  MUTES,
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
  hexTags,
  isSignedEvent,
  tagValues,
  verifiedSymbol,
} from "@welshman/util"
import type {Handle, TrustedEvent} from "@welshman/util"
import {withGetter} from "@welshman/store"
import type {RepositoryUpdate, WrapItem} from "@welshman/net"
import {Relay, Zapper} from "@welshman/domain"
import type {RelayInfo, ZapperValues} from "@welshman/domain"
import {Handles, Plaintext, Relays, RelayStats, User, Zappers} from "@welshman/app"
import type {AppPolicy, IApp, RelayStatsItem} from "@welshman/app"
import {IDB} from "@lib/indexeddb"
import {appPolicies} from "@app/core"
import {DM_KINDS} from "@app/content"

export const kv = call(() => {
  const enqueue = makeQueue()

  const get = async <T>(key: string): Promise<T | undefined> => {
    const result = await Preferences.get({key})
    if (!result.value) {
      return undefined
    }
    try {
      return JSON.parse(result.value)
    } catch (e) {
      return undefined
    }
  }

  const set = async <T>(key: string, value: T): Promise<void> => {
    await enqueue(() => Preferences.set({key, value: JSON.stringify(value)}))
  }

  const clear = async () => {
    await enqueue(() => Preferences.clear())
  }

  return {get, set, clear}
})

const secretStorage =
  Capacitor.getPlatform() === "electron"
    ? call(() => {
        const plugin = registerPlugin<{
          get(options: {key: string}): Promise<{value?: string}>
          set(options: {key: string; value: string}): Promise<void>
          remove(options: {key: string}): Promise<void>
          clear(): Promise<void>
        }>("DesktopSecureStorage")

        return {
          get: async (key: string) => (await plugin.get({key})).value,
          set: (key: string, value: string | undefined) =>
            value === undefined ? plugin.remove({key}) : plugin.set({key, value}),
          clear: () => plugin.clear(),
        }
      })
    : {
        get: async (key: string) => {
          let value = await SecureStorage.getItem(key)

          if (!value) {
            const legacy = await Preferences.get({key})

            if (legacy.value) {
              value = legacy.value
              await SecureStorage.setItem(key, legacy.value)
              await Preferences.remove({key})
            }
          }

          return value
        },
        // Android's SecureStorage rejects undefined
        set: (key: string, value: string | undefined) =>
          value === undefined ? SecureStorage.removeItem(key) : SecureStorage.setItem(key, value),
        clear: () => SecureStorage.clear(),
      }

export const ss = call(() => {
  const enqueue = makeQueue()

  const get = async <T>(key: string): Promise<T | undefined> => {
    const value = await secretStorage.get(key)
    if (!value) {
      return undefined
    }

    try {
      return JSON.parse(value)
    } catch (e) {
      return undefined
    }
  }

  const set = async <T>(key: string, value: T): Promise<void> => {
    await enqueue(() => secretStorage.set(key, JSON.stringify(value)))
  }

  const clear = async () => {
    await enqueue(() => secretStorage.clear())
  }

  return {get, set, clear}
})

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
}

const isRelayScoped = (event: TrustedEvent) =>
  kinds.space.includes(event.kind) || kinds.room.includes(event.kind)

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
      isConversation(event)

type EventItem = {id: string; event: TrustedEvent; relays: string[]; cachedAt?: number}

// A command definition is only advisory, and a space's set drifts as bots come and go, so one
// we haven't seen republished in a week is dropped rather than offered as still available.
// Everything else is kept until it's superseded or deleted.
const isExpired = (item: EventItem) =>
  item.event.kind === COMMAND && (item.cachedAt ?? now()) < ago(1, WEEK)

type PlaintextItem = {key: string; value: string}

/**
 * Caches an app's repository, tracker and local collections in indexeddb. Everything stored
 * here belongs to a single identity, so each gets its own database, named for the pubkey the
 * policy below requires before it builds one.
 */
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
    void deleteDB("flotilla-9gl")

    this.pubkey = User.require(app).pubkey
    this.db = new IDB({name: `flotilla-9gl-${this.pubkey}`, stores: TABLES})
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

  /**
   * Each row holds an event together with the relays it came from, since a relay-scoped event
   * that lost its provenance can never be keyed to a space again — it sits in the repository
   * invisible, and negentropy reconciles it away as already-present, so it never comes back.
   * Drop those and let the next sync pull them down again.
   */
  private loadCriticalData = async () => {
    const table = this.db.table<EventItem>("events")
    const items: EventItem[] = []
    const stale: string[] = []

    for (const item of await table.getAll()) {
      // Rows written before provenance was stored inline hold a bare event
      if (
        item.event &&
        shouldPersistEvent(item.event, this.pubkey) &&
        (!isRelayScoped(item.event) || item.relays.length > 0) &&
        !isExpired(item)
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
      // Anything the repository rejected was superseded by an event that arrived before we
      // finished loading
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

          // The ingest policy tracks an event before publishing it, so by the time the
          // repository reports it, its provenance is already in the tracker
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

        // A brand-new event is tracked before it's published, so it isn't queryable here —
        // syncEvents persists its provenance along with the event itself. This pass only
        // records relay changes for events we already have.
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

  private initRelays = async () => {
    const table = this.db.table<RelayInfo & {url: string}>("relays")

    for (const row of await table.getAll()) {
      this.app.use(Relays).set(row.url, new Relay(row.url, row))
    }

    const enqueue = batch(
      FLUSH_INTERVAL,
      idleWrite((relays: Relay[]) => table.bulkPut(relays.map(relay => ({...relay})))),
    )

    return this.app.use(Relays).onItem((_url, relay) => {
      if (relay) {
        enqueue(relay)
      }
    })
  }

  private initRelayStats = async () => {
    const table = this.db.table<RelayStatsItem>("relayStats")

    for (const row of await table.getAll()) {
      this.app.use(RelayStats).set(row.url, row)
    }

    const enqueue = batch(FLUSH_INTERVAL, idleWrite(table.bulkPut))

    return this.app.use(RelayStats).onItem((_url, stats) => {
      if (stats) {
        enqueue(stats)
      }
    })
  }

  private initHandles = async () => {
    const table = this.db.table<Handle>("handles")

    for (const row of await table.getAll()) {
      this.app.use(Handles).set(row.nip05, row)
    }

    const enqueue = batch(FLUSH_INTERVAL, idleWrite(table.bulkPut))

    return this.app.use(Handles).onItem((_nip05, handle) => {
      if (handle) {
        enqueue(handle)
      }
    })
  }

  private initZappers = async () => {
    const table = this.db.table<ZapperValues>("zappers")

    for (const row of await table.getAll()) {
      // Validation is meaningless without these, and rows cached before they were required
      // won't have them.
      if (row.pubkey && row.nostrPubkey) {
        this.app.use(Zappers).set(row.lnurl, new Zapper(row))
      }
    }

    const enqueue = batch(
      FLUSH_INTERVAL,
      idleWrite((zappers: Zapper[]) => table.bulkPut(zappers.map(zapper => ({...zapper})))),
    )

    return this.app.use(Zappers).onItem((_lnurl, zapper) => {
      if (zapper) {
        enqueue(zapper)
      }
    })
  }

  private initPlaintext = async () => {
    const table = this.db.table<PlaintextItem>("plaintext")

    for (const {key, value} of await table.getAll()) {
      this.app.use(Plaintext).set(key, value)
    }

    const enqueue = batch(FLUSH_INTERVAL, idleWrite(table.bulkPut))

    return this.app.use(Plaintext).onItem((key, value) => {
      if (value) {
        enqueue({key, value})
      }
    })
  }

  private initWrapManager = async () => {
    const table = this.db.table<WrapItem>("wrapManager")

    this.app.wrapManager.load(await table.getAll())

    const addOne = batch(3000, table.bulkPut)
    const removeOne = throttle(3000, table.bulkDelete)

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

// Storage is scoped to one app's repository, tracker and caches, so it's built and torn down
// with the app rather than living on as a module-level singleton.
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
