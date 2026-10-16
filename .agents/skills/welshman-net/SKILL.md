---
name: welshman-net
description: "Use this skill when working with @welshman/net: relay connections, request/publish flows, auth, relay pool management, adapters, socket policies, the Repository/Tracker/WrapManager stores, or low-level nostr network I/O."
---

# welshman/net — Relay Network Layer

`@welshman/net` is the core networking layer for welshman-based nostr apps. It manages WebSocket relay connections, subscriptions, event publishing, NIP-42 auth, and NIP-77 negentropy sync. It sits below `@welshman/app` (which owns instances of these primitives and wires them together) and depends on `@welshman/util` for event types and `@welshman/lib` for utilities.

`Pool`, `Repository`, `Tracker` and `WrapManager` are plain classes you instantiate, and the pool and repository a call should use are passed per call as a `context`.

## Installation

```bash
npm install @welshman/net
# or
pnpm add @welshman/net
yarn add @welshman/net
```

## Key Exports

### Context

| Export | Description |
|--------|-------------|
| `NetContext` | `{pool?: Pool, repository?: Repository, getAdapter?: AdapterFactory}` — the instances a call should use |
| `AdapterContext` | `Partial<NetContext>` — what every `context` parameter accepts |
| `AdapterFactory` | `(url: string, context: NetContext) => AbstractAdapter \| undefined` |

Every entry point (`request`, `requestOne`, `publish`, `publishOne`, `diff`/`pull`/`push`) takes an optional `context`. There is no default: without `context.pool` a `wss://` url throws `"Unable to connect to relays without context.pool"`, and without `context.repository` `LOCAL_RELAY_URL` throws `"LOCAL_RELAY_URL cannot be used without context.repository"`. In an app, `app.netContext` is that object and `app.use(Network)` passes it for you.

### Pool & Sockets

| Export | Description |
|--------|-------------|
| `Pool` | Connection pool; creates and manages `Socket` instances per relay url. Construct with `new Pool()` |
| `pool.socketPolicies` | The policies applied to sockets this pool creates — copied from `defaultSocketPolicies` at construction |
| `pool.get(url)` | Gets or lazily creates a `Socket` for a (normalized) relay url |
| `pool.has(url)` | Whether a socket already exists for the url |
| `pool.remove(url)` | Cleans up the socket and forgets the url |
| `pool.clear()` | Removes every socket |
| `pool.addSocketPolicy(policy)` | Adds a policy for sockets created from then on; returns a function that removes it |
| `pool.subscribe(cb)` | Fires `cb(socket)` each time a new socket is created; returns an unsubscriber |
| `Socket` | WebSocket wrapper with status tracking, send queue, and auth state |
| `SocketStatus` | Enum: `Open`, `Opening`, `Closing`, `Closed`, `Error` |
| `SocketEvent` | Enum: `Status`, `Send`, `Sending`, `Receive`, `Receiving`, `Error` |
| `socket.open()` / `attemptToOpen()` / `close()` / `cleanup()` / `send(message)` | Connection and send control |
| `socket.auth` | `AuthState` instance for NIP-42 on this connection |

### Request

| Export | Description |
|--------|-------------|
| `requestOne(options)` | Subscribe to a single relay; returns `Promise<TrustedEvent[]>` |
| `request(options)` | Subscribe to multiple relays in parallel; returns `Promise<TrustedEvent[]>` |
| `load(options)` | `request` with `autoClose: true`, for a one-shot request |

`request` / `requestOne` options (`BaseRequestOptions`):
- `relay` / `relays` — relay url(s)
- `filters` — array of nostr `Filter` objects
- `autoClose?: boolean` — close the subscription after EOSE, on socket disconnect, or at the timeout, whichever comes first
- `timeout?: number` — close the subscription this many ms in (default 8 s with `autoClose`, none without)
- `signal?: AbortSignal` — cancellation
- `priority?: number` — send priority on the socket's queue
- `tracker?: Tracker` — cross-relay deduplication (shared automatically by `request`)
- `context?: AdapterContext`
- `resubscribeAttempts?: number` — how many times to retry a subscription the relay CLOSEs for a non-final reason (default `0`; each retry backs off `2 ** attempt` seconds)
- `isEventValid?: (event, url) => boolean` — signature check override; defaults to `verifyEvent`
- Callbacks: `onEvent(event, url)`, `onEose(url)`, `onClose()`, `onDisconnect(url)`, `onFiltered`, `onDuplicate`, `onDeleted`, `onInvalid`, `onClosed(reason, url)`

