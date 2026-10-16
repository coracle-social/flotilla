---
name: welshman-app
description: "Use this skill when working with @welshman/app: the instance-based client for building nostr applications — creating an App instance, the use() plugin registry, User & sessions, reactive data stores (profiles, follows, mutes, relay lists, handles, zappers), optimistic publishing through a staged pipeline, outbox-model requests, routing, web of trust, feeds, and search."
---

# welshman/app — Instance-Based Nostr App

## Overview

`@welshman/app` is the high-level app layer of welshman. It ties `util`, `net`, `store`, `domain`, `signer`, and `feeds` together behind an **`App`** instance. The event repository, connection pool, signed-in user, and every feature hang off that instance, and features are reached through `app.use(...)`.

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
3. **`Projection<T>` is the universal accessor.** It has `.get()` (sync snapshot) and `.$` (Svelte `Readable`), and is a store itself, so `derived(p, ...)` works too. Bind `.$` in components; call `.get()` in callbacks/hot paths. It comes from `@welshman/store`, along with `projection` and `projectFrom`.
4. **Reads are reactive and lazy-loading.** `app.use(Profiles).one(pubkey)` returns a store that fetches over the network (outbox model) and updates as events arrive.
5. **Writes are optimistic.** Publishing goes through the `Publisher` pipeline: the event hits the local repository immediately, signs lazily, and reports per-relay progress, with an abortable delay for soft-undo.

## Creating an app

