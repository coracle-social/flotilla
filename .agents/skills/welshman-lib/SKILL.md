---
name: welshman-lib
description: "Use this skill when working with @welshman/lib: general-purpose utilities including LRU cache, EventEmitter, Deferred promises, TaskQueue, URL normalization, or other standalone helpers."
---

# welshman/lib — General Utilities

`@welshman/lib` is a lightweight TypeScript utility library that forms the foundation of the welshman nostr stack. It provides common helpers used across all sibling packages: array/object manipulation, numeric helpers, async primitives, caching, event emission, and encoding utilities. It depends on `@scure/base` (for bech32/utf8 encoding) and `events` (Node.js EventEmitter polyfill).

## Installation

```bash
npm install @welshman/lib
# or
pnpm add @welshman/lib
```

## Key Exports

### Deferred Promises

| Export | Description |
|--------|-------------|
| `Deferred<T, E>` | Type: a `Promise<T>` with `.resolve(T)` and `.reject(E)` methods attached |
| `defer<T, E>()` | Creates a `Deferred<T, E>` — a promise with exposed `.resolve()` and `.reject()` |
| `makePromise<T, E>(executor)` | Creates a strongly-typed promise with typed error (`CustomPromise<T, E>`) |

`E` defaults to `T` when omitted. `defer<void>()` for a signal-style deferred. `thunk.complete` in `@welshman/app` is a `Deferred<void>`.

```typescript
import { defer } from '@welshman/lib'

const ready = defer<void>()
socket.on('open', () => ready.resolve())
await ready
```

### EventEmitter

| Export | Description |
|--------|-------------|
| `Emitter` | Extends Node.js `EventEmitter`; all events also fire on the `'*'` listener with the event name prepended |

```typescript
import { Emitter } from '@welshman/lib'

const bus = new Emitter()
bus.on('*', (eventType, ...args) => console.log(eventType, args))
bus.emit('login', { pubkey: '...' })
```

### LRU Cache

| Export | Description |
|--------|-------------|
| `LRUCache<K, V>` | LRU cache; evicts least-recently-used entries when full |
| `simpleCache(getValue)` | Minimal memoization wrapper over an `LRUCache` with default settings |
| `cached(options)` | Memoizes a function with an LRU backing cache; exposes `.cache` and `.pop()` |

```typescript
import { LRUCache, cached } from '@welshman/lib'

const cache = new LRUCache<string, number>(100)
cache.set('x', 42)
cache.get('x')  // 42
cache.pop('x')  // 42 and removes entry

const getProfile = cached({
  maxSize: 500,
  getKey: ([pubkey]: [string]) => pubkey,
  getValue: ([pubkey]: [string]) => fetchProfile(pubkey),
})
getProfile.pop(pubkey) // invalidate one entry
```

### Task Queue

| Export | Description |
|--------|-------------|
| `TaskQueue<Item>` | Processes items asynchronously in configurable batches |

Options: `batchSize`, `batchDelay` (ms), `processItem`. Methods: `.push(item)`, `.remove(item)`, `.start()`, `.stop()`, `.clear()`, `.process()`, `.subscribe(cb)`.

```typescript
import { TaskQueue } from '@welshman/lib'

const queue = new TaskQueue<string>({
  batchSize: 10,
  batchDelay: 0,
  processItem: async (item) => { /* handle */ },
})
queue.start()
queue.push('task-1')
```

### URL Normalization

| Export | Description |
|--------|-------------|
| `normalizeUrl(url, options?)` | Normalizes a URL string (ported from sindresorhus/normalize-url) |
| `stripProtocol(url)` | Removes the protocol prefix (`http://`, `wss://`, etc.) |
| `displayUrl(url)` | Strips protocol, `www.`, and trailing slash for display |
| `displayDomain(url)` | Extracts just the domain from a URL |

```typescript
import { normalizeUrl, displayUrl, displayDomain } from '@welshman/lib'

normalizeUrl('sindresorhus.com/about.html#contact', { stripHash: true })
// => 'http://sindresorhus.com/about.html'
displayUrl('https://www.example.com/path/')  // => 'example.com/path'
displayDomain('relay.damus.io/path')         // => 'relay.damus.io'
```

