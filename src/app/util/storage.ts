import {prop, call, on, throttle, fromPairs, batch} from "@welshman/lib"
import {throttled, freshness} from "@welshman/store"
import {
  ALERT_ANDROID,
  ALERT_EMAIL,
  ALERT_IOS,
  ALERT_STATUS,
  ALERT_WEB,
  APP_DATA,
  BLOSSOM_SERVERS,
  DIRECT_MESSAGE_FILE,
  DIRECT_MESSAGE,
  EVENT_TIME,
  FOLLOWS,
  INBOX_RELAYS,
  MESSAGE,
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
  ROOM_META,
  ROOM_REMOVE_MEMBER,
  ROOMS,
  THREAD,
  ZAP_GOAL,
  verifiedSymbol,
} from "@welshman/util"
import type {Zapper, TrustedEvent, RelayProfile} from "@welshman/util"
import type {RepositoryUpdate, WrapItem} from "@welshman/net"
import type {Handle, RelayStats} from "@welshman/app"
import {
  plaintext,
  tracker,
  relays,
  relayStats,
  repository,
  handles,
  zappers,
  onZapper,
  onHandle,
  wrapManager,
} from "@welshman/app"
import {Collection} from "@lib/storage"

const syncEvents = async () => {
  const collection = new Collection<TrustedEvent>({table: "events", getId: prop("id")})

  const initialEvents = await collection.get()

  // Mark events verified to avoid re-verification of signatures
  for (const event of initialEvents) {
    event[verifiedSymbol] = true
  }

  repository.load(initialEvents)

  const metaKinds = [
    PROFILE,
    FOLLOWS,
    MUTES,
    RELAYS,
    BLOSSOM_SERVERS,
    INBOX_RELAYS,
    APP_DATA,
    ROOMS,
  ]
  const alertKinds = [ALERT_STATUS, ALERT_EMAIL, ALERT_WEB, ALERT_IOS, ALERT_ANDROID]
  const spaceKinds = [RELAY_ADD_MEMBER, RELAY_REMOVE_MEMBER, RELAY_MEMBERS, RELAY_JOIN, RELAY_LEAVE]
  const roomKinds = [
    ROOM_META,
    ROOM_MEMBERS,
    ROOM_ADD_MEMBER,
    ROOM_REMOVE_MEMBER,
    ROOM_CREATE_PERMISSION,
  ]
  const contentKinds = [EVENT_TIME, THREAD, MESSAGE, ZAP_GOAL, DIRECT_MESSAGE, DIRECT_MESSAGE_FILE]

  const rankEvent = (event: TrustedEvent) => {
    if (metaKinds.includes(event.kind)) return 9
    if (alertKinds.includes(event.kind)) return 8
    if (spaceKinds.includes(event.kind)) return 7
    if (roomKinds.includes(event.kind)) return 6
    if (contentKinds.includes(event.kind)) return 5
    return 0
  }

  return on(
    repository,
    "update",
    batch(3000, async (updates: RepositoryUpdate[]) => {
      const add: TrustedEvent[] = []
      const remove = new Set<string>()

      for (const update of updates) {
        for (const event of update.added) {
          if (rankEvent(event) > 0) {
            add.push(event)
            remove.delete(event.id)
          }
        }

        for (const id of update.removed) {
          remove.add(id)
        }
      }

      await collection.update({add, remove})
    }),
  )
}

type TrackerItem = [string, string[]]

const syncTracker = async () => {
  const collection = new Collection<TrackerItem>({
    table: "tracker",
    getId: (item: TrackerItem) => item[0],
  })

  const relaysById = new Map<string, Set<string>>()

  for (const [id, relays] of await collection.get()) {
    relaysById.set(id, new Set(relays))
  }

  tracker.load(relaysById)

  const updateOne = batch(3000, (ids: string[]) => {
    collection.add(ids.map(id => [id, Array.from(tracker.getRelays(id))]))
  })

  const updateAll = throttle(3000, () => {
    collection.set(
      Array.from(tracker.relaysById.entries()).map(([id, relays]) => [id, Array.from(relays)]),
    )
  })

  tracker.on("add", updateOne)
  tracker.on("remove", updateOne)
  tracker.on("load", updateAll)
  tracker.on("clear", updateAll)

  return () => {
    tracker.off("add", updateOne)
    tracker.off("remove", updateOne)
    tracker.off("load", updateAll)
    tracker.off("clear", updateAll)
  }
}

const syncRelays = async () => {
  const collection = new Collection<RelayProfile>({table: "relays", getId: prop("url")})

  relays.set(await collection.get())

  return throttled(3000, relays).subscribe(collection.set)
}

const syncRelayStats = async () => {
  const collection = new Collection<RelayStats>({table: "relayStats", getId: prop("url")})

  relayStats.set(await collection.get())

  return throttled(3000, relayStats).subscribe(collection.set)
}

const syncHandles = async () => {
  const collection = new Collection<Handle>({table: "handles", getId: prop("nip05")})

  handles.set(await collection.get())

  return onHandle(batch(3000, collection.add))
}

const syncZappers = async () => {
  const collection = new Collection<Zapper>({table: "zappers", getId: prop("lnurl")})

  zappers.set(await collection.get())

  return onZapper(batch(3000, collection.add))
}

type FreshnessItem = [string, number]

const syncFreshness = async () => {
  const collection = new Collection<FreshnessItem>({
    table: "freshness",
    getId: (item: FreshnessItem) => item[0],
  })

  freshness.set(fromPairs(await collection.get()))

  return throttled(3000, freshness).subscribe($freshness => {
    collection.set(Object.entries($freshness))
  })
}

type PlaintextItem = [string, string]

const syncPlaintext = async () => {
  const collection = new Collection<PlaintextItem>({
    table: "plaintext",
    getId: (item: PlaintextItem) => item[0],
  })

  plaintext.set(fromPairs(await collection.get()))

  return throttled(3000, plaintext).subscribe($plaintext => {
    collection.set(Object.entries($plaintext))
  })
}

const syncWrapManager = async () => {
  const collection = new Collection<WrapItem>({table: "wraps", getId: prop("id")})

  wrapManager.load(await collection.get())

  const addOne = batch(3000, (wrapItems: WrapItem[]) => collection.add(wrapItems))

  const updateAll = throttle(3000, () => collection.set(wrapManager.dump()))

  wrapManager.on("add", addOne)
  wrapManager.on("remove", updateAll)

  return () => {
    wrapManager.off("add", addOne)
    wrapManager.off("remove", updateAll)
  }
}

export const syncDataStores = async () => {
  const unsubscribers = await Promise.all([
    syncEvents(),
    syncTracker(),
    syncRelays(),
    syncRelayStats(),
    syncHandles(),
    syncZappers(),
    syncFreshness(),
    syncPlaintext(),
    syncWrapManager(),
  ])

  return () => unsubscribers.forEach(call)
}
