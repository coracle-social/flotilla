---
name: welshman-store
description: "Use this skill when working with @welshman/store: where events live (the Repository interface, MemoryRepository, the SQLite worker store, the Tracker), live views derived from a repository, svelte-compatible stores (writable/readable/derived), synced stores, throttled stores, or getter/projection utilities."
---

# welshman/store — Event Storage and Reactive Stores

## Overview

`@welshman/store` owns where an app's events live and how the UI watches them. It depends only on `@welshman/lib` and `@welshman/util`; `@welshman/net` depends on it.

- **`Repository`** is the async interface every repository implements. `MemoryRepository` keeps events in memory; `SqliteRepository` keeps them in SQLite in a worker, so nothing is copied into memory at boot.
- **`Tracker`** records which relays each event was seen on. Each repository owns one (`repository.tracker`).
- **Derivations** (`deriveEventsById`, `deriveItemsByKey`, …) are live views over a repository.
- **Stores**: `writable`, `readable`, `derived` and `get` are a vendored copy of `svelte/store`. They satisfy the store contract, so `$store` works in Svelte components, and the package has no svelte dependency.

## Installation

```bash
pnpm add @welshman/store
# For the SQLite store in a browser:
pnpm add @sqlite.org/sqlite-wasm
```

## Repository

```typescript
interface Repository {
  tracker: Tracker
  ready: Promise<void>
  query(filters: Filter[], options?: QueryOptions): Promise<TrustedEvent[]>   // newest first
  count(filters: Filter[], options?: QueryOptions): Promise<number>
  countTags(name: string, options?: {signal?}): Promise<Map<string, number>> // value -> visible events carrying it
  getEvent(idOrAddress: string): Promise<TrustedEvent | undefined>
  isDeleted(event: TrustedEvent): boolean      // synchronous: it gates events arriving from relays
  publish(event: TrustedEvent): Promise<boolean> // whether a query would now return it
  removeEvent(idOrAddress: string): Promise<void>
  pendingWrites(): Promise<void> | undefined     // settles once writes made so far are reported; undefined if none are outstanding
  clear(): Promise<void>
  observe(options: ObserveOptions): Unsubscriber // {filters, onUpdate, onLoad?, onError?, includeDeleted?, relay?}: the read, then each change
  on("update", (update: RepositoryUpdate) => void) // {added: TrustedEvent[], removed: Set<string>}
  on("clear", () => void)
}

type QueryOptions = {
  includeDeleted?: boolean
  includeExpired?: boolean
  relay?: string   // only events the tracker has seen on this relay, applied before `limit`
  signal?: AbortSignal // rejects the query if it aborts before the repository answers
}
```

Both stores apply the same semantics:

- A newer replaceable event supersedes the version it replaces. The old version is reported `removed` and stays reachable only by id. Removing the newer version restores it.
- A NIP-09 delete hides its targets from their author. By id, the delete applies regardless of time. By address, it applies only to versions older than the delete. Removing the delete restores the targets.
- An expired event (`expiration` tag) is hidden.
- Every write that changes what a query returns emits one `update`. Anything stored that was already deleted, expired or superseded is reported as `removed`, not `added`.

### MemoryRepository

The in-memory store. It is the default in `@welshman/app` and right for tests, servers and short sessions. Besides the async interface it has `querySync`, `getEventSync`, `publishSync`, `removeEventSync`, `load(events)` and `dump()`.

### SqliteRepository

```typescript
import {SqliteRepository, connectSqlite} from "@welshman/store"
import SqliteWorker from "@welshman/store/sqlite-worker?worker" // Vite; other bundlers differ

const repository = new SqliteRepository({
  connection: connectSqlite({name: `events-${pubkey}`, createWorker: () => new SqliteWorker()}),
})

await repository.ready

// On logout or account switch: send pending writes, then free the database for another tab
await repository.close()
```

