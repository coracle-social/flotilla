---
name: welshman-net
description: "Use this skill when working with @welshman/net: relay connections, request/publish flows, auth, relay pool management, adapters, socket policies, the Repository/Tracker/WrapManager stores, or low-level nostr network I/O."
---

# welshman/net — Relay Network Layer

`@welshman/net` is the core networking layer for welshman-based nostr apps. It manages WebSocket relay connections, subscriptions, event publishing, NIP-42 auth, and NIP-77 negentropy sync. It sits below `@welshman/app` (which owns instances of these primitives and wires them together) and depends on `@welshman/util` for event types and `@welshman/lib` for utilities.

**There are no module-level singletons.** `Pool`, `Repository`, `Tracker` and `WrapManager` are plain classes you instantiate; the pool and repository a call should use are passed per call as a `context`. `Pool.get()`, `Repository.get()` and a mutable global `netContext` do not exist.

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

Every entry point (`request`, `requestOne`, `publish`, `publishOne`, `makeLoader`, `diff`/`pull`/`push`) takes an optional `context`. There is no default: without `context.pool` a `wss://` url throws `"Unable to connect to relays without context.pool"`, and without `context.repository` `LOCAL_RELAY_URL` throws `"LOCAL_RELAY_URL cannot be used without context.repository"`. In an app, `app.netContext` is that object and `app.use(Network)` passes it for you.

### Pool & Sockets

| Export | Description |
|--------|-------------|
| `Pool` | Connection pool; creates and manages `Socket` instances per relay url. Construct with `new Pool()` |
| `pool.socketPolicies` | The policies applied to sockets this pool creates — copied from `defaultSocketPolicies` at construction |
| `pool.get(url)` | Gets or lazily creates a `Socket` for a (normalized) relay url |
| `pool.has(url)` | Whether a socket already exists for the url |
| `pool.remove(url)` | Cleans up the socket and forgets the url |
| `pool.clear()` | Removes every socket |
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
| `makeLoader(options)` | Creates a batching `load` function with configurable delay/timeout/threshold |
| `load(options)` | Pre-built loader with a 30 ms batch delay, 3 s timeout and 0.5 threshold. It auto-closes after EOSE, timeout, or disconnect, and resolves when half the relays' subscriptions have closed. It carries no context, so it only works where no pool or repository is needed. |

`request` / `requestOne` options (`BaseRequestOptions`):
- `relay` / `relays` — relay url(s)
- `filters` — array of nostr `Filter` objects
- `autoClose?: boolean` — close the subscription after EOSE or on socket disconnect
- `signal?: AbortSignal` — cancellation
- `tracker?: Tracker` — cross-relay deduplication (shared automatically by `request`)
- `context?: AdapterContext`
- `resubscribeAttempts?: number` — how many times to retry a subscription the relay CLOSEs (default `0`; each retry backs off `2 ** attempt` seconds)
- `isEventValid?: (event, url) => boolean` — signature check override; defaults to `verifyEvent`
- Callbacks: `onEvent(event, url)`, `onEose(url)`, `onClose()`, `onDisconnect(url)`, `onFiltered`, `onDuplicate`, `onDeleted`, `onInvalid`, `onClosed(reason, url)`

`request`-only: `threshold?: number` — fraction of relays that must close before the promise resolves (default `1`).

`makeLoader` options: `{delay, timeout?, threshold?, context?, isEventValid?}`. The returned `Loader` takes `{relays, filters, signal?, onEvent?, onDisconnect?, onEose?, onClose?}`.

Without `autoClose` or a `signal`, `requestOne` streams indefinitely. The returned promise only resolves if the relay sends CLOSED for all active subscription ids.

### Publish

| Export | Description |
|--------|-------------|
| `publish(options)` | Publishes to multiple relays; resolves to `PublishResultsByRelay` |
| `publishOne(options)` | Publishes to a single relay; resolves to `PublishResult` |
| `PublishStatus` | Enum: `Sending`, `Pending`, `Success`, `Failure`, `Timeout`, `Aborted` |
| `PublishResult` | `{status: PublishStatus, detail: string, relay: string}` |
| `PublishResultsByRelay` | `Record<string, PublishResult>` |

`publish` options: `event`, `relays`, `timeout?` (default 10 s), `signal?`, `context?`, plus callbacks `onSuccess`, `onFailure`, `onPending`, `onTimeout`, `onAborted`, `onComplete`.

### Auth (NIP-42)

| Export | Description |
|--------|-------------|
| `AuthState` | Manages auth state for one socket; available as `socket.auth` |
| `AuthStatus` | Enum: `None`, `Requested`, `PendingSignature`, `DeniedSignature`, `PendingResponse`, `Forbidden`, `Ok` |
| `AuthStateEvent.Status` | Emitted when auth status changes |
| `makeSocketPolicyAuth(options)` | Creates a socket policy that auto-handles auth challenges. Options: `{sign, shouldAuth?}` |

### Policies

A `SocketPolicy` is `(socket: Socket) => Unsubscriber`, run once per socket at creation.