`request`-only: `threshold?: number` — fraction of relays that must close before the promise resolves and the rest are closed (default `1`). An auto-closing `request` for a single filter of `ids` resolves as soon as it has every id.

Without `autoClose` or a `signal`, `requestOne` streams indefinitely, and its promise resolves only if the relay closes every subscription. Pass one for a one-shot fetch.

### Count

| Export | Description |
|--------|-------------|
| `countOne(options)` | Asks one relay how many events match some filters (NIP-45); returns `Promise<number \| undefined>` |
| `count(options)` | Asks several relays and takes the highest answer; returns `Promise<number \| undefined>` |
| `supportsCount(relay)` | Whether that relay has answered a COUNT this session — `true`, `false`, or `undefined` if it has not been asked |
| `COUNT_TIMEOUT` | 3000 ms, how long a relay has to answer before it counts as refusing |

Options are `{relay | relays, filters, context?, signal?}`. `undefined` means no relay supports COUNT, which is a different answer from `0`. Support is read off the wire rather than from NIP-11: a relay that refuses with CLOSED (other than `auth-required:` or `rate-limited:`), or stays silent while connected, is remembered and not asked again. Relays hold overlapping subsets of the network, so what `count` returns is a lower bound on the total.

### Publish

| Export | Description |
|--------|-------------|
| `publish(options)` | Publishes to multiple relays; resolves to `PublishResultsByRelay` |
| `publishOne(options)` | Publishes to a single relay; resolves to `PublishResult` |
| `PublishStatus` | Enum: `Sending`, `Pending`, `Success`, `Failure`, `Timeout`, `Aborted` |
| `PublishResult` | `{status: PublishStatus, detail: string, relay: string}` |
| `PublishResultsByRelay` | `Record<string, PublishResult>` |

`publish` options: `event`, `relays`, `timeout?` (default 10 s), `signal?`, `priority?`, `context?`, plus callbacks `onSuccess`, `onFailure`, `onPending`, `onTimeout`, `onAborted`, `onComplete`.

### Auth (NIP-42)

| Export | Description |
|--------|-------------|
| `AuthState` | Manages auth state for one socket; available as `socket.auth` |
| `AuthStatus` | Enum: `None`, `Requested`, `PendingSignature`, `DeniedSignature`, `PendingResponse`, `Forbidden`, `Ok` |
| `AuthStateEvent.Status` | Emitted when auth status changes |
| `makeSocketPolicyAuth(options)` | Creates a socket policy that auto-handles auth challenges. Options: `{sign, shouldAuth?, recheck?}`; `recheck` is a store whose changes re-ask `shouldAuth` for a declined challenge |
| `socket.auth.authenticate(sign, signal)` | Opens the socket and answers the challenge (again, if an earlier answer failed); resolves to `{ok, status, reason}` |
| `makeSocketPolicyRefusals({onAllowed, onRefused})` | Reports each request or publish the relay serves, or refuses as `restricted:`/`blocked:`. Not a default policy |

### Policies

A `SocketPolicy` is `(socket: Socket) => Unsubscriber`, run once per socket at creation.

| Export | Description |
|--------|-------------|
| `socketPolicyAuthBuffer` | Buffers outgoing messages during auth and replays them once it completes |
| `socketPolicyCancelUnsent` | Drops a queued REQ or NEG-OPEN together with its close when the close is queued before the request was sent |
| `socketPolicyConnectOnSend` | Auto-opens closed sockets when a message is queued, unless the socket errored in the last 5 s |
| `socketPolicyLifecycle` | Owns the socket's lifetime: closes it after 30 s idle with nothing pending; while work *is* pending, probes with a throwaway REQ when nothing has been received for a while and closes if the probe goes unanswered; on an unexpected close, reopens with backoff, which only resets once the relay answers something, and replays pending messages, rewriting each REQ's filters with `catchUpFilter` so nothing is missed; forgets a request as soon as its `CLOSE` is queued, so it never replays one closed during an outage |
| `socketPolicyMultiplex` | Merges REQs queued at the same time into one `MUX-` REQ of at most `MULTIPLEX_MAX_FILTERS` unioned filters, and hands the relay's answers back out under each original id |
| `defaultSocketPolicies` | `[socketPolicyAuthBuffer, socketPolicyCancelUnsent, socketPolicyMultiplex, socketPolicyConnectOnSend, socketPolicyLifecycle]` |

