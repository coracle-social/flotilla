---
name: welshman-store
description: "Use this skill when working with @welshman/store: Repository pattern for nostr events, synced Svelte stores, throttled stores, or getter/derived store utilities."
---

# welshman/store — Svelte Store Utilities

## Overview

`@welshman/store` provides reactive Svelte store primitives for nostr. It derives live-updating collections of events or domain objects (profiles, lists, etc.) from the `Repository` event cache in `@welshman/net`. It also provides persistence via `synced`, throttling via `throttled`, and synchronous access via `withGetter`/`getter`.

## Installation

```bash
npm install @welshman/store
# or
pnpm add @welshman/store
yarn add @welshman/store
```

## Key Exports

### Event stores (from Repository)

Each is a `Projection` — a store, plus a `get()` whose cheap read is the matching one-shot query — so a caller passes neither half itself.

| Export | Description |
|---|---|
| `deriveEventsById(options)` | `Projection<Map<string, TrustedEvent>>` — live map of events matching `filters` |
| `deriveEvents(options)` | `Projection<TrustedEvent[]>` — calls `deriveEventsById` internally and converts to array |
| `deriveEventsAsc(eventsById)` | Takes a `Projection<Map<string, TrustedEvent>>` and returns events sorted ascending by `created_at` |
| `deriveEventsDesc(eventsById)` | Takes a `Projection<Map<string, TrustedEvent>>` and returns events sorted descending by `created_at` |
| `makeDeriveEvent(options)` | Factory returning `(idOrAddress: string, ...args) => Projection<TrustedEvent \| undefined>` for single-event lookups; calls `onDerive(filters, ...args)` first |
| `deriveIsDeleted(repository, event)` | `Projection<boolean>` — tracks deletion status of an event |
| `deriveArray(itemsById)` | Turns any `Projection<Map<string, T>>` into `Projection<T[]>` |
| `getEventsById(options)` | The one-shot query `deriveEventsById` reads through |

### Relay-scoped event stores

These key events by the relays a `Tracker` has seen them on. They keep the same event or addressable coordinate distinct per relay, as NIP-29 rooms, relay membership and per-relay replaceables require.

| Export | Description |
|---|---|
| `deriveEventsByIdByUrl(options)` | `Projection<Map<url, Map<id, TrustedEvent>>>` — every relay at once |
| `deriveEventsByIdForUrl(options)` | `Projection<Map<id, TrustedEvent>>` — one relay |
| `getEventsByIdByUrl` / `getEventsByIdForUrl` | The one-shot queries they read through |
| `deriveItemsByKeyByUrl<T>(options)` | The relay-scoped `deriveItemsByKey`: an event is keyed once per relay via `getKey(item, url)` |

`getEventsByIdForUrl` queries the filters with the tracker as a `where` constraint, so its cost tracks what the caller asked for rather than how much that relay has cached, and a `limit` counts only that relay's events.

The index outlives a subscription, so subscribing keys only the events the collection has not keyed. A `revalidateOn` change and a `tracker` load re-key everything. Either one emits once rather than once per event, and an event no url keys emits nothing, so a subscriber is woken only by a change.

Both relay-scoped option types extend `EventsByIdOptions` with `tracker: Tracker` (and `url: string` for the `ForUrl` variants). `ItemsByKeyByUrlOptions` adds two things over `ItemsByKeyOptions`:

```typescript
{
  getKey: (item: T, url: string) => string | undefined  // undefined excludes the item on that relay
  revalidateOn?: Readable<unknown>   // rebuild every key when this changes (after its first value)
}
```

`deriveEventsById` / `deriveEvents` options (`EventsByIdOptions`):
```typescript
{
  repository: Repository
  filters: Filter[]
  includeDeleted?: boolean  // default: false
}
```

`makeDeriveEvent` options (`EventOptions`):
```typescript
{
  repository: Repository
  includeDeleted?: boolean       // default: false
  onDerive?: (filters: Filter[], ...args: any[]) => void
}
```