> **Note:** `normalizeUrl` defaults to `http://` protocol. Pass `{ defaultProtocol: 'https' }` if needed.

### Async Utilities

| Export | Description |
|--------|-------------|
| `sleep(ms)` | Returns a promise that resolves after `ms` milliseconds |
| `yieldThread()` | Yields to the event loop (microtask break) |
| `poll(options)` | Polls until a condition is met or an AbortSignal fires; options: `{ signal, condition, interval? }` |
| `throttle(ms, fn)` | Returns a throttled version of `fn` |
| `throttleWithValue(ms, fn)` | Throttled function that returns the cached return value between updates |
| `batch(t, fn)` | First call fires `fn([item])` immediately; subsequent calls within `t` ms are collected and `fn` is called with all accumulated items |
| `batcher(t, execute)` | Collects calls for `t` ms, then calls `execute` with all accumulated requests; each individual call returns a `Promise<U>` resolved with its result from the batch. Unlike `batch`, the first call is also deferred — nothing fires immediately. |
| `race(threshold, promises)` | Resolves when `threshold` fraction of promises complete |
| `makeQueue()` | Returns `(f: () => Promise<unknown>) => Promise<unknown>` — chains every call onto one serial promise, logging and swallowing rejections so a failure doesn't stall the chain |

### Timestamp / Time Constants

| Export | Description |
|--------|-------------|
| `MINUTE`, `HOUR`, `DAY`, `WEEK`, `MONTH`, `QUARTER`, `YEAR` | Duration constants **in seconds** |
| `LOCALE` | User's default locale string |
| `TIMEZONE` | User's timezone offset string (e.g. `+05:30`) |
| `now()` | Current Unix timestamp in seconds |
| `ago(unit, count?)` | Unix timestamp from `count` units ago — e.g. `ago(DAY, 7)` |
| `int(unit, count?)` | Multiplies a time unit by count — e.g. `int(HOUR, 2)` = 7200 |
| `ms(seconds)` | Converts seconds to milliseconds |
| `secondsToDate(ts)` / `dateToSeconds(date)` | Convert between Unix seconds and `Date` |
| `createLocalDate(dateString, timezone?)` | Parses a date string as a local date in the given timezone |
| `formatTimestamp(ts)` | Formats Unix seconds as a short datetime string |
| `formatTimestampAsDate(ts)` | Formats Unix seconds as a long date string |
| `formatTimestampAsTime(ts)` | Formats Unix seconds as a time string |
| `formatTimestampRelative(ts)` | Formats Unix seconds as "x minutes ago" |

> **Note:** All time constants are in **seconds**, not milliseconds. Use `ms(n)` to convert for `setTimeout`.

### Number Utilities

| Export | Description |
|--------|-------------|
| `ensureNumber(x)` | `parseFloat(x)` — accepts `string \| number` |
| `num(x)` | Returns `x \|\| 0` — converts `undefined` to 0 |
| `add(x, y)` / `sub(x, y)` / `mul(x, y)` / `div(x, y)` | Arithmetic with `undefined`-safe operands |
| `inc(x)` / `dec(x)` | Increment / decrement (undefined-safe) |
| `lt(x, y)` / `lte(x, y)` / `gt(x, y)` / `gte(x, y)` | Comparisons (undefined-safe) |
| `max(xs)` / `min(xs)` / `sum(xs)` / `avg(xs)` | Aggregates over `(number \| undefined)[]` |
| `between([low, high], n)` | `n > low && n < high` (exclusive) |
| `within([low, high], n)` | `n >= low && n <= high` (inclusive) |
| `clamp([min, max], n)` | Constrains `n` to the range |
| `round(precision, x)` | Rounds to `precision` decimal places |
| `toInt(x)` | `parseInt` that returns `undefined` instead of `NaN` — accepts `number \| string \| undefined` |

### Array / Sequence Utilities

All return new arrays — no mutation.

