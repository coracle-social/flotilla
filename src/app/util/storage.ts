import {on, throttle, fromPairs, batch, sortBy, concat} from "@welshman/lib"
import {throttled, freshness} from "@welshman/store"
import {
  PROFILE,
  FOLLOWS,
  MUTES,
  RELAYS,
  BLOSSOM_SERVERS,
  INBOX_RELAYS,
  ROOMS,
  APP_DATA,
  ALERT_STATUS,
  ALERT_EMAIL,
  ALERT_WEB,
  ALERT_IOS,
  ALERT_ANDROID,
  EVENT_TIME,
  THREAD,
  MESSAGE,
  DIRECT_MESSAGE,
  DIRECT_MESSAGE_FILE,
} from "@welshman/util"
import type {Zapper, TrustedEvent} from "@welshman/util"
import type {RepositoryUpdate} from "@welshman/relay"
import type {Handle, Relay} from "@welshman/app"
import {
  plaintext,
  tracker,
  relays,
  repository,
  handles,
  zappers,
  onZapper,
  onHandle,
} from "@welshman/app"
import {collectionStorageProvider} from "@lib/storage"

const syncEvents = async () => {
  repository.load(await collectionStorageProvider.get<TrustedEvent>("events"))

  const rankEvent = (event: TrustedEvent) => {
    switch (event.kind) {
      case PROFILE:
        return 1
      case FOLLOWS:
        return 1
      case MUTES:
        return 1
      case RELAYS:
        return 1
      case BLOSSOM_SERVERS:
        return 1
      case INBOX_RELAYS:
        return 1
      case ROOMS:
        return 1
      case APP_DATA:
        return 1
      case ALERT_STATUS:
        return 1
      case ALERT_EMAIL:
        return 1
      case ALERT_WEB:
        return 1
      case ALERT_IOS:
        return 1
      case ALERT_ANDROID:
        return 1
      case EVENT_TIME:
        return 0.9
      case THREAD:
        return 0.9
      case MESSAGE:
        return 0.9
      case DIRECT_MESSAGE:
        return 0.9
      case DIRECT_MESSAGE_FILE:
        return 0.9
      default:
        return 0
    }
  }

  return on(
    repository,
    "update",
    batch(3000, async (updates: RepositoryUpdate[]) => {
      let added: TrustedEvent[] = []
      const removed = new Set<string>()

      for (const update of updates) {
        for (const event of update.added) {
          if (rankEvent(event) > 0) {
            added.push(event)
            removed.delete(event.id)
          }
        }

        for (const id of update.removed) {
          added = added.filter(event => !update.removed.has(event.id))
          removed.add(id)
        }
      }

      if (added.length > 0) {
        let events = concat(await collectionStorageProvider.get<TrustedEvent>("events"), added)

        // If we're well above our retention limit, drop lowest-ranked events
        if (events.length > 15_000) {
          events = sortBy(e => -rankEvent(e), events).slice(10_000)
        }

        await collectionStorageProvider.set("events", events)
      }
    }),
  )
}

const syncTracker = async () => {
  const relaysById = new Map<string, Set<string>>()

  for (const [id, relays] of await collectionStorageProvider.get<[string, string[]]>("tracker")) {
    relaysById.set(id, new Set(relays))
  }

  tracker.load(relaysById)

  let p = Promise.resolve()

  const updateOne = batch(3000, (ids: string[]) => {
    p = p.then(() => {
      collectionStorageProvider.add(
        "tracker",
        ids.map(id => [id, Array.from(tracker.getRelays(id))]),
      )
    })
  })

  const updateAll = throttle(3000, () => {
    p = p.then(() => {
      collectionStorageProvider.set("tracker", Array.from(tracker.relaysById.entries()))
    })
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
  relays.set(await collectionStorageProvider.get<Relay>("relays"))

  return throttled(3000, relays).subscribe($relays => {
    collectionStorageProvider.set("relays", $relays)
  })
}

const syncHandles = async () => {
  handles.set(await collectionStorageProvider.get<Handle>("handles"))

  return onHandle(
    batch(3000, async $handles => {
      await collectionStorageProvider.add("handles", $handles)
    }),
  )
}

const syncZappers = async () => {
  zappers.set(await collectionStorageProvider.get<Zapper>("zappers"))

  return onZapper(
    batch(3000, async $zappers => {
      await collectionStorageProvider.add("zappers", $zappers)
    }),
  )
}

const syncFreshness = async () => {
  freshness.set(fromPairs(await collectionStorageProvider.get<[string, number]>("freshness")))

  return throttled(3000, freshness).subscribe($freshness => {
    collectionStorageProvider.set("freshness", Object.entries($freshness))
  })
}

const syncPlaintext = async () => {
  plaintext.set(fromPairs(await collectionStorageProvider.get<[string, string]>("plaintext")))

  return throttled(3000, plaintext).subscribe($plaintext => {
    collectionStorageProvider.set("plaintext", Object.entries($plaintext))
  })
}

export const syncDataStores = () =>
  Promise.all([
    syncEvents(),
    syncTracker(),
    syncRelays(),
    syncHandles(),
    syncZappers(),
    syncFreshness(),
    syncPlaintext(),
  ])