`defaultSocketPolicies` is a template. `new Pool()` copies it into `pool.socketPolicies`, so mutating the array after a pool exists does nothing for that pool; assign to `pool.socketPolicies` instead.

### Repository

| Export | Description |
|--------|-------------|
| `Repository` | In-memory indexed event store with delete/expiry support. Construct with `new Repository()` |
| `repository.publish(event, {shouldNotify?})` | Stores an event; returns `false` if it is a duplicate or older than the stored replaceable. Its `"update"` reports removals like `load` |
| `repository.query(filters, {shouldSort?, includeDeleted?, includeExpired?, where?})` | Returns matching `TrustedEvent[]`, sorted by `created_at` desc unless disabled. `where` narrows by a predicate before any `limit` counts. A filter with both a `limit` and an `until` and no `ids`/`authors`/tag is paged off the day index, so the window bounds the work |
| `repository.getEvent(idOrAddress)` | Look up by id or NIP-01 address (`kind:pubkey:d`) |
| `repository.hasEvent(event)` | Whether the event (or a newer replacement) is already stored |
| `repository.removeEvent(idOrAddress)` | Drops an event and unwinds its index entries |
| `repository.isDeleted(event)` | `true` if a kind-5 delete by the same author covers this event, or a newer version at its address replaced it (`isDeletedById` / `isDeletedByAddress` check one path each) |
| `repository.isExpired(event)` | `true` past the event's NIP-40 `expiration` |
| `repository.dump()` | All stored events as `TrustedEvent[]` |
| `repository.load(events)` | Bulk-inserts events alongside those already stored; emits one `"update"` diff whose `removed` holds only what the batch hides |
| `repository.clear()` | Empties every index; emits `"clear"` |
| `LOCAL_RELAY_URL` | `"local://welshman.relay/"` — conventional url for the local repository (also exported by `@welshman/util`) |
| `RepositoryUpdate` | `{added: TrustedEvent[], removed: Set<string>}` — payload of `"update"` events |
| `mergeRepositoryUpdates(updates)` | Merges an array of `RepositoryUpdate` objects into one |

Emits `"update"` with a `RepositoryUpdate` whenever events are added or removed.

> **Prefer `LOCAL_RELAY_URL` over direct repository access.** Pass `LOCAL_RELAY_URL` as a relay url to `load()`, `request()` and `publish()` (with the repository in `context`), so local reads and writes go through the same validation, deduplication and tracking as remote ones. Reserve the direct API for bulk startup (`repository.load()`) and low-level introspection (`getEvent`, `isDeleted`, `dump`).

### Tracker

| Export | Description |
|--------|-------------|
| `Tracker` | Bidirectional map of `eventId ↔ Set<relayUrl>` (`relaysById` / `idsByRelay`) |
| `tracker.track(eventId, relay)` | Records the relay; returns `true` if the event was already recorded for any relay |
| `tracker.addRelay(id, relay)` / `removeRelay(id, relay)` | Explicit edge management; removing an event's last relay forgets the event |
| `tracker.hasRelay(id, relay)` | Membership check |
| `tracker.getRelays(eventId)` | Set of relay urls that have sent this event |
| `tracker.getIds(relay)` | Set of event ids seen from a relay |
| `tracker.copy(id1, id2)` | Copies relay associations from one id to another (used for gift wraps) |
| `tracker.load(relaysById)` | Bulk-adds mappings from a `Map<string, Set<string>>`; emits `"load"` |
| `tracker.clear()` | Removes all mappings; emits `"clear"` |

### Adapters

