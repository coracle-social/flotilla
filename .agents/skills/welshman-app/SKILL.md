---
name: welshman-app
description: "Use this skill when working with @welshman/app: the instance-based client for building nostr applications — creating an App instance, the use() plugin registry, User & sessions, reactive data stores (profiles, follows, mutes, relay lists, handles, zappers), optimistic publishing with thunks, outbox-model requests, routing, web of trust, feeds, and search."
---

# welshman/app — Instance-Based Nostr App

## Overview

`@welshman/app` is the high-level app layer of welshman. It ties `util`, `net`, `store`, `domain`, `signer`, and `feeds` together behind a single **`App`** instance. Everything — the event repository, connection pool, the signed-in user, and all features — hangs off that instance. There are **no module-level globals**: you create an app and reach everything through `app.use(...)`.

## Installation

```bash
npm install @welshman/app
# or
pnpm add @welshman/app
yarn add @welshman/app
```

Peer deps: `svelte` (4 or 5), all `@welshman/*` workspace packages, and `@pomade/core`.

## Core mental model

1. **An app is an `App` instance.** It owns per-identity state (`repository`, `pool`, `tracker`, `wrapManager`), a `config`, and at most one `User`. Two apps never share data.
2. **Features are plugins**, resolved lazily and memoized via `app.use(SomeClass)`. Each plugin is constructed with the app and cached per app.
3. **`Projection<T>` is the universal accessor.** It has `.get()` (sync snapshot) and `.$` (Svelte `Readable`). Bind `.$` in components; call `.get()` in callbacks/hot paths.
4. **Reads are reactive and lazy-loading.** `app.use(Profiles).one(pubkey)` returns a store that fetches over the network (outbox model) and updates as events arrive.
5. **Writes are optimistic.** Publishing goes through *thunks*: the event hits the local repository immediately, signs lazily, and reports per-relay progress, with an abortable delay for soft-undo.

## Creating an app

```typescript
import {createApp} from "@welshman/app"

// Batteries-included: installs default policies (event ingestion, relay stats,
// gift-wrap unwrapping, NIP-42 auth-unless-blocked).
const app = createApp({
  user,                                    // optional User
  config: {
    dufflepudUrl: "https://dufflepud.example",   // optional: batches NIP-05/zapper lookups
    getDefaultRelays: () => [...],
    getIndexerRelays: () => [...],         // discovery relays for profiles/relay lists
    getSearchRelays: () => [...],          // NIP-50 search relays
  },
})

// Bare app with NO side effects (tests, or custom policies):
import {App} from "@welshman/app"
const bare = new App()

// Always tear down when discarding an app (e.g. switching identities):
app.cleanup()
```

`AppOptions` is `{user?, config?, getAdapter?, policies?}`, `AppConfig` is the `config` field above, and `AppPolicy` is `(app: IApp) => Unsubscriber`.

`IApp` (what plugins/policies depend on): `{user?, config, use, onCleanup, netContext, pool, tracker, repository, wrapManager}`. A plugin registers teardown with `app.onCleanup(unsubscriber)`; `app.cleanup()` runs them in reverse, then clears the pool, tracker, repository and wrap manager.

## User & sessions

A `User` is `{pubkey, signer}`. A `Session` is a serializable `{method, data}` descriptor you persist; session handlers turn it back into a signer.

```typescript
import {createApp, User, toSession, nip07} from "@welshman/app"
import {getNip07} from "@welshman/signer"

// Build a User from a live signer...
const user = await User.fromSigner(getNip07())

// ...or from a persisted session
const session = toSession(nip07, {})                  // serializable, store this
localStorage.setItem("session", JSON.stringify(session))
const restored = await User.fromSession(JSON.parse(localStorage.getItem("session")!))  // User | undefined

const app = createApp({user: restored})

// Gate user-only actions (throws if no user):
const u = User.require(app)
await u.sign(stampedEvent)
await u.nip44EncryptToSelf(payload)        // encrypt to self (private list entries)
```

Built-in session handlers (auto-registered): `nip01` `{secret}`, `nip07` `{}`, `nip46` `{clientSecret, signerPubkey, relays}`, `nip55` `{pubkey, signer}`, `pomade` `{clientOptions, email}`. Register custom ones with `defineSessionHandler` + `registerSessionHandler`.