```typescript
import {createApp} from "@welshman/app"

// Installs defaultAppPolicies (see Policies & logging below).
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

Every mutation method (`create`/`update`/`follow`/`addRelay`/`setRelays`/etc.) is `async` and returns a **`Command`**, not a `Publication` — it builds the event but does not publish it. Call `.publish()` on the result to actually send it. See [Commands](#commands-deferred-publishing) below.

| Plugin | Data | Notable accessors |
|---|---|---|
| `Profiles` | kind-0 profiles | `display(pk)`, `update(fn)` → `Command`; `profileSearch` |
| `FollowLists` | kind-3 follows | `follow(tag)`, `unfollow(value)`, `update(fn)` → `Command` |
| `MuteLists` | kind-10000 mutes (private = encrypted) | `mutePublicly(tag)`, `mutePrivately(tag)`, `unmute(v)`, `setMutes(...)` → `Command` |
| `PinLists` | kind-10001 pins | `pin(tag)`, `unpin(value)` → `Command` |
| `BookmarkLists` | kind-10003 bookmarks (private = encrypted) | `bookmarkPublicly(tag)`, `bookmarkPrivately(tag)`, `removeBookmark(v)`, `update(fn)` → `Command` |
| `BookmarkSets` | kind-30003 bookmark sets (many per author, keyed by address) | `forAuthor(pk)`, `loadForAuthor(pk)`, `create(fields)`, `update(addr, fn)` → `Command` |
| `RelayLists` | NIP-65 (kind 10002) | `urls(pk)`, `readUrls(pk)`, `writeUrls(pk)`, `addReadUrl`/`addWriteUrl`, `removeReadUrl`/`removeWriteUrl`, `setReadUrls`/`setWriteUrls` → `Command` |
| `BlockedRelayLists` | kind-10006 | `urls(pk)`, `addUrl`, `removeUrl`, `setUrls` → `Command` |
| `MessagingRelayLists` | kind-10050 (NIP-17 DM relays) | `urls(pk)`, `addUrl`, `removeUrl`, `setUrls` → `Command` |
| `SearchRelayLists` | kind-10007 | `urls(pk)`, `addUrl`, `removeUrl`, `setUrls` → `Command` |
| `BlossomServerLists` | kind-10063 media servers | `urls(pk)`, `addUrl`, `removeUrl`, `setUrls` → `Command` |
| `FeedLists` | kind-10014 saved-feed lists | `addresses(pk)`, `addFeed`/`addFeedPrivately`/`removeFeed`, `update(fn)` → `Command` |
| `RoomLists` | kind-10009 room lists | `addRoom`/`removeRoom`/`addRelay`/`removeRelay`/`setRelays` → `Command` |
| `Feeds` | kind-31890 saved feeds (keyed by address) | `forAuthor(pk)`, `loadForAuthor(pk)`, `create(fields)`, `update(addr, fn)` → `Command`; `makeFeedController(...)` |
| `Pinboards` | kind-30067 pinboards (many per author, keyed by address) | `forAuthor(pk)`, `loadForAuthor(pk)`, `create(fields)`, `update(addr, fn)` → `Command` |
| `Pins` | kind-39067 pins (keyed by address; each pin has its own `d` tag) | `forBoard(addr)`, `forProfile(pk)`, `loadForBoard(addr)`, `loadForProfile(pk)`, `create`, `update`, `addToBoard`, `removeFromBoard` → `Command` |
| `Relays` | NIP-11 relay info (HTTP) | `display(url)`, `hasNegentropy(url)`; check a NIP on the loaded `Relay` with `relay.hasNip(n)`; `relaySearch` |
| `Notify` | Latest `NOTIFY` per relay url | `one(url)`, `get(url)` -> `{url, message, receivedAt}` |
| `RelayManagement` | NIP-86 mgmt API | `forUrl(url)` → a `ManagementApi` client that signs auth as the app's user (role/member ops, ban/allow, …) |
| `RelayStats` | per-relay connection counters | `get(url)`, `getQuality(url)` (0–1, drives router ranking) |
| `RelayRoles` / `RelayMemberLists` / `RoomPinLists` | relay-signed state, keyed per relay | relay-scoped collections (see `RelaySignedDerivedPlugin`) |
| `Handles` | NIP-05 (HTTP, batched) | `forPubkey(pk)`, `display(nip05)`, `loadForPubkey(pk)` |
| `Zappers` | LNURL zapper info (HTTP) | `forPubkey(pk)`, `validateZapReceipt(...)`, `validateZapReceipts(...)`, `validZapReceipts(...)` |
| `Topics` | hashtags w/ counts | `all`, `byName` (`Projection`s); `topicSearch` |
| `Reactions` / `Deletes` | kind-7 reactions and kind-5 deletes (no collection; read them with `Events`) | `react(event, content, fn?)` / `deleteEvent(event, fn?)` → `Command` |
| `Rooms` | NIP-29 rooms, keyed `${url}'${h}` | `forRoom(url, h)`, `forUrl(url)`, `members(url, h)`, `membershipStatus(...)`, `pendingJoins(url, h?)`, `createRoom`/`editRoom`/`deleteRoom`/`joinRoom`/`leaveRoom`/`addMember`/`removeMember`/`deleteEvent(url, room, …)` → `Command` |
| `Plaintext` | decrypted-content cache, keyed by ciphertext; concurrent callers share one decrypt | `ensure(ciphertext, decrypt)`, `get(ciphertext)` |

```typescript
import {createApp, Profiles, RelayLists} from "@welshman/app"
const app = createApp({user})

// Reactive (Svelte): subscribe or use $ in a component
const profile$ = app.use(Profiles).one(pubkey)        // Readable<Maybe<ProfileReader>>, lazy-loads
const name$    = app.use(Profiles).display(pubkey).$   // Readable<string>

// Synchronous snapshot (no load)
const profileNow = app.use(Profiles).get(pubkey)

// Explicit load
await app.use(Profiles).load(pubkey)

// Relay selections (outbox model)
const writeRelays = app.use(RelayLists).writeUrls(pubkey).get()  // string[]

// Mutations return a Command — build it, then decide how to publish it
const command = await app.use(RelayLists).addWriteUrl("wss://relay.example")
command.publish()                              // normal outbox/relays flow via Publisher
// or: command.publishToRelays(["wss://relay.example"])  // send straight to one relay

// Since these methods are async, `publish`/`publishToRelays` free functions avoid a double-await:
import {publish} from "@welshman/app"
await app.use(RelayLists).addWriteUrl("wss://relay.example").then(publish)
```