| Export | Description |
|--------|-------------|
| `first(xs)` / `last(xs)` | First/last element (`undefined` if empty) |
| `ffirst(xs)` | First element of the first iterable in a nested iterable |
| `take(n, xs)` / `drop(n, xs)` | Slice from start / drop from start |
| `concat(...xs)` | Flattens vararg arrays into one, skipping any argument that is `undefined` |
| `append(x, xs)` / `prepend(x, xs)` | Add element to end / start |
| `remove(x, xs)` | Remove all occurrences of `x` |
| `removeAt(i, xs)` | Remove element at index `i` |
| `splitAt(n, xs)` | Split into `[xs.slice(0, n), xs.slice(n)]` |
| `insertAt(n, x, xs)` | Insert `x` at index `n` |
| `replaceAt(n, x, xs)` | Replace element at index `n` with `x` |
| `uniq(xs)` / `uniqBy(f, xs)` | Deduplicate |
| `sort(xs)` | Sorted copy (natural order) |
| `sortBy(f, xs)` | Sort by key function |
| `groupBy(f, xs)` | Returns `Map<K, T[]>` |
| `indexBy(f, xs)` | Returns `Map<K, T>` (last item wins per key) |
| `countBy(f, xs)` | Returns `Map<K, number>` |
| `partition(f, xs)` | Split into `[passing, failing]` |
| `chunk(n, xs)` | Split into fixed-size chunks of length `n` |
| `chunks(n, xs)` | Split into exactly `n` chunks |
| `toggle(x, xs)` | Add if absent, remove if present (pure) |
| `union(a, b)` / `intersection(a, b)` / `difference(a, b)` / `without(a, b)` | Set operations |
| `sample(n, xs)` / `shuffle(xs)` / `choice(xs)` | Random selection / shuffle / single random pick |
| `flatten(xs)` | Flatten one level |
| `ensurePlural(x)` | Wraps a value in `[x]` if it isn't already an array |
| `removeUndefined(xs)` | Filters out `undefined` values |
| `overlappingPairs(xs)` | Returns `[[xs[0],xs[1]], [xs[1],xs[2]], ...]` |
| `range(a, b, step?)` | Generator yielding numbers from `a` to `b` (exclusive) |
| `enumerate(xs)` | Generator yielding `[index, item]` tuples |
| `pluck<T>(k, xs)` | Maps `xs` to `xs[k]` |
| `fromPairs(pairs)` | Creates an object from `[key, value]` tuples |
| `initArray(n, f)` | Creates an array of length `n` using generator `f` |
| `isIterable(x)` / `toIterable(x)` | Check / wrap as iterable |
| `map(f, xs)` / `filter(f, xs)` / `reject(f, xs)` | Iterable-safe versions (accept any `Iterable<T>`) |
| `find(f, xs)` / `some(f, xs)` | Iterable-safe find / any-match |

### Object Utilities

| Export | Description |
|--------|-------------|
| `isPojo(obj)` | Returns `true` if value is a plain object (not class instance, null, or array) |
| `pick(keys, obj)` / `omit(keys, obj)` | Include / exclude keys |
| `omitVals(vals, obj)` | Remove entries whose value is in `vals` |
| `filterVals(f, obj)` | Keep entries where `f(value)` is truthy |
| `mapKeys(f, obj)` / `mapVals(f, obj)` | Transform keys or values |
| `mergeLeft(a, b)` / `mergeRight(a, b)` | Shallow merge — left/right wins on conflicts |
| `deepMergeLeft(a, b)` / `deepMergeRight(a, b)` | Deep merge — left/right wins on conflicts |
| `switcher(key, map)` | Lookup with implicit `map.default` fallback |
| `mapPop(k, m)` | Gets and deletes key from a `Map<K, T>` — returns `T \| undefined` |

> **Note:** `mergeLeft(a, b)` means `a` wins — it spreads `b` first, then `a` on top.

### TypeScript Utility Types

```typescript
import type { Override, MakeOptional, MakeNonOptional, Obj, Maybe, MaybeAsync } from '@welshman/lib'

type UserWithRole = Override<User, { role: 'admin' | 'user' }>
type DraftUser = MakeOptional<User, 'id' | 'createdAt'>
type FullUser = MakeNonOptional<User>
type AnyRecord = Obj          // Record<string, any>
type MaybeStr = Maybe<string> // string | undefined
```

