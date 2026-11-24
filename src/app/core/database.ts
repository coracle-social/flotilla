import {DAY, MONTH, ago, int, isDefined, max, now} from "@welshman/lib"
import {
  BLOSSOM_SERVERS,
  FOLLOWS,
  MESSAGING_RELAYS,
  MUTES,
  PROFILE,
  RELAYS,
  isReplaceable,
} from "@welshman/util"
import type {TrustedEvent} from "@welshman/util"
import {
  MemoryRepository,
  MultiplexRepository,
  SqliteRepository,
  connectSqlite,
  makeMultiplexDispatch,
} from "@welshman/store"
import type {Repository, RepositoryUpdate} from "@welshman/store"
import {WrapManager} from "@welshman/net"
import type {WrapItem} from "@welshman/net"
import DatabaseWorker from "@app/core/database.worker?worker"
import type {extend} from "@app/core/database.worker"
import type {Retention} from "@app/core/database.retention"

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
      // A rule without a deadline keeps what it matches for good
      keepUntil: deadlines.every(isDefined) ? max(deadlines) : undefined,
      provenance: matching.every(rule => rule.provenance),
    }
  }

  return release(event.id)
}

// Whether a rule keeps the event past now, which is what earns it a place in sqlite
const isKept = (event: TrustedEvent, pubkey: string) => {
  const matching = rules.filter(rule => rule.match(event, pubkey))

  return matching.some(rule => {
    const deadline = getDeadline(rule, event, pubkey)

    return !deadline || deadline > now()
  })
}

// Every version of an address must reach the same child, so sqlite takes every replaceable
const isStored = (event: TrustedEvent, pubkey: string) =>
  isReplaceable(event) || isKept(event, pubkey)

type DatabaseMethods = ReturnType<typeof extend>

const onRetainError = (error: unknown) => console.error("Failed to record what to keep", error)

const onWrapsError = (error: unknown) => console.error("Failed to store the wrap index", error)

// The app only holds the repository, so logout finds the database through it
const databases = new WeakMap<Repository, EventDatabase>()

/** One identity's events in sqlite, with the tables flotilla keeps beside them. */
export class EventDatabase {
  // Asked for its index before the app is built, or the app unwraps every stored wrap again
  wrapManager: WrapManager

  private constructor(
    readonly pubkey: string,
    readonly repository: Repository,
    readonly sqlite: SqliteRepository<DatabaseMethods>,
  ) {
    this.wrapManager = new WrapManager({repository})

    sqlite.on("update", this.retain)
  }

  static open = async (pubkey: string) => {
    const connection = connectSqlite<DatabaseMethods>({
      name: `flotilla-${pubkey}`,
      createWorker: () => new DatabaseWorker(),
    })
    const repository = await MultiplexRepository.open({
      children: {
        sqlite: options => SqliteRepository.open({...options, connection}),
        memory: options => new MemoryRepository(options),
      },
      dispatch: makeMultiplexDispatch((event, {sqlite, memory}) =>
        isStored(event, pubkey) ? sqlite : memory,
      ),
    })
    const {sqlite} = repository.repositories
    const database = new EventDatabase(pubkey, repository, sqlite)

    databases.set(repository, database)

    return database
  }

  static of = (repository: Repository) => databases.get(repository)

  // The features that own the rules register them here, so the worker can't judge an event
  // itself. A changed copy is judged again, and whatever was deleted, superseded or expired goes.
  private retain = ({added, removed}: RepositoryUpdate) => {
    const retentions = [
      ...added.map(event => getRetention(event, this.pubkey)),
      ...Array.from(removed, release),
    ]

    if (retentions.length > 0) {
      this.sqlite.call("retain", retentions).catch(onRetainError)
    }
  }

  // Nothing cached in the last day goes, since another tab may be showing it.
  sweep = async () => {
    // Each step holds the worker, so it waits for a quiet spell rather than delaying what's on screen
    await this.sqlite.call("idle")
    await this.sqlite.prune()
    await this.sqlite.call("idle")

    const ids = await this.sqlite.call("getEvictable", ago(1, DAY))

    if (ids.length > 0) {
      await this.sqlite.call("idle")
      await this.sqlite.evict([{ids}])
    }
  }

  // Read the wrap index back, and keep its table in step from then on.
  restoreWraps = async () => {
    const wraps = await this.sqlite.call("getWraps")

    this.wrapManager.load(wraps)
    this.wrapManager.on("add", this.putWrap)
    this.wrapManager.on("remove", this.deleteWrap)
  }

  // The file goes rather than its rows, so a damaged image doesn't outlive a logout.
  reset = async () => {
    this.wrapManager.off("add", this.putWrap)
    this.wrapManager.off("remove", this.deleteWrap)

    await this.sqlite.call("wipe")
  }

  // Releasing the lock lets another tab lead the database, or this one open it again
  close = () => this.sqlite.close()

  private putWrap = (item: WrapItem) => {
    this.sqlite.call("putWraps", [item]).catch(onWrapsError)
  }

  private deleteWrap = (item: WrapItem) => {
    this.sqlite.call("deleteWraps", [item.id]).catch(onWrapsError)
  }
}