## Publishing (optimistic pipeline)

```typescript
import {Publisher, Router} from "@welshman/app"
import {makeEvent, NOTE, userOutbox} from "@welshman/util"

// Publisher takes explicit relays. Resolve the user's write relays with the Router:
const publication = app.use(Publisher).publish({
  event: makeEvent(NOTE, {content: "hi"}),
  relays: await app.use(Router).resolver.relays([userOutbox()]),   // Promise<string[]>
  delay: 3000,                  // abortable soft-undo window (ms), before signing
})

// To specific relays:
app.use(Publisher).publish({event, relays: ["wss://relay.example"]})

// A Publication is a Svelte store. `state` is a union keyed by `stage`:
// queued → delayed → wrapping → pow → signing → sending → sent | failed | aborted
publication.subscribe(p => console.log(p.state.stage, p.results))
publication.abort()                           // unwinds the optimistic write; does nothing once settled
publication.canAbort()                        // true until any relay has been sent to
await publication.settled()                   // resolves on a terminal stage
await publication.getError()                  // string | undefined, once settled
publication.event                             // current event (mined/signed as it goes); the rumor for a wrap
app.use(Publisher).history                    // writable<Publication[]> — optimistic log
app.use(Publisher).retry(publication)         // re-sends publication.event, same id
app.use(Publisher).retry(publication, [url])  // only to these relays; a group retries only members that targeted them
// retry drops the publications it replaces from `history`
app.use(Publisher).merge([a, b])              // PublicationGroup; a relay's status is the worst among members

// Gift-wrapped (NIP-59): single recipient via `recipient`, or many via Wraps:
app.use(Publisher).publish({event, relays, recipient: theirPubkey})
const group = await app.use(Wraps).publish({event: rumor, recipients: [a, b]})

// Proof of work (NIP-13):
app.use(Publisher).publish({event, relays, pow: 20})
```

`PublishRequest`: `{event, relays, recipient?, delay?, pow?, priority?, timeout?}`. The stages (`STAGES` in `plugins/publisher.ts`) only transform the event. The publisher keeps the repository, tracker and `WrapManager` in step by reacting to state changes. Incoming wraps addressed to the user are auto-unwrapped by the default `appPolicyWraps`. An unwrap that throws is tried again up to `MAX_UNWRAP_ATTEMPTS` times, so a signer that was busy or disconnected doesn't cost the message. Each of its decryptions asks the signer for `priority: -1`, which leaves the user's own requests ahead of a backlog, and the signer bounds the decryption rather than the unwrap bounding the pair of them.

## Commands (deferred publishing)

Data-plugin mutation methods (`create`, `update`, `follow`, `addRelay`, `setRelays`, `Rooms.*`, …) don't publish — they build the `EventTemplate` and the relays it would go to, and hand back a **`Command`** for you to decide what to do with:

```typescript
import type {Command} from "@welshman/app"

const command: Command = await app.use(FollowLists).follow(["p", otherPubkey])

command.app      // the IApp it was built for
command.event    // EventTemplate — unsigned, inspectable before publishing
command.relays   // string[] — where publish() will send it

command.publish()               // normal path: app.use(Publisher).publish({event, relays: command.relays})
command.publishToRelays(urls)   // publish to a specific relay set instead of command.relays
```

`Wraps.publish` publishes directly instead: it fans one rumor out to a `PublicationGroup` of per-recipient wraps, each with its own relays.

`publish` and `publishToRelays` are also exported as free functions that chain off the mutation method's promise:

```typescript
import {publish, publishToRelays} from "@welshman/app"

await app.use(FollowLists).follow(["p", otherPubkey]).then(publish)
await app.use(Rooms).leaveRoom(relayUrl, roomMeta).then(publish)
await app.use(Rooms).joinRoom(relayUrl, roomMeta).then(publishToRelays([relayUrl]))
```

## Requests & sync

```typescript
import {Network, Sync} from "@welshman/app"
const net = app.use(Network)

// A one-shot request waits for every relay, so an empty result means every relay answered
// nothing. A request read reactively from the repository needs no timeout.
const events = await net.load({filters, relays, timeout: 3000})

// Outbox-model author load (resolves the author's write relays automatically).
// loadUsingOutbox returns the newest matching event; loadAllUsingOutbox returns them all.
const profileEvent = await net.loadUsingOutbox(pk, {kinds: [0]})
const allFeeds     = await net.loadAllUsingOutbox(pk, {kinds: [31890]})

// Negentropy-aware reconciliation (falls back to request/publish when unsupported):
await app.use(Sync).pull({relays, filters: [{authors: [pk]}]})
await app.use(Sync).push({relays, filters: [{authors: [pk]}]})
```

## Querying the repository (`Events`)

`Network` fetches, and `Events` reads what's already local. Every method binds this app's repository
and tracker and returns a `Projection`.

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

`relaySignedForUrl` drops anything not signed by the relay's NIP-11 `self`, as `RelaySignedDerivedPlugin` does.

## Routing & tags

`app.use(Router)` turns the declarative **`RelaySelection`** DSL (from `@welshman/util`) into scored relay urls. It exposes a `Resolver` (`router.resolver`) plus a `resolve(selections)` shortcut. That same `resolver` is injected into every `@welshman/domain` kind by `app.use(Domain)`, so writers/readers route through it too.

```typescript
import {Router} from "@welshman/app"
import {userOutbox, outbox, seen, relay, addMinimalFallbacks} from "@welshman/util"

const router = app.use(Router)

// resolver.relays(...) -> Promise<string[]>; resolver.relay(...) -> Promise<string | undefined>
const writeRelays = await router.resolver.relays([userOutbox()])
const hint        = await router.resolver.relay([seen({id: event.id})])

// resolve(...) -> Promise<RelayScenario>; then tune fallbacks/limit and read urls
const relays = (await router.resolve([userOutbox()])).policy(addMinimalFallbacks).limit(8).getUrls()

// DSL selectors: userInbox/userOutbox/userMessaging, inbox(pk)/outbox(pk)/messaging(pk),
// inboxes(pks), eventInbox(ref)/eventOutbox(ref), seen(ref), relay(url)/relays(urls),
// indexers(), searchRelays() — each returns a RelaySelection (relays/inboxes return arrays).
```

Event tagging (reply, quote and reaction threading, p-tags, zap splits) lives on the domain **writers**: `writer.addMention(pk)`, `writer.addQuote(event)`, `writer.addZapSplit(pk)`, and kind-specific setters like `NoteWriter.setParent(parentEvent)`. See the `welshman-domain` skill.

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