| Export | Description |
|--------|-------------|
| `getAdapter(url, context?)` | Factory: `context.getAdapter` first, then `LocalAdapter` for `LOCAL_RELAY_URL`, then `SocketAdapter` from `context.pool` for relay urls |
| `SocketAdapter` | WebSocket relay adapter |
| `LocalAdapter` | In-memory adapter over a `Repository` |
| `MockAdapter` | Test adapter with manual send control |
| `AbstractAdapter` | Base class for custom adapters |
| `AdapterEvent.Receive` | Emitted when a relay message arrives |

### Negentropy / Diff (NIP-77)

| Export | Description |
|--------|-------------|
| `diff(options)` | Compares local events against relays; returns `{relay, have, need}[]` |
| `pull(options)` | Fetches events relays have that you don't |
| `push(options)` | Publishes events you have that relays don't |
| `Difference` | Low-level per-relay negentropy session |

### Messages

| Export | Description |
|--------|-------------|
| `RelayMessageType` / `ClientMessageType` | Enums of relay→client and client→relay message types |
| `isRelayEvent()`, `isRelayEose()`, `isRelayOk()`, `isRelayAuth()`, `isRelayClosed()`, `isRelayCount()`, `isRelayNotify()`, … | Type guards for relay messages |
| `isClientReq()`, `isClientEvent()`, `isClientClose()`, `isClientAuth()`, `isClientCount()`, … | Type guards for client messages |
| `matchReason(prefix, reason)` / `RelayReasonPrefix` | Match a relay's machine-readable `OK`/`CLOSED` reason prefix (`auth-required:`, `restricted:`, …) |

### WrapManager

| Export | Description |
|--------|-------------|
| `WrapManager` | Tracks NIP-59 gift wrap ↔ rumor relationships. `new WrapManager({tracker, repository})` |
| `wrapManager.add({wrap, rumor, recipient})` | Stores the rumor in the repository and copies the wrap's relay tracking onto it |
| `wrapManager.getRumor(wrapId)` / `getWraps(rumorId)` | Look up either direction |
| `wrapManager.remove(id)` / `removeByRumorId(id)` / `clear()` | Teardown; `remove` keeps a rumor another wrap still carries, and `clear` emits `"clear"` |
| `wrapManager.dump()` / `load(wrapItems)` | Persist and restore (`WrapItem[]`); unlike `Repository` and `Tracker`, `load` clears existing wraps first |

---

## Common Patterns

### Set up a context

```typescript
import {Pool, Repository} from '@welshman/net'
import type {NetContext} from '@welshman/net'

const pool = new Pool()
const repository = new Repository()
const context: NetContext = {pool, repository}
```

Pass `context` to every net call below.

### Connect to a relay and stream events

```typescript
import {SocketEvent, SocketStatus} from '@welshman/net'

const socket = pool.get('wss://relay.example.com')

socket.on(SocketEvent.Status, (status: SocketStatus) => {
  console.log('status:', status)
})

// Send REQ directly (prefer request() for higher-level use)
socket.send(['REQ', 'my-sub', {kinds: [1], limit: 10}])
```

### Load events (one-shot)

```typescript
import {load} from '@welshman/net'

// Without a `threshold` it resolves when every relay has closed or timed out; `threshold: 0.5`
// resolves at half. `app.use(Network).load` binds the context for you.
const events = await load({
  relays: ['wss://relay.example.com', 'wss://relay2.example.com'],
  filters: [{kinds: [0], authors: ['<pubkey>']}],
  timeout: 3000,
  context,
})
```

### Stream events indefinitely

```typescript
import {request} from '@welshman/net'
import {now} from '@welshman/lib'

// Without autoClose this streams forever; the returned promise never settles
// unless all relays close the subscription.
const ctrl = new AbortController()

request({
  relays: ['wss://relay.example.com'],
  filters: [{kinds: [1], since: now()}],
  signal: ctrl.signal,
  context,
  onEvent: (event, url) => console.log(event.id, 'from', url),
})

// Later:
ctrl.abort()
```

### Publish an event

```typescript
import {publish, PublishStatus} from '@welshman/net'

const results = await publish({
  event: signedEvent,
  relays: ['wss://relay.example.com', 'wss://relay2.example.com'],
  timeout: 5000,
  context,
  onSuccess: r => console.log('accepted by', r.relay),
  onFailure: r => console.warn('rejected by', r.relay, r.detail),
})

for (const [relay, result] of Object.entries(results)) {
  if (result.status === PublishStatus.Success) {
    console.log(relay, 'ok')
  }
}
```