| Export | Description |
|--------|-------------|
| `socketPolicyAuthBuffer` | Buffers outgoing messages during auth and replays them once it completes |
| `socketPolicyConnectOnSend` | Auto-opens closed sockets when a message is queued |
| `socketPolicyLifecycle` | Owns the socket's lifetime: closes it after 30 s idle with nothing pending; while work *is* pending, probes with a throwaway REQ when nothing has been received for a while and closes if the probe goes unanswered; on an unexpected close, reopens after a flap delay and replays pending messages, rewriting each REQ's filters with `catchUpFilter` so nothing is missed |
| `defaultSocketPolicies` | `[socketPolicyAuthBuffer, socketPolicyConnectOnSend, socketPolicyLifecycle]` |

`defaultSocketPolicies` is a template. `new Pool()` copies it into `pool.socketPolicies`, so mutating the array after a pool exists does nothing for that pool; assign to `pool.socketPolicies` instead.

### Repository

| Export | Description |
|--------|-------------|
| `Repository` | In-memory indexed event store with delete/expiry support. Construct with `new Repository()` |
| `repository.publish(event, {shouldNotify?})` | Stores an event; returns `false` if duplicate/stale |
| `repository.query(filters, {shouldSort?})` | Returns matching `TrustedEvent[]`, sorted by `created_at` desc unless disabled |
| `repository.getEvent(idOrAddress)` | Look up by id or NIP-01 address (`kind:pubkey:d`) |
| `repository.hasEvent(event)` | Whether the event (or a newer replacement) is already stored |
| `repository.removeEvent(idOrAddress)` | Drops an event and unwinds its index entries |
| `repository.isDeleted(event)` | `true` if a kind-5 delete covers this event (`isDeletedById` / `isDeletedByAddress` check one path each) |
| `repository.isExpired(event)` | `true` past the event's NIP-40 `expiration` |
| `repository.dump()` | All stored events as `TrustedEvent[]` |
| `repository.load(events)` | Bulk-**replaces** all stored events; emits one `"update"` diff. Events with `event[verifiedSymbol] = true` skip signature re-verification |
| `repository.clear()` | Empties every index |
| `LOCAL_RELAY_URL` | `"local://welshman.relay/"` — conventional url for the local repository (also exported by `@welshman/util`) |
| `RepositoryUpdate` | `{added: TrustedEvent[], removed: Set<string>}` — payload of `"update"` events |
| `mergeRepositoryUpdates(updates)` | Merges an array of `RepositoryUpdate` objects into one |

Emits `"update"` with a `RepositoryUpdate` on every change.

> **Prefer `LOCAL_RELAY_URL` over direct repository access.** Rather than calling `repository.query()` or `repository.publish()` directly, pass `LOCAL_RELAY_URL` as a relay url to `load()`, `request()` and `publish()` (with the repository in `context`). Local reads and writes then go through the same policy, deduplication and tracking pipeline as remote ones. Reserve the direct API for bulk startup (`repository.load()`) and low-level introspection (`getEvent`, `isDeleted`, `dump`).

### Tracker

| Export | Description |
|--------|-------------|
| `Tracker` | Bidirectional map of `eventId ↔ Set<relayUrl>` (`relaysById` / `idsByRelay`) |
| `tracker.track(eventId, relay)` | Records the relay; returns `true` if the event was already seen |
| `tracker.addRelay(id, relay)` / `removeRelay(id, relay)` | Explicit edge management |
| `tracker.hasRelay(id, relay)` | Membership check |
| `tracker.getRelays(eventId)` | Set of relay urls that have sent this event |
| `tracker.getIds(relay)` | Set of event ids seen from a relay |
| `tracker.copy(id1, id2)` | Copies relay associations from one id to another (used for gift wraps) |
| `tracker.load(relaysById)` | Bulk-replaces all mappings from a `Map<string, Set<string>>`; emits `"load"` |
| `tracker.clear()` | Removes all mappings; emits `"clear"` |

### Adapters

| Export | Description |
|--------|-------------|
| `getAdapter(url, context?)` | Factory: `context.getAdapter` first, then `LocalAdapter` for `LOCAL_RELAY_URL`, then `SocketAdapter` for relay urls |
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
| `isRelayEvent()`, `isRelayEose()`, `isRelayOk()`, `isRelayAuth()`, `isRelayClosed()`, … | Type guards for relay messages |
| `isClientReq()`, `isClientEvent()`, `isClientClose()`, `isClientAuth()`, … | Type guards for client messages |
| `matchReason(prefix, reason)` / `RelayReasonPrefix` | Match a relay's machine-readable `OK`/`CLOSED` reason prefix (`auth-required:`, `restricted:`, …) |

### WrapManager

| Export | Description |
|--------|-------------|
| `WrapManager` | Tracks NIP-59 gift wrap ↔ rumor relationships. `new WrapManager({tracker, repository})` |
| `wrapManager.add({wrap, rumor, recipient})` | Stores the rumor in the repository and copies the wrap's relay tracking onto it |
| `wrapManager.getRumor(wrapId)` / `getWraps(rumorId)` | Look up either direction |
| `wrapManager.remove(id)` / `removeByRumorId(id)` / `clear()` | Teardown |
| `wrapManager.dump()` / `load(wrapItems)` | Persist and restore (`WrapItem[]`) |

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