### Functional / Combinator Helpers

| Export | Description |
|--------|-------------|
| `noop` | No-op function |
| `identity(x)` | Returns `x` unchanged |
| `always(x)` | Returns a function that always returns `x` |
| `not(x)` | Logical NOT |
| `complement(f)` | Returns `(...args) => !f(...args)` |
| `tap(f)` | Returns `(x) => { f(x); return x }` — runs a side effect and passes the value through |
| `bind(f, ...args)` | Partially applies `f` with leading `args` |
| `equals(a, b)` | Deep equality (handles arrays, Sets, plain objects) |
| `tryCatch(f, onError?)` | Calls `f`, swallows errors, returns `undefined` on failure |
| `thrower(message)` | Returns a function that throws `new Error(message)` when called |
| `once(f)` | Wraps `f` so it only executes once |
| `memoize(f)` | Single-slot memoization: caches last call; re-runs when args change |
| `call(f)` | Calls `f()` immediately — IIFE alternative; useful with async |
| `ifLet(x, f)` | Calls `f(x)` only if `x` is defined |
| `doLet(x, f)` | Calls `f(x)` and returns the result — scoped binding without a variable |
| `isDefined(x)` / `isUndefined(x)` / `assertDefined(x)` | `undefined` checks (not null) |
| `maybe(x?)` | Identity, typed `T \| undefined` — widens a value to `Maybe<T>` |
| `allPass(...preds)` / `somePass(...preds)` | Combine predicates into one `(x) => boolean` |

### Curried Collection Helpers

Useful as `.filter()` / `.map()` callbacks:

| Export | Description |
|--------|-------------|
| `eq(v)` / `ne(v)` | `x => x === v` / `x => x !== v` |
| `prop(k)` | `x => x[k]` — pluck a property |
| `propIn(k, xs)` | `x => xs.includes(x[k])` — property is in list |
| `nth(i)` | `xs => xs[i]` — element at index |
| `nthEq(i, v)` | `xs => xs[i] === v` |
| `nthNe(i, v)` | `xs => xs[i] !== v` |
| `nthIn(i, vs)` | `xs => vs.includes(xs[i])` |
| `nthNotIn(i, vs)` | `xs => !vs.includes(xs[i])` |
| `spec(values)` | `x => all key-value pairs in values match x` |
| `member(xs)` | `x => xs.includes(x)` |
| `assoc(k, v)` | `obj => ({ ...obj, [k]: v })` — add/update property |
| `dissoc(k)` | `obj => omit([k], obj)` — remove property |

```typescript
import { eq, prop, nth, nthEq, nthIn, nthNotIn, spec, member, assoc, dissoc } from '@welshman/lib'

events.filter(spec({ kind: 1 }))          // kind === 1
events.map(prop('id'))                     // pluck id
tags.filter(nthEq(0, 'p'))               // tags where tag[0] === 'p'
tags.filter(nthIn(0, ['p', 'e']))         // tags where tag[0] is 'p' or 'e'
tags.filter(nthNotIn(0, ['p', 'e']))      // tags where tag[0] is neither
items.filter(member(['a', 'b']))           // items in the set
items.map(assoc('seen', true))            // add property
items.map(dissoc('secret'))               // remove property
```

### Bech32 / Hex / Binary Encoding

| Export | Description |
|--------|-------------|
| `hexToBech32(prefix, hex)` | Encodes hex string to bech32 (e.g. `npub`, `note`) |
| `bech32ToHex(b32)` | Decodes bech32 to hex |
| `bytesToHex(buffer)` | `ArrayBuffer \| Uint8Array` to hex string |
| `hexToBytes(hex)` | Hex string to `Uint8Array` |
| `sha256(data)` | SHA-256 hash of binary data — async, returns hex string |
| `textEncoder` | Shared `TextEncoder` instance |
| `textDecoder` | Shared `TextDecoder` instance |

### JSON / Storage / Network

