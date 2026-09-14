---
name: flotilla-state
description: "Use this skill when deciding where a piece of state belongs in Flotilla, or when touching state: reading or adding stores in src/app, reaching the App instance and welshman plugins (usePlugin, fromApp, deriveUserItem), writing code that must survive login swapping the app or run signed out, adding an app policy or a flotilla plugin, persisting data (IndexedDB storage, kv/ss, synced stores, published settings, drafts), changing what src/app/sync.ts pulls in the background, and publishing (domain writer → Command → thunk, optimistic updates, undo, showing publish status)."
---

# Flotilla state

State in Flotilla flows one way. Events arrive from relays, pass the ingest policy, and land in
the current app's repository. Plugin indexes and derived stores read the repository, and
components subscribe to those. Writes go the other way: a domain writer becomes a `Command`, the
command becomes a thunk, and the thunk writes its event into the repository before any relay has
seen it.

Almost everything per-identity hangs off one welshman `App`, and signing in replaces that app.

## The app instance

`src/app/core.ts` builds the app lazily. `app` is a hand-written `ReadableWithGetter<App>`
whose first `get()` or `subscribe` builds an anonymous app. `App` runs its policies in its
constructor. Flotilla's own policies live in modules that import `core.ts` and push themselves
onto `appPolicies` when imported, so the first app has to be built after those imports run (see
[App policies](#app-policies)).

- **Login swaps the app.** `login(session)` builds a `User` from the session, cleans up the old
  app, builds a new one with that user, then sets `session`. There is no account switching, so
  `login` only runs while signed out: `restoreSession` at boot, the `LogIn*`/`SignUp*` flows,
  and `loginWithPomade`.
- **Logout reloads the page.** `logout` in `src/app/session.ts` clears `kv`, `ss`, the user's
  IndexedDB and `localStorage`, cleans up the app, then sets `window.location.href = "/"`.

The app is therefore stable for as long as anything under the login gate is mounted.

| Export | What it is | Signed out |
|---|---|---|
| `app` | the current `App` | an anonymous app |
| `session` | the persisted `Session` | `undefined` |
| `user` | `User.require($app)`, derived | subscribing or `.get()` throws |
| `usePlugin(Plugin)` | a store holding `$app.use(Plugin)` for the current app | safe |
| `profiles`, `rooms`, `relays`, `thunks`, … | `usePlugin` for 27 welshman plugins | safe |
| `fromApp(read)` | a store that re-reads `read($app)` when the app changes | safe |
| `deriveUserItem(Plugin)` | the signed-in user's entry in a keyed plugin | `undefined` |
| `userSearchRelayUrls` | the user's search relays, or `DEFAULT_SEARCH_RELAYS` | the defaults |
| `reader`, `writer`, `command` | `Domain` entry points on the current app | — |
| `login`, `appPolicies` | see above and below | — |

AGENTS.md lists `pubkey` and `signer` stores, but neither exists. Read `$app.user?.pubkey` where
absence is legitimate, and `$user.pubkey` or `user.get().signer` behind the login gate.

## Signed in vs signed out

`src/app/components/AppContainer.svelte` renders the route (`children`) only when
`$app.user?.pubkey` is set, and shows the `Landing` dialog otherwise. Route pages, and
everything under `PrimaryNav`, can assume a user.

The following run outside that gate:

- the root `src/routes/+layout.svelte` and what it starts: `restoreSession`,
  `syncApplicationData`, the `notifications.sync*` functions, `Push.sync`, logging
- `ModalContainer` and every modal, including the `LogIn*`/`SignUp*` flows. Modals stay mounted
  across a login.
- `Toast`, `CallBanner`, `SpeechBanner`, `NewNotificationSound`
- every app policy

This code reads `app.get().user?.pubkey` and bails when it is missing, as
`syncUserSpaceMembership` in `src/app/sync.ts` and `nip98Header` in `src/app/notifications.ts`
do.

Stores derived from `user` throw as soon as they are subscribed signed out. That includes
`isEventMuted` (`social.ts`), `deriveUserIsRoomAdmin` (`rooms.ts`) and `deriveUserCanCreateRoom`
(`management.ts`), so only use them from gated components.

## Reaching plugins

The code reaches plugins three ways:

```typescript
// Components: a store exported from core.ts, when there is one
const display = $profiles.display(pubkey, [url]).$

// Components: $app.use() for plugins core.ts doesn't export (Zappers, Feeds, Pinboards)
const zapper = $app.use(Zappers).forPubkey(pubkey, removeUndefined([url])).$

// Module scope: always through a store that rebinds when the app changes
const profileIndex = fromApp($app => $app.use(Profiles).index.$)
```

The rule is about when a binding is made:

- **Module scope, and anything outside the gate**, goes through `app`, `usePlugin`, `fromApp`
  or `deriveUserItem`. A module-level `app.get()` builds the first app before the policies
  register, and a binding made that way keeps reading the discarded app after login. Long-lived
  listeners re-bind on `app.subscribe`, as `chatsById` in `src/app/chats.ts`,
  `syncCheckedRemote` in `notifications.ts` and the resync in the root layout do.
- **Code under the gate** can bind at call time. `rooms.get().forUrl(url).$` inside
  `deriveUserRooms`, or `$app.use(X)` in a component's script, is fine there, because the app
  cannot change while that code is mounted.

For a new module-level store over a welshman plugin, use the `usePlugin` export in `core.ts` if
there is one. Add an export when several modules need the plugin, and otherwise write
`fromApp($app => ...)` where the store is defined.

### Per-identity caches

Bookkeeping for one identity lives on a plugin instance, so it is discarded with the app.
`Commands` in `src/app/commands.ts` keeps its `pulled` set on the plugin for this reason.

Module-level caches are fine when their contents do not depend on who is signed in, or when what
they cache is itself a rebinding store. `commandsByUrl` holds `fromApp` stores.
`hasBlossomSupport` (`uploads.ts`) and `deriveHasLivekit` (`relays.ts`) use `simpleCache` from
`@welshman/lib` to share one store per url across every component that asks.

## Flotilla's own plugins

| Plugin | Base | What it is |
|---|---|---|
| `Settings` (`settings.ts`) | `DerivedPlugin` | encrypted app-data settings, plus a `values` projection |
| `Statuses` (`statuses.ts`) | `DerivedPlugin` | NIP-38 general status, keyed by pubkey |
| `Commands` (`commands.ts`) | `RelayScopedDerivedPlugin` | slash-command definitions, keyed per relay |
| `HealthChecks` (`healthChecks.ts`) | none | a plain class over `IApp` exposing `Projection`s |

Each is exposed with `usePlugin`. `Statuses` is the minimal shape:

```typescript
export class Statuses extends DerivedPlugin<TrustedEvent> {
  constructor(app: IApp) {
    super(app, {filters: [filter], eventToItem: event => event, getKey: event => event.pubkey})
  }

  fetch(pubkey: string, hints: string[] = []) {
    return this.app.use(Network).loadUsingOutbox(pubkey, filter, hints)
  }
}

export const statuses = usePlugin(Statuses)
```

A plugin fits a keyed collection of an event kind that needs `index`, `one` and `load`, or
per-identity logic with its own caches. Expose derived views as projections with
`projectFrom(this.index, ...)`, as `Settings.values` and `Commands.forUrl` do.

A generic nostr kind belongs upstream in `@welshman/app`, with its reader in `@welshman/domain`
(see flotilla-model), because the maintainer prefers fixing welshman to working around it here.
`Statuses` could move. `Settings`, keyed on the `flotilla/settings` d-tag, stays.

## App policies

An `AppPolicy` is `(app) => Unsubscriber`, and `app.cleanup()` tears policies down in reverse.
`core.ts` seeds `appPolicies` with welshman's `appPolicyWraps`, `appPolicyRelayStats`,
`appPolicyCacheDecrypt` and `appPolicyLogSignerMethods`. It leaves out welshman's
`appPolicyIngest` and `appPolicyAuthUnlessBlocked`, because flotilla replaces them:

| Policy | Module | What it adds |
|---|---|---|
| `ingestPolicy` | `policies.ts` | drops DVM and ephemeral kinds; skips signature checks for trusted relays |
| `authPolicy` | `policies.ts` | NIP-42 by the `relay_auth` setting, conservative or aggressive |
| `socketPolicy` | `policies.ts` | blocked relays, `relaysPendingTrust`, `relaysMostlyRestricted` |
| `storagePolicy` | `storage.ts` | the per-user IndexedDB cache, only when the app has a user |

The root layout imports `@app/policies` and `@app/storage` before anything touches the app. To
add a policy:

1. Define it in the module that owns the concern.
2. Push it onto `appPolicies` at the bottom of that module.
3. Make sure the root layout imports that module ahead of the first `app.get()`.

Inside a policy, use the `$app` argument. During construction the new app is not in the store
yet, so `app.get()` returns the previous, cleaned-up app. On first boot there is no previous
app, and `app.get()` recurses into building another one.

## The repository and derived state

Events enter `app.repository` from `ingestPolicy` (which calls `tracker.track`, then
`repository.publish`), from `Storage` loading the cache at startup, and from thunks publishing
optimistically. The tracker records which relays each event was seen on, which is what lets
space content be keyed by relay.

`src/app/repository.ts` wraps the `@welshman/store` derivations in `fromApp`:

- `deriveEvent`, `deriveEvents`, `deriveEventsById`, `deriveIsDeleted`
- relay-scoped: `deriveEventsForUrl`, `deriveEventsByIdForUrl`, `deriveEventsByIdByUrl`,
  `getEventsForUrl`
- `deriveRelaySignedEvents`, which keeps only events signed by the relay's NIP-11 `self` key
- `deriveLatestEvent`

Use these for raw event queries. Welshman's `Events` plugin has the same surface returning
projections, and flotilla does not use it. Plugin reads (`get`, `one`, `load`, `index`) are
documented in welshman-app.

### Free functions in an app module

Most derived state is a plain function in the app module that owns its domain, composing plugin
projections and repository derivations:

```typescript
// src/app/actionItems.ts
export const deriveSpaceActionItems = (url: string) =>
  derived(
    [deriveEventsForUrl(url, [{kinds: [REPORT]}]), rooms.get().pendingJoins(url).$],
    ([$reports, $pendingJoins]) => sortEventsDesc([...$reports, ...$pendingJoins]),
  )
```

`src/app/rooms.ts` is the fullest example. Names follow the return type:

- `derive*` returns a store: `deriveUserRooms`, `deriveUserRoomMembershipStatus`
- `get*` and `display*` return a snapshot: `displayRoom`
- plain verbs mutate: `addRoomMembers`, `reorderSpaceUrls`

Rules that involve more than one plugin belong in these functions rather than in components.
"A space admin is a room admin" lives in `deriveUserIsRoomAdmin`.

### Hand-built indexes for hot paths

A derivation that every row subscribes to, or that joins large sets, is built by hand:

- `chatsById` (`chats.ts`) updates incrementally from repository `update` events rather than
  re-querying.
- `thunksByEventId` (`thunks.ts`) indexes thunk history once, and hands back the previous array
  wherever an event's thunks are unchanged so rows don't churn.
- `latestActivityByPath` (`notifications.ts`) joins chats, room lists, relay info, events and
  settings behind `throttled(1000, …)`.
- `deriveLatestEvent` (`repository.ts`) shares one repository listener across every watched
  author.

## Local and persisted state

| State | Where | Per user | On logout |
|---|---|---|---|
| repository, tracker, relays, relay stats, handles, zappers, plaintext, wraps | IndexedDB | yes | deleted |
| settings (`SettingsValues`) | an encrypted app-data event, cached in IndexedDB | yes | local copy deleted |
| `session`, `wallet` | `ss` | no | cleared |
| `theme`, `flTheme`, `checked`, `shouldUnwrap`, `device`, `notificationSettings`, push state | `kv` | no | cleared |
| drafts, dictations | a module `Map`, lost on reload | no | page reloads |

### IndexedDB (`src/app/storage.ts`, `src/lib/indexeddb.ts`)

`storagePolicy` builds a `Storage` only for an app with a user, so a signed-out app caches
nothing. Each identity gets its own database, `flotilla-9gl-<pubkey>`. `IDB` reconciles object
stores by bumping the database version, so adding or removing a table needs no migration.

`shouldPersistEvent` keeps:

- profiles and metadata lists (follows, mutes, relay lists, app data, room lists) from any author
- alert kinds
- relay- and room-scoped kinds
- DMs
- room membership changes, only when they tag the user

Room messages, threads and other content are not kept, and background sync pulls them again.

- Rows keep each event's relays inline. A relay-scoped event without them can never be keyed to
  a space again, so it is dropped on load.
- `COMMAND` definitions expire after a week.
- Boot waits only for events and relays (`storage.get()?.ready`). The other tables load on the
  next tick.

To persist another kind, add it to `kinds` in `storage.ts`. To persist a new map-backed plugin,
add a `TABLES` entry and an `init*` method shaped like `initHandles`: load the rows, subscribe
to `onItem`, and batch the writes.

### kv, ss and the two ways to bind them

`kv` wraps Capacitor `Preferences` and `ss` wraps `SecureStorage`. Both are exported from
`storage.ts`, queue their writes, and JSON-encode values. Neither is namespaced per user, so
anything in them outlives a login and is cleared only by logout. Secrets go in `ss`.

- `synced({key, storage, defaultValue})` creates a store that persists itself. It emits the
  default first, and the stored value arrives later (`.ready`). `theme` and `flTheme`
  (`theme.ts`), `checked` (`notifications.ts`) and `shouldUnwrap` (`sync.ts`) use it.
- `sync({key, store, storage})` binds a store that already exists. The root layout awaits it
  for `device`, `wallet`, `notificationSettings` and `pushState` before first render, so boot
  code sees the restored values. It also binds `shouldUnwrap`, which `synced` already persists.

Raw `localStorage` holds only `theme`, `fl-theme` and `font-size`. The root layout mirrors them
there to apply them synchronously before `kv` loads, which avoids a flash of the wrong theme.

### Settings (`src/app/settings.ts`)

Settings are an encrypted app-data event with d-tag `flotilla/settings`, read through the
`Settings` plugin:

- `userSettingsValues` is the current user's values merged over `defaultSettings`. `getSetting`
  is its snapshot, and there are derived helpers such as `deriveShouldNotify`.
- `publishSettings(partial)` calls `forceLoad` first, so a write merges onto the latest event
  rather than a stale cache.
- Settings pages bind `createSettingsForm()`. The form adopts the real values when the event
  finishes decrypting, but only while untouched, so defaults never overwrite real settings.

A preference that should follow the user across devices goes in `SettingsValues` and
`defaultSettings`. One that belongs to a device goes in a `kv` store, as push, sound and badge do
in `notificationSettings`. Per-space alert preferences are published (`alerts`); the device's
push permission is not.

`checked`, the read markers behind badges, lives in `kv`, and `syncCheckedRemote` mirrors it to
dufflepud's `kv/checked` with NIP-98 auth. That makes it cross-device without publishing an
event on every read.

### Drafts (`src/app/drafts.ts`)

`DraftKey<T>` is a typed handle over an in-memory `Map`. A draft survives the composer
unmounting and a navigation, but not a reload. Key it by context: `RoomCompose` uses
`room:${url ?? ""}:${h ?? ""}` and `EventReply` uses `reply:${event.id}:${parent?.id || ""}`.
The dictation registry in `dictation.ts` works the same way, so a transcription can finish after
its composer has gone.

## Background sync (`src/app/sync.ts`)

The root layout calls `syncApplicationData()` once the session is restored and storage is ready,
and again after every app swap. `Access.completeJoin` calls it after a space is joined. Each
call tears down the previous run.

- `syncRelays` loads NIP-11 for the indexer relays, the current route's relay and the user's
  spaces.
- `syncUserData` loads the user's relay list, then on each relay-list change their other lists,
  profile and `Settings`. It also pulls the user's own space and room membership events, and
  their follows' follow and mute lists.
- `syncSpaces` covers each joined space plus the current route's space. It pulls membership,
  roles, room metadata, pins and livekit state in full, and recent content: a month of it, or a
  week for reactions and comments.
- `syncDMs` pulls gift wraps from the user's messaging relays, only when `shouldUnwrap` is on.

`pullAndListen` is a negentropy `Sync.pull` plus a live `limit: 0` request, both stopped through
an `AbortController`. `syncSpaces` and `syncUserData` diff their `unsubscribersBy*` maps against
the room list, so a new filter goes into the right `pullAndListen` call.

Background sync keeps badges, navigation, the inbox and notifications correct on any page. Data
that must be current app-wide belongs here. Data only one page shows is loaded by that page's
components; see flotilla-views.

## Mutations

The prevailing path runs from a domain writer to a command to a thunk, adapted from
`ThreadCreate.svelte`:

```typescript
const eventWriter = writer(Thread)
  .setContent(content)
  .setTitle(title)
  .setProtected(protect)
  .forceRoutes(relay(url))

if (room) {
  eventWriter.setRoom(url, room)
}

const thunk = await command(eventWriter).then(publish)
const error = await thunk.waitForError()

if (error) {
  return pushToast({theme: "error", message: error})
}
```

`publish` sends to the writer's own routes, which is why the excerpt forces them with
`forceRoutes`. `publishToRelays(urls)` and `publishAsRelay(url)` override those routes instead.
flotilla-model's "Which relays an event goes to" says which one each kind needs.

Plugin mutators already return a `Command`: `roomLists.get().addRelay(url).then(publish)`,
`rooms.get().addMember(url, room, pubkey)`, `reactions.get().react(event, content, ...)`,
`deletes.get().deleteEvent(event, w => w.setProtected(protect))`. Their `update`-style methods
`forceLoad` before writing. A replaceable event you build yourself needs the same, as in
`publishSettings`.

Some call sites call `thunks.get().publish({event, relays, delay})` directly. Room chat
(`RoomChat.svelte`) does, because `Command` cannot carry the `send_delay` window, and so do
`publishRoomQuote` in `rooms.ts`, the push adapters and `ProfileDelete.svelte`. DMs go through
`wraps.get().publish({event, recipients})`, which returns a merged thunk (see `reactions.ts`).
NIP-86 calls (`relayManagement.get().forUrl(url)`) are not thunks. They return
`{result, error}`, and the caller handles `error`.

### Optimistic updates, undo and status

- **Optimistic writes.** `Thunks` writes the event into the repository and tracks it against its
  relays when it is enqueued, so every derived store sees it immediately. Signing then swaps the
  unsigned event for the signed one.
- **Undo.** `thunk.abort()` during the `delay` removes the event from the repository and from
  `history`. When `send_delay` is set, room chat shows a `ThunkToast` whose Cancel button aborts.
- **Editing.** Editing a message deletes it and republishes with the same `created_at` (see
  `RoomChat.svelte`).
- **Status in rows.** Rows look up `$thunksByEventId.get(event.id) ?? noThunks` and pass
  `$thunks.merge(...)` to `ThunkStatus`, or to `ThunkFailure`, which retries per relay.
  `ThunkStatusOrDeleted` combines publish status with deletion. `ChatMessage.svelte` filters the
  whole `history` per row instead.
- **Status in forms.** Forms await `waitForError()` and toast the message, as in the excerpt
  above.

## Other app-level stores

- **A join over many sources.** `notifications.ts` derives `latestActivityByPath`, then
  `allNotifications`, then `notifications` and the counts. `inbox.ts` derives from the same two
  stores, so the inbox matches the badges.
- **Singleton session state.** `call.ts` keeps call state in plain writables (`callState`,
  `currentCallSession`, …).
- **UI signals.** `toast` in `toast.ts`, and `relaysPendingTrust` in `policies.ts`.
- **A controller per flow.** `Access` (`access.ts`) and `Nip46Controller` (`nip46.ts`) are
  classes a component instantiates (`new Access(url)`). They hold the writables and actions for
  a multi-step flow.
- **Module-owned values.** `wallet` in `lightning.ts` is a `withGetter(writable(...))` that the
  root layout persists.

## Runes and stores

Modules in `src/app` use svelte stores. The one `.svelte.ts` module is `src/app/modal.svelte.ts`:
its modal registry is `$state`, and the open stack is `$derived` from `page.state` in
`$app/state`, SvelteKit's rune-based replacement for the deprecated `$app/stores`. A rune-only
source is what justifies the exception. `sync.ts` and `notifications.ts` read `page` from
`$app/stores` because they subscribe to it outside a component.

Component-local `$state` covers UI state that dies with the component. Everything else is a
store, consumed in components with `$store`.

## Where does this state belong?

Take the first answer that fits:

1. **It is an event, or derived from events.** It is already in the repository, or should be.
   Read it with a plugin or an `@app/repository` derivation, and put the domain logic in a
   `derive*` function in the owning app module (`deriveUserRooms`). Don't copy it into a
   writable.
2. **It is a keyed collection of one kind, loaded by key.** Write a plugin. A generic kind goes
   upstream in `@welshman/app`. A flotilla-specific one is a `DerivedPlugin` here, exposed with
   `usePlugin` (`Settings`, `Statuses`, `Commands`).
3. **It is bookkeeping for one identity.** Put it on a plugin instance (`Commands.pulled`) or in
   a policy, never in a module-level map that outlives login. Retry or resume logic around
   welshman behaviour is a fix for welshman instead.
4. **It is a preference.** If it follows the user, it is a `SettingsValues` field. If it is per
   device, it is a `synced` store in `kv`. A secret goes in `ss`.
5. **It is app-wide state that does not come from nostr.** Make it a writable in the owning app
   module (`callState`, `toast`, `relaysPendingTrust`).
6. **It must outlive a component but not a reload.** Use a module map, as `DraftKey` and the
   dictation registry do.
7. **It is one component's UI.** Use `$state` in the component.

## Related skills

- `flotilla-architecture`: the layer rules, what each `src/app` module is for, boot at a glance
- `flotilla-views`: routes, components, and how components load data and show state
- `flotilla-model`: spaces, rooms, NIP-43/29/86, which relays events go to, domain kinds
- `welshman-app`: `App`, plugins, `Command`, thunks, `Network`/`Sync`, `Events`
- `welshman-store`: `deriveEventsById`, `deriveItemsByKey`, `synced`, `throttled`, `withGetter`
- `welshman-domain`: the readers and writers behind `reader`, `writer` and `command`
- `welshman-net`: the repository, tracker and socket policies under the app