### Load events (one-shot, batched)

```typescript
import {makeLoader} from '@welshman/net'

// Bind a loader to the context once; concurrent calls within `delay` collapse
// into a single REQ per relay.
const load = makeLoader({delay: 30, timeout: 3000, threshold: 0.5, context})

const events = await load({
  relays: ['wss://relay.example.com', 'wss://relay2.example.com'],
  filters: [{kinds: [0], authors: ['<pubkey>']}],
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

request({
  relays: ['myscheme://some-id'],
  filters: [{kinds: [1]}],
  autoClose: true,
  context: {
    ...context,
    getAdapter: url => (url.startsWith('myscheme://') ? new MyAdapter(url) : undefined),
  },
})
```

A `getAdapter` that returns `undefined` falls through to the built-in resolution, so you can special-case one scheme and leave the rest alone.

### Use LOCAL_RELAY_URL to read/write the local repository

```typescript
import {publish, request, LOCAL_RELAY_URL} from '@welshman/net'
import {now} from '@welshman/lib'

// Read from the local repository the same way you'd read from a remote relay
const events = await load({
  relays: [LOCAL_RELAY_URL],
  filters: [{kinds: [1], authors: ['<pubkey>'], limit: 20}],
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

### Startup: bulk-load persisted events (skip re-verification)

```typescript
import {verifiedSymbol} from '@welshman/util'
import type {TrustedEvent} from '@welshman/util'

// Mark events as already-verified so welshman skips signature checks
const storedEvents: TrustedEvent[] = await loadFromStorage()
for (const event of storedEvents) {
  event[verifiedSymbol] = true
}

// Replaces all in-memory events in one pass; emits a single "update"
repository.load(storedEvents)
```

### Startup: bulk-load Tracker state

```typescript
// Build the map from your stored relay <-> event mappings
const relaysById = new Map<string, Set<string>>()
for (const {id, relays} of storedTrackerItems) {
  if (repository.getEvent(id)) {  // skip orphaned entries
    relaysById.set(id, new Set(relays))
  }
}

// Takes Map<string, Set<string>> — the same shape as tracker.relaysById
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
- **`@welshman/app`** — an `App` owns one `Pool`, `Repository`, `Tracker` and `WrapManager`, exposes them as `app.netContext`, and wraps the request/publish entry points as `app.use(Network)`. Most app-level code should go through that; drop to `@welshman/net` for raw relay I/O or non-Svelte clients.

---

## Gotchas & Tips

- **Build one `{pool, repository}` per identity and thread it through.** Two contexts never share sockets or events.
- **`request()` without `autoClose` or `signal` never resolves.** Pass one when you want a one-shot fetch; use a loader for the common case.
- **Relay url normalization happens inside `pool.get(url)`** via `normalizeRelayUrl`. Pass raw urls everywhere.
- **`pool.get(url)` creates a fresh socket after `pool.remove(url)`.** `remove` forgets the url and cleans up the socket, policies included; call it only when you want the pool to forget the relay, not merely to disconnect.
- **`socketPolicyLifecycle` reopens a closed socket only when work is pending.** Opening a socket because something was queued is `socketPolicyConnectOnSend`'s job.
- **Subscriptions the relay CLOSEs are not retried by default.** Set `resubscribeAttempts` when a caller should survive a transient refusal (e.g. auth in flight).
- **`Tracker` is shared across relays in `request()`**, so `onDuplicate` fires for events received from more than one relay. That is cross-relay deduplication, not an error.
- **`Repository.publish()` returns `false` for stale replaceable events.** If a newer version is already stored, the older one is silently dropped.
- **`makeSocketPolicyAuth` requires a `sign` function** returning `Promise<SignedEvent>`. If the user cancels, throw or reject: `doAuth` catches it and transitions to `AuthStatus.DeniedSignature`, preventing a retry loop.
- **Each filter in `filters` generates a separate REQ** inside `requestOne`. For large filter arrays merge them with `unionFilters` from `@welshman/util` first.
- **`repository.load()` replaces, it does not append.** It clears the indexes then re-inserts, emitting a single batched `"update"`. Use `repository.publish(event)` for incremental updates.
- **`RepositoryUpdate.removed` is a `Set<string>`.** Iterate with `for...of` or `Array.from`. `batch()` from `@welshman/lib` hands your callback a `RepositoryUpdate[]` — merge them yourself or use `mergeRepositoryUpdates`.
- **`tracker.load()` takes `Map<string, Set<string>>`.** Load it after `repository.load()` so you can drop orphaned event ids.

## Related skills

- `welshman-app` — the instance-based layer that owns these primitives (`app.netContext`, `app.use(Network)`, `app.use(Sync)`).
- `welshman-store` — Svelte derivations over a `Repository` and `Tracker`.
- `welshman-util` — the event, filter and relay-url types on the wire, and the routing DSL for choosing which urls to pass to these functions.