| Export | Description |
|--------|-------------|
| `parseJson(str)` | Safe `JSON.parse` — returns `undefined` on error or empty input |
| `getJson(key)` / `setJson(key, val)` | `localStorage` get/set with JSON serialization |
| `fetchJson(url, opts?)` | Fetch JSON with optional method/headers/body |
| `postJson(url, data, opts?)` | POST JSON to a URL |
| `uploadFile(url, file)` | Upload a `File` object via `multipart/form-data` POST |
| `on(target, event, cb)` | Type-safe `.on()` wrapper — returns an unsubscribe `() => void` |

### Randomness / IDs

| Export | Description |
|--------|-------------|
| `randomId()` | Generates a random string ID |
| `randomInt(min?, max?)` | Random integer in range (inclusive; default 0–9) |

### String Utilities

| Export | Description |
|--------|-------------|
| `ellipsize(s, len, suffix?)` | Truncates at word boundary with an ellipsis suffix (default `"..."`) |
| `displayList(xs, conj?, n?)` | Oxford-comma list — e.g. `"a, b, and c"` |
| `hash(s)` | Numeric hash from a string |

### Map / Set Helpers

```typescript
import { addToKey, pushToKey, addToMapKey, pushToMapKey } from '@welshman/lib'

// Object-keyed (Record<string, Set<T>> / Record<string, T[]>)
addToKey(byTag, 'p', pubkey)     // adds to Set at key 'p'
pushToKey(byKind, '1', eventId)  // appends to array at key '1'

// Map-keyed (Map<K, Set<T>> / Map<K, T[]>)
addToMapKey(m, relay, eventId)
pushToMapKey(m, relay, eventId)
```

## Common Patterns

### Pattern 1 — Batching writes (IndexedDB / relay)

`batch(t, f)` — first call fires immediately; subsequent calls within `t` ms are accumulated and flushed together.

```typescript
import { batch, on } from '@welshman/lib'
import type { RepositoryUpdate } from '@welshman/net'

on(
  repository,
  'update',
  batch(3000, async (updates: RepositoryUpdate[]) => {
    const toAdd = updates.flatMap(u => u.added)
    const toRemove = new Set(updates.flatMap(u => u.removed))

    const tx = db.transaction('events', 'readwrite')
    await Promise.all([
      ...toAdd.map(e => tx.store.put(e)),
      ...Array.from(toRemove).map(id => tx.store.delete(id)),
      tx.done,
    ])
  }),
)
```

### Pattern 2 — Grouping and indexing nostr events

```typescript
import { groupBy, indexBy, sortBy } from '@welshman/lib'

const byKind = groupBy((e) => e.kind, events)       // Map<number, Event[]>
const byId   = indexBy((e) => e.id, events)         // Map<string, Event>
const sorted = sortBy((e) => -e.created_at, events) // newest first
```

### Pattern 3 — Relative timestamp display

```typescript
import { now, ago, DAY, formatTimestampRelative } from '@welshman/lib'

const recentEvents = events.filter(e => e.created_at > ago(DAY, 7))
const label = formatTimestampRelative(event.created_at) // "3 hours ago"
```

### Pattern 4 — Subscribing to EventEmitter-based objects with `on`

`on(target, event, handler)` returns an unsubscribe function:

```typescript
import { on } from '@welshman/lib'

const unsub = on(app.repository, 'update', updates => {
  console.log('added', updates.flatMap(u => u.added).length, 'events')
})

// Later:
unsub()
```

### Pattern 5 — IIFE alternative with `call`

```typescript
import { call } from '@welshman/lib'

call(async () => {
  const data = await fetchJson('/something')
})
```

## Integration Notes

- **All welshman packages depend on `@welshman/lib`** — `Deferred`, `Emitter`, time constants, and collection utilities are shared across `@welshman/net`, `@welshman/store`, `@welshman/util`, etc.
- **`@welshman/net`** uses `Emitter` (via `Tracker`, `Repository`, `WrapManager`), `batch`, and `LRUCache` internally. `Socket` extends Node's built-in `EventEmitter` directly.
- **`@welshman/app`** thunks use `Deferred<void>` — `thunk.complete` resolves when all relays have responded or timed out.
- **`batcher`** is used in `@welshman/net` for deduplicating concurrent fetch requests — pass it an `execute` function that returns results in the same order as its inputs.