- **Worker.** `@welshman/store/sqlite-worker` opens the database in OPFS with a sqlite-wasm SAH pool of its own. That needs no cross-origin isolation, but it only runs in a dedicated worker and holds the database exclusively. Each database gets its own pool, so different databases open side by side.
- **Leader election.** `connectSqlite` returns a `SqliteConnection` (`call`, `subscribe`, `close`) and elects one tab with a web lock to run the worker. The other tabs send their calls over a `BroadcastChannel`, and every answer comes back through the leader in commit order. `subscribe` hears the changes other tabs commit in that order, which is how each tab's repository reports every tab's writes as `update` events and keeps its tracker and `isDeleted` current with them. When the leader closes, the next tab takes over and runs the calls left unanswered, so a write the old leader committed but never answered reports nothing new.
- **Write batching.** Writes collect for `batchDelay` ms (default 10) and commit as one transaction. A read sends any waiting writes first, so it sees them. The batch's `update` fires after the commit.
- **Synchronous state.** The tracker fills from every query result, from every event a write reports, from another tab's writes, and from `tracker.track` calls, and the repository persists the last of these. Reading provenance back emits no `"add"`, since nothing new was seen. `isDeleted` reads a mirror of the delete table, loaded at `ready` and kept current by each write, this tab's or another's.
- **Storage housekeeping.** It keeps one superseded version per address and deletes older ones. On open, `prune()` drops expired events and relay rows that no longer point at an event, and every open tab hears what that changed. Dropping a current version, by `prune()` or `evict()`, drops the version it kept back too.
- **SQLite-only methods.** `evict(filters)` drops matching events outright, with nothing restored in their place; use it for retention. `close()` sends pending writes, then closes the connection.
- **Signatures.** An event read back is marked verified only if it was verified before it was stored.
- **Memory.** Only reads pass through memory, but a subscribed derivation holds everything its filters match. `@welshman/app` collections stay subscribed, so each one's kinds end up in memory after first use.
- **App tables.** An app serves its own worker with `serveSqlite(extend)` from `@welshman/store/sqlite-serve`. `extend(db, engine)` runs after the engine's migrations, creates the app's tables, and returns synchronous methods served beside the engine's (which they can't shadow). Type the client with `connectSqlite<Methods>(...)` and call through `repository.call(method, ...args)`, which flushes pending writes first. Keep rows keyed by event id in step with an `AFTER DELETE ON events` trigger.
- **The engine.** `SqliteEngine` holds the logic and runs over any synchronous `SqliteDatabase` (`exec`/`run`/`all`/`define`): `wasmDatabase(db)` in the worker, `node:sqlite` in tests. `search` filters match like `matchFilter`: content lowercased in any script, containing the first term.

## Derivations

Every derivation takes `repository` and returns a `Projection`, a store plus a `get()`.

- **Async seeding.** Reads are async, so a view seeds itself with a query when first subscribed and then follows `update` events. It holds what it last held until the query answers.
- **Updates win over the seed.** An update that arrives while the query is in flight takes precedence over the query's result, so a stale answer can't undo it.
- **`get()`** returns the current value: live while subscribed, otherwise the last value seen.
- **`load()`.** The event views return `AsyncProjection<T>`, which adds `load(): Promise<T>` for a fresh read. Use it in callbacks that need the repository's current state, not whatever the view last held.