### Enable NIP-42 auth

Policies are per-pool. Set them before the pool creates any sockets, because a socket already in the pool keeps the policies it was built with.

```typescript
import {Pool, defaultSocketPolicies, makeSocketPolicyAuth} from '@welshman/net'
import type {StampedEvent} from '@welshman/util'

const pool = new Pool()

pool.socketPolicies = [
  ...defaultSocketPolicies,
  makeSocketPolicyAuth({
    sign: (event: StampedEvent) => mySigner.sign(event),
    shouldAuth: socket => true, // auth on every relay
  }),
]
```

### Custom socket policies

A policy receives the socket when it is created, attaches listeners or patches socket methods, and returns a cleanup function.

```typescript
import {writable} from 'svelte/store'
import {on} from '@welshman/lib'
import {SocketEvent, isRelayEvent} from '@welshman/net'
import type {Socket, RelayMessage} from '@welshman/net'

// Track how many events each relay has delivered this session
export const eventCountByRelay = writable<Record<string, number>>({})

const eventCountPolicy = (socket: Socket) =>
  on(socket, SocketEvent.Receive, (message: RelayMessage) => {
    if (isRelayEvent(message)) {
      eventCountByRelay.update(counts => ({
        ...counts,
        [socket.url]: (counts[socket.url] ?? 0) + 1,
      }))
    }
  })

pool.socketPolicies = [...pool.socketPolicies, eventCountPolicy]
```

The same structure covers more advanced patterns. Patch `socket.open` to block connections, or listen to `SocketEvent.Sending`/`SocketEvent.Receiving` to intercept messages before they are processed.

### Custom adapter (e.g. non-WebSocket backend)

```typescript
import {AbstractAdapter, AdapterEvent, request} from '@welshman/net'
import type {ClientMessage} from '@welshman/net'

class MyAdapter extends AbstractAdapter {
  constructor(private url: string) {
    super()
    // set up your transport here
  }

  get urls() { return [this.url] }
  get sockets() { return [] }

  send(message: ClientMessage) {
    // forward to your backend; call
    // this.emit(AdapterEvent.Receive, replyMsg, this.url) when data arrives
  }
}

load({
  relays: ['myscheme://some-id'],
  filters: [{kinds: [1]}],
  context: {
    ...context,
    getAdapter: url => (url.startsWith('myscheme://') ? new MyAdapter(url) : undefined),
  },
})
```

A `getAdapter` that returns `undefined` falls through to the built-in resolution, so you can special-case one scheme and leave the rest alone.

### Use LOCAL_RELAY_URL to read/write the local repository

```typescript
import {publish, load, request, LOCAL_RELAY_URL} from '@welshman/net'
import {now} from '@welshman/lib'

const events = await load({
  relays: [LOCAL_RELAY_URL],
  filters: [{kinds: [1], authors: ['<pubkey>'], limit: 20}],
  context,
})

// Write to the local repository (and any remote relays) in one call
await publish({
  event: signedEvent,
  relays: [LOCAL_RELAY_URL, 'wss://relay.example.com'],
  context,
})

// Subscribe to new local events in real time
request({
  relays: [LOCAL_RELAY_URL],
  filters: [{kinds: [1], since: now()}],
  context,
  onEvent: event => console.log('new local event', event.id),
})
```

### Startup: bulk-load persisted events

```typescript
import {verifiedSymbol} from '@welshman/util'
import type {TrustedEvent} from '@welshman/util'

// The repository never verifies signatures, but requests against LOCAL_RELAY_URL do,
// and verifyEvent skips events marked as already verified
const storedEvents: TrustedEvent[] = await loadFromStorage()
for (const event of storedEvents) {
  event[verifiedSymbol] = true
}

// Inserts every event in one pass and emits a single "update"
repository.load(storedEvents)
```

### Startup: bulk-load Tracker state

