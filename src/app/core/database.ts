import {DAY, MONTH, ago, int, max, now} from "@welshman/lib"
import {BLOSSOM_SERVERS, FOLLOWS, MESSAGING_RELAYS, MUTES, PROFILE, RELAYS} from "@welshman/util"
import type {TrustedEvent} from "@welshman/util"
import {SqliteRepository, connectSqlite} from "@welshman/store"
import type {RepositoryUpdate} from "@welshman/store"
import {WrapManager} from "@welshman/net"
import type {WrapItem} from "@welshman/net"
import DatabaseWorker from "@app/core/database.worker?worker"
import type {Retention, extend} from "@app/core/database.worker"

// A ttl bounds an event by how long ago it was cached, and a maxAge by its own age.
type RetentionRule = {
  match: (event: TrustedEvent, pubkey: string) => boolean
  maxAge?: number
  ttl?: number
  // Anything the app reads through a relay is useless without the provenance keying it to one.
  provenance?: boolean
}

// Profiles and the lists every part of the app reads; everything else is registered by its owner.
const rules: RetentionRule[] = [
  {
    match: event =>
      [PROFILE, FOLLOWS, MUTES, RELAYS, BLOSSOM_SERVERS, MESSAGING_RELAYS].includes(event.kind),
    ttl: int(1, MONTH),
  },
]

export const registerRetention = (rule: RetentionRule) => {
  rules.push(rule)
}

// The user's own events are state rather than cache, so no ttl expires them.
const getDeadline = ({maxAge, ttl}: RetentionRule, event: TrustedEvent, pubkey: string) => {
  const deadlines: number[] = []

  if (maxAge) {
    deadlines.push(event.created_at + maxAge)
  }

  if (ttl && event.pubkey !== pubkey) {
    deadlines.push(now() + ttl)
  }

  return deadlines.length > 0 ? Math.min(...deadlines) : undefined
}

// Kept no longer than the next sweep
const release = (id: string): Retention => ({id, keepUntil: now(), provenance: false})

// The longest any rule keeps the event, and provenance only if every rule keeping it needs it.
const getRetention = (event: TrustedEvent, pubkey: string): Retention => {
  const matching = rules.filter(rule => rule.match(event, pubkey))
  const deadlines = matching.map(rule => getDeadline(rule, event, pubkey))

  if (matching.length > 0) {
    return {
      id: event.id,
      keepUntil: deadlines.includes(undefined) ? undefined : max(deadlines),
      provenance: matching.every(rule => rule.provenance),
    }
  }

  return release(event.id)
}

type DatabaseMethods = ReturnType<typeof extend>

const onRetainError = (error: unknown) => console.error("Failed to record what to keep", error)

const onWrapsError = (error: unknown) => console.error("Failed to store the wrap index", error)

/** One identity's events in sqlite, with the tables flotilla keeps beside them. */
export class EventDatabase extends SqliteRepository<DatabaseMethods> {
  // Restored before the app is built, or the app unwraps every stored wrap again
  wrapManager = new WrapManager({repository: this})

  constructor(readonly pubkey: string) {
    const name = `flotilla-${pubkey}`

    super({
      connection: connectSqlite<DatabaseMethods>({name, createWorker: () => new DatabaseWorker()}),
    })

    this.on("update", this.retain)
  }

  // The features that own the rules register them here, so the worker can't judge an event
  // itself. A changed copy is judged again, and whatever was deleted, superseded or expired goes.
  private retain = ({added, removed}: RepositoryUpdate) => {
    const retentions = [
      ...added.map(event => getRetention(event, this.pubkey)),
      ...Array.from(removed, release),
    ]

    if (retentions.length > 0) {
      this.call("retain", retentions).catch(onRetainError)
    }
  }

  // Nothing cached in the last day goes, since another tab may be showing it.
  sweep = async () => {
    const ids = await this.call("getEvictable", ago(1, DAY))

    if (ids.length > 0) {
      await this.evict([{ids}])
    }
  }

  // Read the wrap index back, and keep its table in step from then on.
  restoreWraps = async () => {
    const wraps = await this.call("getWraps")

    this.wrapManager.load(wraps)
    this.wrapManager.on("add", this.putWrap)
    this.wrapManager.on("remove", this.deleteWrap)
  }

  // A wrap indexed after the clear would name a rumor that's gone, so the index stops first.
  reset = async () => {
    this.wrapManager.off("add", this.putWrap)
    this.wrapManager.off("remove", this.deleteWrap)

    await this.clear()
    await this.call("clearWraps")
  }

  private putWrap = (item: WrapItem) => {
    this.call("putWraps", [item]).catch(onWrapsError)
  }

  private deleteWrap = (item: WrapItem) => {
    this.call("deleteWraps", [item.id]).catch(onWrapsError)
  }
}