// Search lives on the collection that owns the data.
const search = get(app.use(Profiles).profileSearch)
const pubkeys = search.searchValues("alice")   // also fires a NIP-50 network search; ranked by WoT
// also: app.use(Topics).topicSearch, app.use(Relays).relaySearch
// createSearch(options, {...}) builds a custom index over anything else
```

## Plugin architecture (for extending)

Base classes in `plugins/base.ts`:

- **`DerivedPlugin<T>`** — collection derived from repository events (the repo is the single source of truth). Pass `{filters, eventToItem, getKey, loadOptions?}`; implement `fetch`. This is the dominant pattern. Gives you `all` (a `Projection`), `index` (an `ItemCollection`, a `Projection` plus a `read(key)` that waits out its outstanding parses), `get(key)`, `one(key)`, `load`/`forceLoad`, and `project(key, read)`.
- **`RelayScopedDerivedPlugin<T>`** — the same, keyed per relay via the tracker (`getKey(item, url)`), so the same addressable coordinate on two relays stays two entries. `RelaySignedDerivedPlugin` (in `plugins/relays.ts`) narrows it further to events signed by the relay's own NIP-11 `self` key, which is what `RelayRoles`, `RelayMemberLists` and `RoomPinLists` use.
- **`LoadableMapPlugin<T>`** — owns its own `Map`, lazily fetches over HTTP (e.g. `Relays`, `Handles`, `Zappers`). Implement `fetch`.
- **`MapPlugin<T>`** — owns its own `Map`, no network (e.g. `RelayStats`, `Plaintext`).

Decode events with the app-configured `@welshman/domain` reader (`app.use(Domain).reader(Kind)`) as `eventToItem`, and mutate through `app.use(Domain).writer(Kind, reader?)` + `app.use(Domain).command(writer)`:

```typescript
import {DerivedPlugin, Network, Domain, type IApp} from "@welshman/app"
import {SOME_KIND} from "@welshman/util"
import {SomeKind, SomeKindReader, SomeKindWriter} from "@welshman/domain"

export class Somethings extends DerivedPlugin<SomeKindReader> {
  constructor(app: IApp) {
    super(app, {
      filters: [{kinds: [SOME_KIND]}],
      eventToItem: app.use(Domain).reader(SomeKind),   // the reader, or a promise of it for kinds that decrypt
      getKey: item => item.author(),
    })
  }

  fetch = (pk: string, hints: string[] = []) =>
    this.app.use(Network).loadUsingOutbox(pk, {kinds: [SOME_KIND]}, hints)

  // Seeds a writer from the user's own event, hands it to the caller's edit, and wraps
  // the result in a Command — the caller decides when and how to publish it.
  update = (fn: (writer: SomeKindWriter) => void) =>
    this.app.use(Domain).update(SomeKind, this.forceLoad, fn)
}

const things = app.use(Somethings)   // lazily constructed + memoized
```

Caching/backoff for `load` come from `makeLoadItem` (`@welshman/store`); default staleness window is 1 hour; `forceLoad` bypasses it.

`Domain.update` is a method rather than something a base class hands down because `Domain` reaches `RelayLists` through `Router`, so a base class holding it would be the target of an `extends` inside its own import cycle. `app.use(Domain)` is read at call time, which is late enough to be safe.

## Policies & logging

Side effects live in `AppPolicy`s (`(app) => Unsubscriber`), run at construction, cleaned up by `cleanup()`.

- `defaultAppPolicies` = `[appPolicyIngest, appPolicyRelayStats, appPolicyWraps, appPolicyCacheDecrypt, appPolicyLogSignerMethods, appPolicyAuthUnlessBlocked]`.
- Auth builders: `makeAppPolicyAuth(shouldAuth, recheck?)` (`recheck(app)` is a store whose changes re-ask `shouldAuth`), `appPolicyAuthAlways`, `appPolicyAuthNever`, `appPolicyAuthUnlessBlocked`.
- `app.ingestEvent(event, url)` records an event a relay sent in the tracker and repository, skipping DVM and ephemeral kinds; `appPolicyIngest` calls it for every validly signed event, and a custom ingest policy can call it after its own check.
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

## Related skills

- `welshman-store` — the `Repository` and Svelte-store primitives this layer builds on.
- `welshman-domain` — the `Kind`/reader/writer model behind `app.use(Domain)` (event decoding + publishing).
- `welshman-util` — the `RelaySelection` DSL, `Resolver` and `RelayScenario` that `app.use(Router)` dereferences.
- `welshman-net` — request/publish/sockets behind `app.use(Network)`.
- `welshman-signer` — signers and login methods used by `User`/sessions.
- `welshman-feeds` — feed construction used by `app.use(Feeds)`.