```typescript
// Load after repository.load() so orphaned event ids can be dropped
const relaysById = new Map<string, Set<string>>()
for (const {id, relays} of storedTrackerItems) {
  if (repository.getEvent(id)) {
    relaysById.set(id, new Set(relays))
  }
}

tracker.load(relaysById)
```

### Persist repository changes to IndexedDB (canonical pattern)

```typescript
import {on, batch} from '@welshman/lib'
import type {RepositoryUpdate} from '@welshman/net'
import type {TrustedEvent} from '@welshman/util'

// batch(ms, fn) collects all "update" events fired within `ms` and calls fn once
on(
  repository,
  'update',
  batch(3000, async (updates: RepositoryUpdate[]) => {
    const toAdd: TrustedEvent[] = []
    const toRemove = new Set<string>()

    for (const {added, removed} of updates) {
      for (const event of added) toAdd.push(event)
      for (const id of removed) toRemove.add(id)
    }

    const tx = db.transaction('events', 'readwrite')
    await Promise.all([
      ...toAdd.map(e => tx.store.put(e)),
      ...Array.from(toRemove).map(id => tx.store.delete(id)),
      tx.done,
    ])
  }),
)
```

---

## Integration Notes

- **`@welshman/util`** — provides `TrustedEvent`, `SignedEvent`, `Filter`, `verifyEvent`, `matchFilters`, `getAddress`, `normalizeRelayUrl`, etc. All event objects flowing through `@welshman/net` are `TrustedEvent`.
- **`@welshman/lib`** — utility helpers (`Emitter`, `batcher`, `defer`, `on`, …). `Emitter` is the base class for `Tracker`, `Repository` and `WrapManager`; `Socket`, `AuthState`, `AbstractAdapter` and `Difference` extend node's `EventEmitter` directly.
- **`@welshman/app`** — an `App` owns one `Pool`, `Repository`, `Tracker` and `WrapManager`, exposes the pool and repository as `app.netContext`, and wraps the request/publish entry points as `app.use(Network)`. App-level code goes through that; `@welshman/net` directly is for raw relay I/O or clients without an `App`.

---

## Gotchas & Tips

- **Build one `{pool, repository}` per identity and thread it through.** Two contexts never share sockets or events.
- **Relay url normalization happens inside `pool.get(url)`** via `normalizeRelayUrl`. Pass raw urls everywhere.
- **`pool.get(url)` creates a fresh socket after `pool.remove(url)`.** `remove` forgets the url and cleans up the socket, policies included; call it only when you want the pool to forget the relay, not merely to disconnect.
- **`socketPolicyLifecycle` reopens a closed socket only when work is pending.** Opening a socket because something was queued is `socketPolicyConnectOnSend`'s job.
- **Subscriptions the relay CLOSEs are not retried by default.** Set `resubscribeAttempts` when a caller should survive a transient refusal (e.g. auth in flight).
- **`Tracker` is shared across relays in `request()`**, so `onDuplicate` fires for events received from more than one relay. That is cross-relay deduplication, not an error.
- **`Repository.publish()` returns `false` for stale replaceable events.** If a newer version is already stored, the older one is silently dropped.
- **`makeSocketPolicyAuth` requires a `sign` function** returning `Promise<SignedEvent>`. If the user cancels, throw or reject: `doAuth` catches it and moves to `AuthStatus.DeniedSignature`.
- **Each filter in `filters` is queued as a separate REQ** inside `requestOne`. `socketPolicyMultiplex` merges REQs queued at the same time, so concurrent requests, live or one-shot, share a relay subscription.
- **`repository.load()` adds to what is stored.** It inserts every event without per-event notification, then emits a single `"update"`. Call `repository.clear()` first to replace the contents.
- **`RepositoryUpdate.removed` is a `Set<string>`.** Iterate with `for...of` or `Array.from`. `batch()` from `@welshman/lib` hands your callback a `RepositoryUpdate[]` — merge them yourself or use `mergeRepositoryUpdates`.

## Related skills

- `welshman-app` — the instance-based layer that owns these primitives (`app.netContext`, `app.use(Network)`, `app.use(Sync)`).
- `welshman-store` — Svelte derivations over a `Repository` and `Tracker`.
- `welshman-util` — the event, filter and relay-url types on the wire, and the routing DSL for choosing which urls to pass to these functions.
