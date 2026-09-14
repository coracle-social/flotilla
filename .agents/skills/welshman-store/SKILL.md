---
name: welshman-store
description: "Use this skill when working with @welshman/store: Repository pattern for nostr events, synced Svelte stores, throttled stores, or getter/derived store utilities."
---

# welshman/store — Svelte Store Utilities

## Overview

`@welshman/store` provides reactive Svelte store primitives tailored for nostr development. It bridges the `Repository` (event cache) from `@welshman/net` with Svelte's reactive system, letting you derive live-updating collections of events or domain objects (profiles, lists, etc.) with minimal boilerplate. It also ships general-purpose utilities: persistence via `synced`, throttling via `throttled`, and optimized access via `withGetter`/`getter`.

## Installation

```bash
npm install @welshman/store
# or
pnpm add @welshman/store
yarn add @welshman/store
```

## Key Exports

### Event stores (from Repository)

| Export | Description |
|---|---|
| `deriveEventsById(options)` | Returns `Readable<Map<string, TrustedEvent>>` — live map of events matching `filters` |
| `deriveEvents(options)` | Returns `Readable<TrustedEvent[]>` — calls `deriveEventsById` internally and converts to array |
| `deriveEventsAsc(eventsByIdStore)` | Takes a `Readable<Map<string, TrustedEvent>>` and returns events sorted ascending by `created_at` |
| `deriveEventsDesc(eventsByIdStore)` | Takes a `Readable<Map<string, TrustedEvent>>` and returns events sorted descending by `created_at` |
| `makeDeriveEvent(options)` | Factory returning `(idOrAddress: string) => Readable<TrustedEvent \| undefined>` for single-event lookups |
| `deriveIsDeleted(repository, event)` | `Readable<boolean>` — tracks deletion status of an event |
| `deriveArray(itemsByIdStore)` | Turns any `Readable<Map<string, T>>` into `Readable<T[]>` |
| `getEventsById(options)` | The one-shot, non-reactive form of `deriveEventsById` |

### Relay-scoped event stores

These key events by the relays they were seen on, via a `Tracker`. Use them when the same event (or the same addressable coordinate) has to stay distinct per relay — NIP-29 rooms, relay membership, per-relay replaceables.

| Export | Description |
|---|---|
| `deriveEventsByIdByUrl(options)` | `Readable<Map<url, Map<id, TrustedEvent>>>` — every relay at once |
| `deriveEventsByIdForUrl(options)` | `Readable<Map<id, TrustedEvent>>` — one relay |
| `getEventsByIdByUrl` / `getEventsByIdForUrl` | Non-reactive equivalents |
| `deriveItemsByKeyByUrl<T>(options)` | The relay-scoped `deriveItemsByKey`: an event is keyed once per relay via `getKey(item, url)` |

Both relay-scoped option types extend `EventsByIdOptions` with `tracker: Tracker` (and `url: string` for the `ForUrl` variants). `ItemsByKeyByUrlOptions` adds two things over `ItemsByKeyOptions`:

```typescript
{
  getKey: (item: T, url: string) => string | undefined  // undefined excludes the item on that relay
  revalidateOn?: Readable<unknown>   // re-evaluate every key when this changes — for keys that
                                     // depend on state settling later (e.g. a relay's NIP-11 self)
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
| `deriveItemsByKey<T>(options)` | Maps events to domain objects, indexed by a string key; `Readable<Map<string, T>>` |
| `deriveItems<T>(itemsByKey)` | Converts the map to `Readable<T[]>` |
| `deriveItemsSorted<T>(sortFn, itemsStore)` | Sorts a `Readable<T[]>` by a numeric sort-value function `(item: T) => number`; returns `Readable<T[]>` |
| `makeDeriveItem<T>(itemsByKey, onDerive?)` | Returns a factory `(key) => Readable<T \| undefined>` for per-key reactive lookups |
| `makeLoadItem<T>(loadItem, getItem, options?)` | Cached async loader with staleness checks and exponential backoff |
| `makeForceLoadItem<T>(loadItem, getItem)` | Async loader that always fetches fresh data |

`makeLoadItem` options (`MakeLoadItemOptions`):
```typescript
{
  timeout?: number     // staleness window in SECONDS (default 3600)
  maxSize?: number     // LRU size for the fetched/attempt caches (default 10_000)
  getFetched?: (key: string) => number          // override where "last fetched" is stored
  setFetched?: (key: string, ts: number) => void
  getSource?: (...args: any[]) => string        // how extra args key the backoff (default JSON.stringify)
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
| `withGetter<T>(store)` | Adds a `.get()` method to a `Readable` or `Writable` store (`WritableWithGetter` / `ReadableWithGetter`) |

### Derivation helpers

| Export | Description |
|---|---|
| `memoized(store)` | Suppresses notifications when the derived value is deep-equal to the last one |
| `deriveDeduplicated(stores, read)` | Derives `read()` from `stores`, skipping updates whose result is deep-equal to the previous. The backbone of `Projection`s in `@welshman/app` |
| `deriveDeduplicatedByValue(stores, read)` | Same, comparing by value identity rather than deep equality |
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
  // eventToItem decodes each event; here we parse the profile's JSON content.
  // In a full @welshman/app setup use `app.use(Domain).reader(Profile)` instead.
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

// Safe to call in tight loops — switches internally to subscription when hot
function getCount() {
  return counter.get()
}
```

`getter(store)` is useful when you only need the accessor function (not the full store
API). A common pattern is using it to look up a single item from a map store:

```typescript
import { getter } from "@welshman/store"

// bookmarksByPubkey is Readable<Map<string, Bookmark>>
const getBookmarksByPubkey = getter(bookmarksByPubkey)

// Synchronous, dedup-aware lookup — safe in event handlers and callbacks
const getBookmark = (pubkey: string) => getBookmarksByPubkey().get(pubkey)
```

This `getBookmark` function is the right shape to pass as `getItem` to `makeLoadItem`
(see Pattern 6).

### 6. Full reactive item chain

This is the canonical pattern for domain objects derived from repository events with
on-demand network loading.

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

// Step 4: Cached async loader — concurrent calls for the same key collapse;
//         re-fetches only after the timeout window (default: 3600 s)
const loadBookmark = makeLoadItem<Bookmark>(
  async (pubkey: string) => {
    const scenario = await app.use(Router).resolve([outbox(pubkey)])

    await app.use(Network).load({
      relays: scenario.getUrls(),
      filters: [{ kinds: [BOOKMARK_KIND], authors: [pubkey], limit: 1 }],
    })
  },
  getBookmark,
)

// Step 5: Per-key reactive store factory — loadBookmark is called on each unique
//         key access (makeDeriveItem passes it as onDerive; makeLoadItem handles dedup)
const deriveBookmark = makeDeriveItem(bookmarksByPubkey, loadBookmark)

// Usage: each call returns Readable<Bookmark | undefined>
const aliceBookmark = deriveBookmark("alice-pubkey-hex")
aliceBookmark.subscribe($b => console.log($b?.title))
```

## Integration Notes

- **`@welshman/net`** — provides `Repository` and `Tracker`. `Repository` is the event cache that feeds all store primitives in this package. Events flow from the network into the repository, which triggers store updates automatically.
- **`@welshman/util`** — provides `TrustedEvent`, `Filter`, and the tag/event helpers you use to decode events inside `eventToItem`. Higher-level typed decoders (profiles, lists, …) now live in `@welshman/domain` as async Reader classes (e.g. `Profile.configure(context).reader(event)`).
- **`@welshman/app`** — the high-level app layer re-exports and composes store utilities with pre-configured repositories, loaders, and context. If you are using `@welshman/app`, many of these stores are already wired up for you.
- Stores in this package are **framework-agnostic** at runtime (plain Svelte stores), so they work in SvelteKit SSR as well as browser-only Svelte apps. The `synced` store's `localStorageProvider` is browser-only — guard it with `if (browser)` in SvelteKit.

## Gotchas & Tips

- **`eventToItem` can return `null`/`undefined`** — returning a falsy value from `eventToItem` in `deriveItemsByKey` causes that event to be skipped. Use this to filter out malformed events (e.g. `event.tags.length > 1 ? {event, pubkeys: tagValues(hexTags("p"), event.tags)} : null`).
- **`synced` is async on first read** — the store emits `defaultValue` synchronously, then overwrites it once storage resolves. Always `await store.ready` before reading in server-side or initialization code where you need the persisted value.
- **`throttled(0, store)` is a no-op** — it returns the original store unchanged, so it is safe to call with a user-configurable delay that may be zero.
- **`makeDeriveItem` is a factory** — call it once to create the lookup function, then call the returned function with a key to get a per-key `Readable`. Do not call `deriveItemsByKey` inside a Svelte `$:` block repeatedly; derive once at module level and pass the store down.
- **`makeLoadItem` timeout is in seconds**, because it is compared against `now()` from `@welshman/lib`. Write `{ timeout: 30 }` for a 30-second staleness window, not `30_000`.
- **`makeLoadItem` propagates errors.** A rejection from `loadItem` rejects the returned promise; only the in-flight bookkeeping is cleaned up in a `finally`. Callers that treat a failed load as "no data yet" must catch it themselves, which is why app plugins wrap `load` in `.catch(noop)` on read paths.
- **`makeLoadItem` backs off exponentially per source**, so repeat attempts against a key that is not resolving are throttled rather than retried on every call. Use `makeForceLoadItem` when you need a fetch regardless of the cache.
- **`deriveEventsAsc`/`deriveEventsDesc` take a map store** — both functions accept a `Readable<Map<string, TrustedEvent>>` (the output of `deriveEventsById`), not an array store. To sort an array store use `deriveItemsSorted`.
- **`getter` vs `withGetter`** — use `getter(store)` when you only need the accessor function; use `withGetter(store)` when you want to keep the full store API (`.subscribe`, `.set`, `.update`) plus `.get()` on the same object.