Usage of `makeDeriveEvent`:
```typescript
const deriveEvent = makeDeriveEvent({ repository })
const eventStore = deriveEvent(someIdOrAddress) // Readable<TrustedEvent | undefined>
```

### Indexed collections

| Export | Description |
|---|---|
| `deriveItemsByKey<T>(options)` | Maps events to domain objects, indexed by a string key; an `ItemCollection<T>`, which is a `Projection<Map<string, T>>` plus a `read(key)` that waits out the parses the index has outstanding |
| `deriveItems<T>(itemsByKey)` | Converts the map to `Readable<T[]>` |
| `deriveItemsSorted<T>(sortFn, itemsStore)` | Sorts a `Readable<T[]>` by a numeric sort-value function `(item: T) => number`; returns `Readable<T[]>` |
| `makeDeriveItem<T>(itemsByKey, onDerive?)` | Returns a factory `(key?, ...args) => Readable<T \| undefined>` for per-key reactive lookups; calls `onDerive(key, ...args)` and ignores its rejection |
| `makeLoadItem<T>(loadItem, getItem, options?)` | Cached async loader with staleness checks and exponential backoff |
| `makeForceLoadItem<T>(loadItem, getItem)` | Async loader that always fetches fresh data |

`makeLoadItem` options (`MakeLoadItemOptions`):
```typescript
{
  timeout?: number     // staleness window in SECONDS (default 3600)
  maxSize?: number     // LRU size for the fetched/attempt caches (default 10_000)
  getFetched?: (key: string) => number          // override where "last fetched" is stored
  setFetched?: (key: string, ts: number) => void
  getSource?: (...args: any[]) => string        // how extra args key the backoff and dedup (default JSON.stringify)
}
```

`deriveItemsByKey` options:
```typescript
{
  repository: Repository
  filters: Filter[]
  eventToItem: (event: TrustedEvent) => MaybeAsync<Maybe<T>>
  getKey: (item: T) => string
  includeDeleted?: boolean
}
```

### Persistence

| Export | Description |
|---|---|
| `synced(config)` | Writable store that auto-persists to a `StorageProvider`; exposes a `.ready` promise (type `Synced<T>`) |
| `sync(config)` | The lower-level primitive: binds an existing store to a `StorageProvider` |
| `localStorageProvider` | Built-in `StorageProvider` backed by `localStorage` |

`StorageProvider` interface:
```typescript
interface StorageProvider {
  get: (key: string) => Promise<any>
  set: (key: string, value: any) => Promise<void>
}
```

### Throttling

| Export | Description |
|---|---|
| `throttled(delay, store)` | Wraps any readable store; subscribers notified at most once per `delay` ms. Pass `0` to skip wrapping. |

### Getter utilities

| Export | Description |
|---|---|
| `getter<T>(store, options?)` | Returns `() => T`; auto-switches from `get()` to a subscription when call frequency exceeds `threshold` (default 10/s) |
| `withGetter(store)` | Adds a `.get()` method to any store, returning `S & {get(): T}` so the store's own members survive in the type (e.g. `withGetter(synced(...)).ready`) |
| `projection($, read?)` | Pairs a store with a getter as the `Projection<T>` shape — `$`, `get` and the store's own `subscribe`; `read` is the cheap direct read `getter` prefers over `get($)` |
| `projectFrom(src, read)` | A `Projection` derived from another one, reactively through `.$` and synchronously through `.get()` |

### Derivation helpers

| Export | Description |
|---|---|
| `memoized(store)` | Skips notifying a subscriber when the value is deep-equal to the last one it received |
| `deriveDeduplicated(stores, read)` | Derives `read(values)` from `stores`, skipping results that are `===` to the previous one |
| `deriveDeduplicatedByValue(stores, read)` | Same, skipping results that are deep-equal to the previous one |
| `merged(stores)` | `derived(stores, identity)` — combine several stores into one array store |

## Common Patterns

### 1. Reactive list of text notes