`nip55` additionally needs the Capacitor plugin passed to `@welshman/signer` once at startup, or building its signer throws `"Nip55 is not enabled"`:

```ts
import {NostrSignerPlugin} from "nostr-signer-capacitor-plugin"
import {setNip55Plugin} from "@welshman/signer"

setNip55Plugin(NostrSignerPlugin)
```

## Data plugins (reactive collections)

All follow the same shape — `get(key)` (sync), `one(key)` (reactive, lazy-loads), `load(key)`/`forceLoad(key)` (promises), plus convenience accessors returning `Projection`. Resolve with `app.use(...)`.

Every mutation method (`create`/`update`/`follow`/`addRelay`/`setRelays`/etc.) is `async` and returns a **`Command`**, not a `Thunk` — it builds the event but does not publish it. Call `.publish()` (or `.publishAsRelay(url)`) on the result to actually send it. See [Commands](#commands-deferred-publishing) below.

| Plugin | Data | Notable accessors |
|---|---|---|
| `Profiles` | kind-0 profiles | `display(pk)`, `update(fn)` → `Command`; `profileSearch` |
| `FollowLists` | kind-3 follows | `follow(pk, hint?, petname?)`, `unfollow(pk)`, `update(fn)` → `Command` |
| `MuteLists` | kind-10000 mutes (private = encrypted) | `mutePublicly(tag)`, `mutePrivately(tag)`, `unmute(v)`, `setMutes(...)` → `Command` |
| `PinLists` | kind-10001 pins | `pin(tag)`, `unpin(value)` → `Command` |
| `RelayLists` | NIP-65 (kind 10002) | `urls(pk)`, `readUrls(pk)`, `writeUrls(pk)`, `addReadUrl`/`addWriteUrl`, `removeReadUrl`/`removeWriteUrl`, `setReadUrls`/`setWriteUrls` → `Command` |
| `BlockedRelayLists` | kind-10006 | `urls(pk)`, `addUrl`, `removeUrl`, `setUrls` → `Command` |
| `MessagingRelayLists` | kind-10050 (NIP-17 DM relays) | `urls(pk)`, `addUrl`, `removeUrl`, `setUrls` → `Command` |
| `SearchRelayLists` | kind-10007 | `urls(pk)`, `addUrl`, `removeUrl`, `setUrls` → `Command` |
| `BlossomServerLists` | kind-10063 media servers | `urls(pk)`, `addUrl`, `removeUrl`, `setUrls` → `Command` |
| `FeedLists` | kind-10014 saved-feed lists | list accessors + `update(fn)` → `Command` |
| `RoomLists` | kind-10009 room lists | `addRoom`/`removeRoom`/`addRelay`/`removeRelay`/`setRelays` → `Command` |
| `Feeds` | kind-31890 saved feeds (keyed by address) | `forAuthor(pk)`, `loadForAuthor(pk)`, `create(fields)`, `update(addr, fn)` → `Command`; `makeFeedController(...)` |
| `Pinboards` | kind-30067 pinboards (many per author, keyed by address) | `forAuthor(pk)`, `loadForAuthor(pk)`, `create(fields)`, `update(addr, fn)` → `Command` |
| `Pins` | kind-39067 pins (keyed by address; each pin has its own `d` tag) | `forBoard(addr)`, `forProfile(pk)`, `loadForBoard(addr)`, `loadForProfile(pk)`, `create`, `update`, `addToBoard`, `removeFromBoard` → `Command` |
| `Relays` | NIP-11 relay info (HTTP) | `display(url)`, `hasNip(url, n)`, `hasNegentropy(url)`; `relaySearch` |
| `RelayManagement` | NIP-86 mgmt API | `forUrl(url)` → a `ManagementApi` client that signs auth as the app's user (`forUrl(url).signEvent(event)`, role/member ops, …) |
| `RelayStats` | per-relay connection counters | `get(url)`, `getQuality(url)` (0–1, drives router ranking) |
| `RelayRoles` / `RelayMemberLists` / `RoomPinLists` | relay-signed state, keyed per relay | relay-scoped collections (see `RelaySignedDerivedPlugin`) |
| `Handles` | NIP-05 (HTTP, batched) | `forPubkey(pk)`, `display(nip05)`, `loadForPubkey(pk)` |
| `Zappers` | LNURL zapper info (HTTP) | `forPubkey(pk)`, `validateZapReceipt(...)`, `validateZapReceipts(...)`, `validZapReceipts(...)` |
| `Topics` | hashtags w/ counts | `all`, `byName` (`Projection`s); `topicSearch` |
| `Reactions` / `Deletes` | kind-7 reactions and kind-5 deletes over the repository | reactive lookups |
| `Rooms` | NIP-29 rooms, keyed `${url}'${h}` | `forRoom(url, h)`, `forUrl(url)`, `members(url, h)`, `membershipStatus(...)`, `pendingJoins(url, h?)`, `createRoom`/`editRoom`/`deleteRoom`/`joinRoom`/`leaveRoom`/`addMember`/`removeMember(url, room, …)` → `Command` |
| `Plaintext` | decrypted-content cache, keyed by ciphertext | `ensure(ciphertext, decrypt)`, `get(ciphertext)` |

```typescript
import {createApp, Profiles, RelayLists} from "@welshman/app"
const app = createApp({user})

// Reactive (Svelte): subscribe or use $ in a component
const profile$ = app.use(Profiles).one(pubkey)        // Readable<Maybe<Profile>>, lazy-loads
const name$    = app.use(Profiles).display(pubkey).$   // Readable<string>

// Synchronous snapshot (no load)
const profileNow = app.use(Profiles).get(pubkey)

// Explicit load
await app.use(Profiles).load(pubkey)

// Relay selections (outbox model)
const writeRelays = app.use(RelayLists).writeUrls(pubkey).get()  // string[]

// Mutations return a Command — build it, then decide how to publish it
const command = await app.use(RelayLists).addWriteUrl("wss://relay.example")
command.publish()                              // normal outbox/relays flow via Thunks
// or: command.publishAsRelay("wss://relay.example")   // sign + send straight to one relay (NIP-86 style)

// Since these methods are async, `publish`/`publishAsRelay` free functions avoid a double-await:
import {publish} from "@welshman/app"
await app.use(RelayLists).addWriteUrl("wss://relay.example").then(publish)
```

## Publishing (optimistic thunks)

```typescript
import {Thunks, Router} from "@welshman/app"
import {makeEvent, NOTE, userOutbox} from "@welshman/util"

// There's no dedicated outbox helper on Thunks — resolve write relays yourself via the
// Router's Resolver + the RelaySelection DSL (this is what Command.publish() does under the
// hood for every data-plugin mutation, whose `relays` come from the writer's own routes):
const thunk = app.use(Thunks).publish({
  event: makeEvent(NOTE, {content: "hi"}),
  relays: await app.use(Router).resolver.relays([userOutbox()]),   // Promise<string[]>
  delay: 3000,                  // abortable soft-undo window (ms)
})

// To specific relays:
app.use(Thunks).publish({event, relays: ["wss://relay.example"]})

// A thunk is a Svelte store with per-relay status:
thunk.subscribe(t => console.log(t.results))
thunk.abort()                                 // effective only before `delay` elapses
await thunk.waitForCompletion()
thunk.getError()                              // string | undefined
app.use(Thunks).history                       // writable<Thunk[]> — optimistic log
app.use(Thunks).retry(thunk)

// Gift-wrapped (NIP-59): single recipient via `recipient`, or many via Wraps:
app.use(Thunks).publish({event, relays, recipient: theirPubkey})
const merged = await app.use(Wraps).publish({event: rumor, recipients: [a, b]})

// Proof of work (NIP-13):
app.use(Thunks).publish({event, relays, pow: 20})
```

`ThunkOptions`: `{event, relays?, recipient?, delay?, pow?, ...PublishOptions}` (`app` is injected). Incoming wraps addressed to the user are auto-unwrapped by the default `appPolicyWraps`.

## Commands (deferred publishing)

Data-plugin mutation methods (`create`, `update`, `follow`, `addRelay`, `setRelays`, `Rooms.*`, …) don't publish — they build the `EventTemplate` and the relays it would go to, and hand back a **`Command`** for you to decide what to do with:

```typescript
import type {Command} from "@welshman/app"

const command: Command = await app.use(FollowLists).follow(["p", otherPubkey])

command.app      // the IApp it was built for
command.event    // EventTemplate — unsigned, inspectable before publishing
command.relays   // string[] — where publish() will send it

command.publish()               // normal path: app.use(Thunks).publish({event, relays: command.relays})
command.publishToRelays(urls)   // publish to a specific relay set instead of command.relays
command.publishAsRelay(url)     // NIP-86: the relay signs the event with its own key
                                // (signevent), then publish the relay-signed event back to `url`
command.signAsRelay(url)        // just the NIP-86 signevent step (returns {result, error})
```

This lets a caller preview/log a command, choose a different transport, or drop it entirely, instead of every plugin method publishing unconditionally. `Wraps.publish` is the one exception — it fans a single rumor out to a `MergedThunk` of per-recipient wraps (each with its own relays), which doesn't fit the one-event/one-relay-set `Command` shape, so it still publishes directly.

`publish`/`publishToRelays`/`publishAsRelay`/`signAsRelay` are also exported as free functions (e.g. `(command) => command.publish()`, `(url) => (command) => command.publishAsRelay(url)`) so you can chain straight off the mutation method's promise instead of double-awaiting:

```typescript
import {publish, publishAsRelay} from "@welshman/app"

await app.use(FollowLists).follow(["p", otherPubkey]).then(publish)
await app.use(Rooms).leave(relayUrl, roomMeta).then(publish)
await app.use(Rooms).join(relayUrl, roomMeta).then(publishAsRelay(relayUrl))
```

## Requests & sync

```typescript
import {Network, Sync} from "@welshman/app"
const net = app.use(Network)

const events = await net.load({filters: [{kinds: [1], authors: [pk]}], relays})
await net.request({filters, relays, autoClose: true})

// Outbox-model author load (resolves the author's write relays automatically).
// loadUsingOutbox returns the newest matching event; loadAllUsingOutbox returns them all.
const profileEvent = await net.loadUsingOutbox(pk, {kinds: [0]})
const allFeeds     = await net.loadAllUsingOutbox(pk, {kinds: [31890]})

// A loader with different batching, still bound to this app's net context:
const slowLoad = net.makeLoader({delay: 500, timeout: 5000, threshold: 0.5})

// Negentropy-aware reconciliation (falls back to request/publish when unsupported):
await app.use(Sync).pull({relays, filters: [{authors: [pk]}]})
await app.use(Sync).push({relays, filters: [{authors: [pk]}]})
```

## Querying the repository (`Events`)

`Network` fetches; `Events` reads what's already local. Every method binds this app's repository
and tracker and returns a `Projection` — `.get()` for a snapshot, `.$` to subscribe — so there's no
get/derive pair to keep in sync.

```typescript
import {Events} from "@welshman/app"
const events = app.use(Events)

events.byId(filters).$           // Map<id, TrustedEvent>
events.all(filters).$            // repository order
events.asc(filters).$            // oldest first
events.desc(filters).$           // newest first
events.one(idOrAddress, hints)   // one event, loaded on first read if missing
events.isDeleted(event).$

// Scoped to a relay, via the tracker
events.byIdForUrl(url, filters).$
events.forUrl(url, filters).$
events.byIdByUrl(filters).$              // Map<url, Map<id, TrustedEvent>>
events.relaySignedForUrl(url, filters).$ // only what the relay itself signed
```

`relaySignedForUrl` is the loose counterpart to `RelaySignedDerivedPlugin` — relay-generated kinds
mean nothing from another author, so anything not signed by the relay's NIP-11 `self` is dropped.

## Routing & tags

`app.use(Router)` turns the declarative **`RelaySelection`** DSL (from `@welshman/util`) into scored relay urls. It exposes a `Resolver` (`router.resolver`) plus a `resolve(selections)` shortcut. That same `resolver` is injected into every `@welshman/domain` kind by `app.use(Domain)`, so writers/readers route through it too.

```typescript
import {Router} from "@welshman/app"
import {userOutbox, outbox, seen, relay, addMinimalFallbacks} from "@welshman/util"

const router = app.use(Router)                // per-app; NOT Router.get()

// resolver.relays(...) -> Promise<string[]>; resolver.relay(...) -> Promise<string | undefined>
const writeRelays = await router.resolver.relays([userOutbox()])
const hint        = await router.resolver.relay([seen({id: event.id})])

// resolve(...) -> Promise<RelayScenario>; then tune fallbacks/limit and read urls
const relays = (await router.resolve([userOutbox()])).policy(addMinimalFallbacks).limit(8).getUrls()

// DSL selectors: userInbox/userOutbox/userMessaging, inbox(pk)/outbox(pk)/messaging(pk),
// inboxes(pks), eventInbox(ref)/eventOutbox(ref), seen(ref), relay(url)/relays(urls),
// indexers(), searchRelays() — each returns a RelaySelection (relays/inboxes return arrays).
```

Event tagging (reply/quote/reaction threading, p-tags, zap splits) now lives on the domain **writers** — `writer.tagPubkey(pk)`, `writer.addQuote(event)`, `writer.addZapSplit(pk)`, and kind-specific setters like `NoteWriter.setParent(parentEvent)` — not on a separate `Tags` plugin. See the `welshman-domain` skill.

`Router` is the one `ResolveRoute` implementation in the stack. It resolves each route against the app:

- **inbox / outbox** — `app.use(RelayLists).load(pubkey)` then `readUrls()` / `writeUrls()` (NIP-65, kind 10002).
- **messaging** — `app.use(MessagingRelayLists).load(pubkey)` (kind 10050).
- **eventInbox / eventOutbox** — a known `ref.pubkey` routes directly; otherwise `ref.id` is looked up in the repository to find the author. `ref.relays` are always included.
- **seen** — `app.tracker.getRelays(ref.id)`, or for a replaceable `ref` the tracker entry of the event at its address, plus `ref.relays`.
- **index / search** — `app.config.getIndexerRelays?.()` / `getSearchRelays?.()`.

When `app.user` is undefined, `user*` routes resolve to no relays rather than throwing.

`Router` also satisfies `@welshman/feeds`' `FeedRouter` interface, which is how `app.use(Feeds).makeFeedController(...)` routes a feed's filters.

### Relay quality

The resolver ranks relays by `app.use(RelayStats).getQuality(url)`, 0–1:

| Score | Condition |
|---|---|
| `0` | not a relay url, blocked by the user's kind-10006 list, or recently error-prone (any error in the last minute, >3 in an hour, >10 in a day) |
| `1` | already in the pool |
| `0.9` | connected at some point before |
| `0.8` | a normal `wss://` url with no history |
| `0.7` | an IP, local, onion, or plain-`ws://` url with no history |

A relay scoring `0` is dropped from the scenario's result entirely rather than deprioritized, so a scenario can come back empty even though its selections resolved to urls.

The DSL constructors, `RelayScenario` scoring and the fallback policies are documented in the `welshman-util` skill.

## Web of trust

Built from the **public** `p` tags on follow (kind 3) and mute (kind 10000) lists as they land in the repository. Every read is a `Projection` (`.get()` / `.$`), and reads *about* a pubkey take a `WotScope`:

- `WotScope.Global` — counts every list in the repository.
- `WotScope.Follows` — counts only lists published by the user's own follows, i.e. the pubkey as this user sees it. With no signed-in user it falls back to global.

```typescript
import {Wot, WotScope} from "@welshman/app"

const wot = app.use(Wot)

wot.follows(pk).get()                        // string[] — who pk follows
wot.mutes(pk).get()                          // string[] — who pk mutes
wot.followers(pk, WotScope.Follows).get()    // string[]
wot.muters(pk, WotScope.Follows).get()       // string[]
wot.score(pk, WotScope.Follows).get()        // number — followers − muters, within scope
wot.network(pk).get()                        // follows-of-follows (minus direct follows)
wot.scores(WotScope.Follows).get()           // Map<pubkey, score> — the whole picture at once
```

Use `scores(scope)` when ranking a list (search results, a WoT range); it walks the graph once instead of once per pubkey.

## Feeds & search

```typescript
import {makeIntersectionFeed, makeScopeFeed, makeKindFeed, Scope} from "@welshman/feeds"
import {get} from "svelte/store"

const controller = app.use(Feeds).makeFeedController({
  feed: makeIntersectionFeed(makeScopeFeed(Scope.Follows), makeKindFeed(1)),
  onEvent: event => {/* render */},
})
await controller.load(50)              // scopes (Self/Follows/Network/Followers) resolved via Wot

// Search lives on the collection that owns the data. There is no Searches plugin.
const search = get(app.use(Profiles).profileSearch)
const pubkeys = search.searchValues("alice")   // also fires a NIP-50 network search; ranked by WoT
// also: app.use(Topics).topicSearch, app.use(Relays).relaySearch
// createSearch(options, {...}) builds a custom index over anything else
```

## Plugin architecture (for extending)

Base classes in `plugins/base.ts`:

- **`DerivedPlugin<T>`** — collection derived from repository events (the repo is the single source of truth). Pass `{filters, eventToItem, getKey, loadOptions?}`; implement `fetch`. This is the dominant pattern. Gives you `index`/`all` (`Projection`s), `get(key)`, `one(key)`, `load`/`forceLoad`, and `project(key, read)`.
- **`RelayScopedDerivedPlugin<T>`** — the same, keyed per relay via the tracker (`getKey(item, url)`), so the same addressable coordinate on two relays stays two entries. `RelaySignedDerivedPlugin` (in `plugins/relays.ts`) narrows it further to events signed by the relay's own NIP-11 `self` key, which is what `RelayRoles`, `RelayMemberLists` and `RoomPinLists` use.
- **`LoadableMapPlugin<T>`** — owns its own `Map`, lazily fetches over HTTP (e.g. `Relays`, `Handles`, `Zappers`). Implement `fetch`.
- **`MapPlugin<T>`** — owns its own `Map`, no network (e.g. `RelayStats`, `Plaintext`).

Decode events with the app-configured `@welshman/domain` reader (`app.use(Domain).reader(Kind)`) as `eventToItem`, and mutate through `app.use(Domain).writer(Kind, reader?)` + `app.use(Domain).command(writer)`:

```typescript
import {DerivedPlugin, Network, Domain, User, type IApp} from "@welshman/app"
import {SOME_KIND} from "@welshman/util"
import {SomeKind, SomeKindReader, SomeKindWriter} from "@welshman/domain"

export class Somethings extends DerivedPlugin<SomeKindReader> {
  constructor(app: IApp) {
    super(app, {
      filters: [{kinds: [SOME_KIND]}],
      eventToItem: app.use(Domain).reader(SomeKind),   // async: validates kind + parses
      getKey: item => item.author(),
    })
  }

  fetch = (pk: string, hints: string[] = []) =>
    this.app.use(Network).loadUsingOutbox(pk, {kinds: [SOME_KIND]}, hints)

  // Build a writer (optionally seeded from the current reader for edits), mutate it, then
  // wrap it in a Command via Domain.command — the caller decides when/how to publish.
  update = async (fn: (writer: SomeKindWriter) => void) => {
    const user = User.require(this.app)
    const writer = this.app.use(Domain).writer(SomeKind, await this.forceLoad(user.pubkey))

    fn(writer)

    return this.app.use(Domain).command(writer)
  }
}

const things = app.use(Somethings)   // lazily constructed + memoized
```

Caching/backoff for `load` come from `makeLoadItem` (`@welshman/store`); default staleness window is 1 hour; `forceLoad` bypasses it.

## Policies & logging

Side effects live in `AppPolicy`s (`(app) => Unsubscriber`), run at construction, cleaned up by `cleanup()`.

- `defaultAppPolicies` = `[appPolicyIngest, appPolicyRelayStats, appPolicyWraps, appPolicyCacheDecrypt, appPolicyLogSignerMethods, appPolicyAuthUnlessBlocked]`.
- Auth builders: `makeAppPolicyAuth(shouldAuth)`, `appPolicyAuthAlways`, `appPolicyAuthNever`, `appPolicyAuthUnlessBlocked`.
- `appPolicyCacheDecrypt` and `appPolicyLogSignerMethods` both layer onto the user's signer via `User.wrapSigner` — the first caches decryptions into `app.use(Plaintext)`, the second records signer calls into `app.use(Logger)` (read them from `app.use(Logger).messages`).

```typescript
// Opt out of a default, or add your own:
import {App, defaultAppPolicies, appPolicyAuthNever, appPolicyIngest} from "@welshman/app"

const app = new App({user, policies: [appPolicyIngest, appPolicyAuthNever]})
```

## Gotchas & tips

- **`use()` is memoized per app.** `app.use(Profiles)` always returns the same instance for a given app. Cheap to call repeatedly.
- **`Projection` vs `Readable`.** Convenience accessors (`display`, `urls`, `score`, …) return a `Projection` — use `.$` for the store, `.get()` for a snapshot. `one(key)` returns a plain `Readable` (and triggers a load on subscribe).
- **`get(key)` does not load; `one(key)`/`load(key)` do.** Use `get` for a pure cache read.
- **Most loads use the outbox model**, which needs the author's relay list. `loadUsingOutbox` (and therefore most `fetch` methods) first loads NIP-65 relays for the author.
- **`createApp` vs `new App`.** `createApp` installs default policies; `new App` installs none. In tests prefer `new App` (no background subscriptions) unless you need ingestion.
- **Pass the `user` to `createApp`/`new App`, don't assign `app.user` afterwards.** Policies run once, at construction. `appPolicyCacheDecrypt` and `appPolicyLogSignerMethods` bail out immediately when there is no user, so a user attached later gets no decrypt caching and no signer log. To switch identities, build a new app and `cleanup()` the old one.
- **Call `cleanup()`** when discarding an app to close sockets and free the repository/tracker/wrap state.

## Old API → new API

| Old (global) | New (instance-based) |
|---|---|
| `addSession(...)` / `pubkey.get()` | `User.fromSession(...)` + `createApp({user})`; `app.user?.pubkey` |
| `deriveProfile(pk)` | `app.use(Profiles).one(pk)` |
| `deriveProfileDisplay(pk)` | `app.use(Profiles).display(pk).$` |
| `publishThunk({...})` | `app.use(Thunks).publish({...})` (resolve outbox relays via `await app.use(Router).resolver.relays([userOutbox()])`) |
| `follow(tag)` / `mute(tag)` | `app.use(FollowLists).follow(tag).then(publish)` / `app.use(MuteLists).mutePublicly(tag).then(publish)`, which return a [`Command`](#commands-deferred-publishing) |
| `load({...})` / `request({...})` | `app.use(Network).load({...})` / `request({...})` |
| `Router.get().FromUser()` / `router.Event(e)` | `app.use(Router).resolver` + the `RelaySelection` DSL (`resolver.relays([userOutbox()])`, `resolver.relay([seen(e)])`) |
| `app.use(Tags).tagEventForReply(e)` | domain writer tagging (`NoteWriter.setParent(e)`, `writer.tagPubkey/addQuote/addZapSplit`) |
| `relays` / `handles` / `zappers` stores | `app.use(Relays)` / `Handles` / `Zappers` |
| `app.use(Searches).profileSearch` | `app.use(Profiles).profileSearch` (likewise `Topics.topicSearch`, `Relays.relaySearch`) |
| `wot.graph` / `wot.wotScore(a, b)` | `app.use(Wot).scores(WotScope.Follows)` / `.score(pk, scope)` |
| `RelayLists.addRelay(url, mode)` | `RelayLists.addReadUrl(url)` / `addWriteUrl(url)` |

## Related skills

- `welshman-store` — the `Repository` and Svelte-store primitives this layer builds on.
- `welshman-domain` — the `Kind`/reader/writer model behind `app.use(Domain)` (event decoding + publishing).
- `welshman-util` — the `RelaySelection` DSL, `Resolver` and `RelayScenario` that `app.use(Router)` dereferences.
- `welshman-net` — request/publish/sockets behind `app.use(Network)`.
- `welshman-signer` — signers and login methods used by `User`/sessions.
- `welshman-feeds` — feed construction used by `app.use(Feeds)`.