| Export | Returns |
|---|---|
| `deriveEventsById({repository, filters, includeDeleted?})` | `AsyncProjection<Map<id, TrustedEvent>>` |
| `deriveEvents(options)` | `AsyncProjection<TrustedEvent[]>` |
| `deriveEventsArray(byId)` | `AsyncProjection<TrustedEvent[]>` from an `AsyncProjection` by id |
| `deriveEventsAsc(byId)` / `deriveEventsDesc(byId)` | sorted `AsyncProjection<TrustedEvent[]>` |
| `makeDeriveEvent({repository, includeDeleted?, onDerive?})` | `(idOrAddress, ...args) => AsyncProjection<TrustedEvent \| undefined>` |
| `deriveIsDeleted(repository, event)` | `Projection<boolean>` (synchronous, via `isDeleted`) |
| `deriveEventsByIdByUrl(options)` | `AsyncProjection<Map<url, Map<id, TrustedEvent>>>`, keyed by the tracker |
| `deriveEventsByIdForUrl({...options, url})` | `AsyncProjection<Map<id, TrustedEvent>>` for one relay; queries with `relay: url` |
| `getEventsById` / `getEventsByIdByUrl` / `getEventsByIdForUrl` | the async one-shot reads behind `load()` |
| `observeEventsById({repository, filters, includeDeleted?, onEvents})` | `Unsubscriber`; calls `onEvents` by id once the read answers, then on each change |

### Indexed collections

`deriveItemsByKey({repository, filters, eventToItem, getKey, includeDeleted?})` maps events to items keyed by `getKey`. It returns an `ItemCollection<T>`: a `Projection<Map<string, T>>` plus `read(key)`, which waits for the repository's pending writes, then the seeding query and any outstanding async parses, before answering. `deriveItemsByKeyByUrl` keys each item once per relay its event was seen on (`getKey(item, url)`, `undefined` to exclude), re-keying parsed items when the tracker sees a new relay and rebuilding when `revalidateOn` changes.

The package also exports `makeDeriveItem`, `makeLoadItem` (timeout in seconds, exponential backoff per source), `makeForceLoadItem`, `deriveItems` and `deriveItemsSorted`.

## Stores, persistence and getters

| Export | Description |
|---|---|
| `writable`, `readable`, `derived`, `get`, `readonly` | svelte/store, vendored. Types `Readable`, `Writable`, `Subscriber`, `Unsubscriber`, `Updater`, `StartStopNotifier`, `Stores`, `StoresValues` |
| `synced(config)` / `sync(config)` / `localStorageProvider` | stores persisted to a `StorageProvider`; `await store.ready` before trusting the value |
| `throttled(delay, store)` | notifies at most once per `delay` ms; `0` returns the store as is |
| `getter(store, {threshold?, read?})` | an accessor that holds a subscription once called more than `threshold` times a second |
| `withGetter(store)` | adds `.get()` while keeping the store's own members |
| `projection($, read?)` / `projectFrom(src, read)` | build a `Projection` |
| `projectAsync(src, read)` | derive an `AsyncProjection` whose `load()` reads `src` fresh |
| `memoized`, `deriveDeduplicated`, `deriveDeduplicatedByValue`, `merged` | derivation helpers |

## Example

```typescript
import {MemoryRepository, deriveEventsById, deriveEventsDesc} from "@welshman/store"

const repository = new MemoryRepository()
const notes = deriveEventsDesc(deriveEventsById({repository, filters: [{kinds: [1], limit: 100}]}))

notes.subscribe($notes => console.log(`${$notes.length} notes`)) // [] first, then the query's answer

await repository.publish(note) // the view updates from the repository's `update` event
```

## Gotchas

- **Don't build a new view each time a store's inputs change.** A new view starts empty, so the store blanks until its read answers. Build the store on `observeEventsById`, which calls back only once the read has answered.
- **Don't read a derived view's `get()` cold and expect the repository's contents.** An unsubscribed view knows only what it held last. Await `load()`, `read(key)`, or `repository.query` instead.
- **Provenance comes before the event.** Call `repository.tracker.track(id, url)` before `publish`, so per-relay views key the event when its `update` arrives. The app's ingest policy and `WrapManager` already do this.
- **The tracker only covers events this repository has seen.** That includes everything returned by a query or reported by a write, and everything another tab wrote while it was open, but not events sitting in SQLite that nothing has read. Read an event through the repository before asking the tracker where it was seen.
- **`isDeleted` is synchronous by design.** `@welshman/net`'s `request` calls it on every incoming event.
- **Within one `update`, removals can name ids the view never held.** Deleting from a map is cheap, so handlers don't filter them out first.