```typescript
import { Repository } from "@welshman/net"
import { deriveEventsById, deriveEventsDesc } from "@welshman/store"

const repository = new Repository()

const noteEventsById = deriveEventsById({
  repository,
  filters: [{ kinds: [1], limit: 100 }],
})

// deriveEventsDesc takes the map store directly
const notes = deriveEventsDesc(noteEventsById)

notes.subscribe($notes => {
  console.log(`${$notes.length} notes, newest first`)
})
```

### 2. Profiles indexed by pubkey

```typescript
import { parseJson } from "@welshman/lib"
import { Repository } from "@welshman/net"
import { deriveItemsByKey, deriveItems, makeDeriveItem } from "@welshman/store"
import { PROFILE, type TrustedEvent } from "@welshman/util"

const repository = new Repository()

type Profile = { event: TrustedEvent; name?: string }

const profilesByPubkey = deriveItemsByKey<Profile>({
  repository,
  filters: [{ kinds: [PROFILE] }],
  // With @welshman/app, use `app.use(Domain).reader(Profile)`
  eventToItem: event => ({ event, ...parseJson(event.content) }),
  getKey: profile => profile.event.pubkey,
})

// All profiles as array
const profiles = deriveItems(profilesByPubkey)

// Per-pubkey reactive lookup
const deriveProfile = makeDeriveItem(profilesByPubkey)
const aliceProfile = deriveProfile("alice-pubkey-hex")

aliceProfile.subscribe($profile => {
  console.log($profile?.name)
})
```

### 3. Persisted user preferences

```typescript
import { synced, localStorageProvider } from "@welshman/store"

const prefs = synced({
  key: "app-prefs",
  storage: localStorageProvider,
  defaultValue: { theme: "dark", notifs: true },
})

// Wait until storage has been read before rendering
await prefs.ready

prefs.update(p => ({ ...p, theme: "light" }))
```

### 4. Throttled store for high-frequency updates

```typescript
import { writable } from "svelte/store"
import { throttled } from "@welshman/store"

const rawCursor = writable({ x: 0, y: 0 })
const cursor = throttled(50, rawCursor) // UI updates at most every 50 ms

window.addEventListener("mousemove", e => {
  rawCursor.set({ x: e.clientX, y: e.clientY })
})
```

### 5. Optimized getter for hot code paths

```typescript
import { getter, withGetter } from "@welshman/store"
import { writable } from "svelte/store"

const counter = withGetter(writable(0))

// Holds a subscription once called more than 10 times per second
function getCount() {
  return counter.get()
}
```

`getter(store)` returns only the accessor function. A common use is looking up a single item in a map store:

```typescript
import { getter } from "@welshman/store"

// bookmarksByPubkey is Readable<Map<string, Bookmark>>
const getBookmarksByPubkey = getter(bookmarksByPubkey)

const getBookmark = (pubkey: string) => getBookmarksByPubkey().get(pubkey)
```

This `getBookmark` function is the right shape to pass as `getItem` to `makeLoadItem`
(see Pattern 6).

### 6. Full reactive item chain

Domain objects derived from repository events, loaded from the network on demand:

```typescript
import {
  deriveItemsByKey,
  deriveItems,
  getter,
  makeLoadItem,
  makeDeriveItem,
} from "@welshman/store"
import { Network, Router } from "@welshman/app"
import { outbox, tagSpec, tagValue, tagValues } from "@welshman/util"
import type { TrustedEvent } from "@welshman/util"

const BOOKMARK_KIND = 30003

type Bookmark = {
  pubkey: string
  title: string
  urls: string[]
  event: TrustedEvent
}

const parseBookmark = (event: TrustedEvent): Bookmark => ({
  pubkey: event.pubkey,
  title: tagValue(tagSpec("title"), event.tags) ?? "Untitled",
  urls: tagValues(tagSpec("r"), event.tags),
  event,
})

// Step 1: Reactive Map<pubkey, Bookmark> — live-updates from repository
const bookmarksByPubkey = deriveItemsByKey<Bookmark>({
  repository,
  filters: [{ kinds: [BOOKMARK_KIND] }],
  getKey: b => b.pubkey,
  eventToItem: parseBookmark,
})

// Step 2: Reactive array of all bookmarks
const bookmarks = deriveItems(bookmarksByPubkey)

// Step 3: Synchronous getter for use in callbacks and as getItem for makeLoadItem
const getBookmarksByPubkey = getter(bookmarksByPubkey)
const getBookmark = (pubkey: string) => getBookmarksByPubkey().get(pubkey)

// Step 4: Cached async loader. Concurrent calls for the same key and args share one
//         request, and a fresh item is reused for the timeout window (default: 3600 s)
const loadBookmark = makeLoadItem<Bookmark>(
  async (pubkey: string) => {
    const scenario = await app.use(Router).resolve([outbox(pubkey)])

    await app.use(Network).load({
      relays: scenario.getUrls(),
      filters: [{ kinds: [BOOKMARK_KIND], authors: [pubkey], limit: 1 }],
      timeout: 3000,
    })
  },
  getBookmark,
)

// Step 5: Per-key reactive store factory that calls loadBookmark for each derived key
const deriveBookmark = makeDeriveItem(bookmarksByPubkey, loadBookmark)

// Usage: each call returns Readable<Bookmark | undefined>
const aliceBookmark = deriveBookmark("alice-pubkey-hex")
aliceBookmark.subscribe($b => console.log($b?.title))
```

## Integration Notes

- **`@welshman/net`** provides `Repository` and `Tracker`. `Repository` is the event cache that feeds every store in this package, and its `update` events drive store updates.
- **`@welshman/util`** provides `TrustedEvent`, `Filter`, and the tag helpers for decoding events inside `eventToItem`. Typed decoders for profiles, lists and other kinds are Reader classes in `@welshman/domain`.
- **`@welshman/app`** builds its data plugins on these primitives, so with `@welshman/app` most collections already exist as plugins.
- `localStorageProvider` needs `localStorage`, so it is browser-only. Guard it with `if (browser)` in SvelteKit.

## Gotchas & Tips

- **`eventToItem` can return `undefined`** to skip an event, which filters out malformed events (e.g. `event.tags.length > 1 ? {event, pubkeys: tagValues(hexTags("p"), event.tags)} : undefined`). A thrown error or rejection is logged with `console.warn` and the event is skipped.
- **`synced` loads asynchronously.** The store emits `defaultValue` synchronously, then the stored value once storage resolves. `await store.ready` wherever the persisted value is needed.
- **`throttled(0, store)` returns the original store**, so a user-configurable delay may be zero.
- **A collection reads the repository only while something is subscribed to it**, so a snapshot read through `get(collection)` subscribes, reads and unsubscribes — and that read is what queues an arrived event's parse. `collection.read(key)` reads before draining the outstanding parses as well as after, so a caller never has to order the two itself, and an item the index already holds comes back synchronously rather than behind another event's parse. A parse that never resolves holds the drain open.
- **`makeDeriveItem` is a factory.** Call it once to create the lookup function, then call that with a key to get a per-key `Readable`. Derive `deriveItemsByKey` stores once at module level rather than inside a Svelte `$:` block, which rebuilds them on every run.
- **`makeLoadItem` timeout is in seconds**, because it is compared against `now()` from `@welshman/lib`. Write `{ timeout: 30 }` for a 30-second staleness window, not `30_000`.
- **`makeLoadItem` propagates errors.** A rejection from `loadItem` rejects the returned promise. `makeDeriveItem` ignores the rejection of its `onDerive` call, and any other caller that treats a failed load as "no data yet" catches it itself.
- **`makeLoadItem` backs off exponentially per source.** Repeat calls for a key that does not resolve return the stale item until the backoff expires. `makeForceLoadItem` fetches regardless of the cache.
- **`deriveEventsAsc`/`deriveEventsDesc` take the map projection**, the output of `deriveEventsById`, rather than an array store. `deriveItemsSorted` sorts an array store.
- **`getter` vs `withGetter`.** `getter(store)` returns only the accessor function. `withGetter(store)` keeps the full store API (`.subscribe`, `.set`, `.update`) and adds `.get()`.
