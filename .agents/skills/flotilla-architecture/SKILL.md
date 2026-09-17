---
name: flotilla-architecture
description: "Use this skill when deciding where new code belongs in flotilla: which layer (routes, app/components, app, lib) or welshman package owns it, which src/app module to extend, or how a kind-based space feature is laid out across the layers. Also use it for the layer and import rules, path aliases, the boot sequence, platform-specific behavior (Capacitor, Android, iOS, Electron, PWA), the link-preview server, env and branding variables, the e2e harness, and the lint/check tooling."
---

# Flotilla architecture

Flotilla is a client-only SvelteKit app, built with `adapter-static` and an `index.html` fallback,
with `ssr = false` in `src/routes/+layout.ts`. The same build ships as a web app/PWA, inside
Capacitor for Android and iOS, and inside Electron for desktop. Welshman does almost all of the
nostr work. Flotilla's own code is app policy (what to sync, when to authenticate, what to show)
and UI.

## The layers

| Layer | Path | Import as | May import |
|---|---|---|---|
| Routes | `src/routes` | — | anything |
| App components | `src/app/components` | `@app/components/X.svelte` | `@app`, `@lib` |
| App modules | `src/app/*.ts`, `editor/`, `push/` | `@app/x` | `@lib`, each other |
| Lib | `src/lib` | `@lib/x` | external packages only |

`svelte.config.js` defines the aliases `@src`, `@app`, `@lib` and `@assets`. Use `@lib`.
SvelteKit's built-in `$lib` also resolves, but only four stray imports use it (in `relays.ts`,
`callEngine.ts` and `VoiceRoomJoinDialog.svelte`). There is no barrel file, so import each
component by its path (`@lib/components/Button.svelte`), not from `$lib/components` as the
AGENTS.md example has it. Icons come from `@assets/icons/<name>.svg?dataurl`.

SvelteKit's `$app/*` (`$app/navigation`, `$app/state`, `$app/stores`) is an external dependency,
unrelated to flotilla's `@app/*`. App modules use it freely, for example `modal.ts`, `routes.ts`
and `sync.ts`.

### Why the graph is one-way

- `src/lib` stays reusable by other apps.
- `src/app` modules can be imported from anywhere (routes, components, other modules, the boot
  sequence) without pulling in UI.
- `core.ts` can't import the policy modules that depend on it, so they push themselves onto
  `appPolicies` when imported, and `core.ts` builds the `App` lazily after they have registered.
  `flotilla-state` covers this under "App policies".

### Exceptions

No lint rule enforces the layers (`eslint.config.js` has no import restrictions), so review is the
only gate.

- **lib → app.** `Link.svelte` imports `navigate` from `@app/modal`, and `ImageInputButton.svelte`
  and `IconPickerButton.svelte` open app modals. Don't copy them. A lib component that needs app
  behavior takes it as a prop, or moves to `src/app/components`.
- **app → components.** `routes.ts` (`goToChat` opens `ChatEnable`), `share.ts` (`Share`,
  `ShareEvent`) and `speech.ts` (`OpenRouterEnable`) import a component so they can open a modal
  mid-flow. `editor/` holds `.svelte` files of its own (suggestion popovers), which `makeEditor`
  mounts.
- Nothing under `src/app` or `src/lib` imports from `src/routes`.

## Top-level layout

| Path | What it is |
|---|---|
| `src/routes` | SvelteKit pages; the root `+layout.svelte` also runs the boot sequence |
| `src/app` | Flotilla's state, policies and feature logic, plus `components/` |
| `src/lib` | App-agnostic utilities and the design-system components |
| `src/assets/icons` | SVG icons |
| `static/` | Logo, PWA icons, fonts, sounds |
| `android/`, `ios/` | Capacitor native projects, with flotilla's own plugins and iOS share extension |
| `electron/` | Desktop shell on `@capawesome/capacitor-electron`; a separate npm project |
| `server.js` | Optional node server: serves `build/` and adds link-preview metadata |
| `e2e/` | Playwright suite against a real relay; start with `e2e/ARCHITECTURE.md` |
| `scripts/` | Build, desktop, version-bump and welshman-linking scripts |
| `docs/feature_matrix.html` | Standalone feature matrix page |

## `src/app` by concern

`src/app/components` is flat except for `hosting/`. `flotilla-views` covers component conventions.

**Core and session**
- `core.ts`: the `App` store, plugin stores, `login`, and the `reader`/`writer`/`command` shortcuts
- `session.ts`: restores the saved session at boot; `logout`
- `policies.ts`: the ingest, auth and socket policies installed on every app
- `storage.ts`: `kv`/`ss` (Capacitor Preferences and SecureStorage) and the per-user IndexedDB
  cache
- `sync.ts`: `syncApplicationData`, the background sync of user data, spaces and DMs
- `settings.ts`: the `Settings` plugin over encrypted app data, plus notification settings
- `repository.ts`: `derive*` helpers over the current app's repository
- `thunks.ts` (publish status by event id), `signer.ts` (signer request tracking)
- `env.ts`: every `VITE_` value, parsed
- `logger.ts` (log capture and sending), `analytics.ts` (Plausible pageviews), `device.ts` (a
  device id)

**Navigation and UI plumbing**
- `routes.ts`: path builders (`makeSpacePath`, `makeContentPath`, …), `goTo*`, history tracking
- `modal.ts`, `modal.svelte.ts`: `pushModal`, `popModal`, `navigate`, and the modal stack
- `toast.ts`, `title.ts`, `theme.ts`, `icons.ts` (icon picker options), `drafts.ts`
- `editor/`: flotilla's `@welshman/editor` setup (`makeEditor`), with its suggestion popovers and
  node views

**Spaces, rooms and administration**
- `relays.ts`: relay URL encoding for routes, socket status, LiveKit detection
- `rooms.ts`: helpers over `rooms.get()`, and the user's rooms and spaces
- `access.ts`: joining, invites, relay auth errors
- `management.ts` (NIP-86 admin checks, bans), `roles.ts` (member roles)
- `actionItems.ts`: the admin review queue (reports and pending joins)
- `featured.ts` (the space owner's featured content), `roomPins.ts`, `commands.ts` (NIP-CD slash
  commands)
- `hosting.ts`: client for the hosting backend's HTTP API

**Content**
- `content.ts`: kind lists (`CONTENT_KINDS`, `REACTION_KINDS`, `DM_KINDS`) and comment/delete
  filters
- `feeds.ts`: `makeFeed`, `makeFeedContext`, `makeScrollLoader`, `makeCalendarFeed`
- `classifieds.ts`, `articles.ts`, `pins.ts` (a person's pinned notes), `pinboards.ts`
- `reactions.ts`, `social.ts` (display names, comment trees, muting), `render.ts` (events as
  text), `statuses.ts` (NIP-38), `uploads.ts` (Blossom)
- `notifications.ts` (unread state, badges), `inbox.ts` (the home inbox)

**Messaging and calls**
- `chats.ts`, `call.ts` (call state), `callEngine.ts` (LiveKit join, leave, devices)

**Identity and payments**
- `nip46.ts`, `pomade.ts` (email login), `lightning.ts` (wallet, invoices), `healthChecks.ts`
  (prompts for missing inbox/outbox relays)

**Platform and voice**
- `push/` (notification adapters), `share.ts`, `keyboard.ts`
- `dictation.ts` (speech-to-text) and `speech.ts` (read aloud), both through OpenRouter

A feature gets a `src/app/<feature>.ts` only when it has non-UI logic to hold. Polls, goals,
threads and calendar events have no module; their components use domain readers directly.

## `src/lib`

Lib code is app-agnostic. It may use svelte, SvelteKit, Capacitor and welshman, but never `@app`,
env, or the `App` instance. A good test is whether it would work unchanged in another nostr
client.

- `util.ts`: small helpers (`errorMessage`, `AbortError`/`TimeoutError`, `buildUrl`,
  `normalizeTopic`)
- `html.ts`: DOM helpers such as `isMobile`, `createScroller`, `copyToClipboard`, `compressFile`
- `indexeddb.ts`: the `IDB` wrapper that `storage.ts` builds on
- `feeds.ts`: saved feed definitions (kind `FEED`) over `@welshman/feeds`. It is unrelated to
  `@app/feeds`, which loads events.
- `livekit.ts`: finds a relay's LiveKit endpoint
- `currency.ts`, `transition.ts`, `implicit.ts` (hands state from one page to the next)
- `test/`: the DEV-only hooks the e2e harness injects through
- `components/`: the design system, entered through `theme.css` (see `flotilla-views`)

## Boot sequence

`src/routes/+layout.svelte` runs the boot sequence. It imports `@app/policies` for its side effect,
and `@app/storage`, which registers `storagePolicy` the same way, so every `AppPolicy` is on
`appPolicies` before anything calls `app.get()`. Then, in order:

1. `restoreSession()` restores the saved session, if there is one, which builds a user-scoped
   `App` through `login`.
2. The device, wallet and notification stores sync to `kv`/`ss`.
3. It waits for storage, then handles a cold-start deep link.
4. Each long-running subscription goes onto one `unsubscribers` list: `setupHistory`,
   `syncApplicationData`, `setupShareIntents`, `syncKeyboard`, badges, `Push.sync()`.

When login swaps in a new `App`, the layout runs `syncApplicationData` again. Routes render inside
`AppContainer`, behind the login gate, and `ModalContainer` renders outside it. `flotilla-state`
covers the gate, login and logout.

## Platform layer

One web build runs in several shells:

- **Web/PWA.** `SvelteKitPWA` in `vite.config.ts` generates the service worker and manifest,
  except when `FLOTILLA_DESKTOP=1`. `src/service-worker.js` only claims clients.
- **Android/iOS.** Capacitor wraps `build/` (`capacitor.config.ts`). `scripts/build.sh` runs the
  web build, `cap sync`, and native asset generation.
- **Desktop.** `electron/main.ts` starts the Capawesome Electron platform, driven by
  `scripts/build-desktop.sh` and `scripts/dev-desktop.mjs`.
- **`server.js`.** A Hono server that serves `build/`. For `/join` and `/spaces/...` URLs it
  rewrites the OpenGraph tags from the relay's NIP-11 document, fetched through welshman's
  `Relays`. `vite.config.server.ts` bundles it and the `Dockerfile` runs it. It is not an API, and
  the app works from any static host.

Platform checks call Capacitor directly. There is no wrapper module:

```ts
export const ENABLE_ZAPS = Capacitor.getPlatform() != "ios" // src/app/env.ts
export const HOSTING_ENABLED = Capacitor.getPlatform() !== "ios" // src/app/hosting.ts

if (!Capacitor.isPluginAvailable("Keyboard")) return noop // src/app/keyboard.ts
```

The iOS flags exist because of App Store payment policy, so anything that takes money checks
`ENABLE_ZAPS` or `HOSTING_ENABLED`. `isMobile` from `@lib/html` detects a touch screen and says
nothing about the platform.

Flotilla's own native code:

- `android/app/src/main/java/social/flotilla/`: `AndroidPushFallbackPlugin` and its worker (push
  without FCM), and `ShareIntentPlugin`. `MainActivity.java` registers them, and JS binds them with
  `registerPlugin` (`push/adapters/android.ts`, `share.ts`).
- `ios/App/ShareExtension/`: the extension can't call into the app, so it opens a
  `flotilla://share` URL. `handleDeepLink` in the root layout passes that to `shareFromNative`.

`Push` in `src/app/push/index.ts` chooses an adapter at runtime: the Android fallback, Capacitor
`PushNotifications` (FCM/APNs through `PUSH_SERVER`), or web notifications.

## Env and branding

`src/app/env.ts` reads the `VITE_` values and exports them as typed constants, with relay lists
parsed by `fromCsv` and `normalizeRelayUrl`. In DEV each lookup checks `window.__TEST_ENV__` first,
which lets the e2e harness point a browser at its own relays. Elsewhere, only `logger.ts` and the
about page read a `VITE_` value (`VITE_BUILD_HASH`); other `import.meta.env` reads are `DEV`
guards.

- `.env` is committed and holds working defaults. `.env.local` (gitignored) overrides it. There is
  no `.env.template`, though AGENTS.md and the README refer to one.
- Env is read at build time. `scripts/build-web.sh` sources `.env` without overwriting variables
  already set, then fills the `{NAME}`, `{URL}`, `{ACCENT}` and `{DESCRIPTION}` placeholders from
  `src/app.html` in `build/index.html`. `server.js` reads `VITE_PLATFORM_NAME` and
  `VITE_PLATFORM_DESCRIPTION` at runtime.
- A non-empty `VITE_PLATFORM_RELAYS` turns on platform mode, which disables space browsing and
  makes the first platform relay the home page (`goToHome` in `routes.ts`, `PrimaryNav`,
  `sync.ts`).
- `VITE_THEME`, exported as `FL_THEME`, selects the design preset in
  `src/lib/components/theme.css`.
- The native app name is hard-coded in `capacitor.config.ts` (`appName: "Flotilla"`), outside the
  env system.

To add a variable, give it a default in `.env` and export a parsed constant from `env.ts`. If it
names a relay or host, the e2e harness has to override or mock it (see "Containment" in
`e2e/ARCHITECTURE.md`).

## Tooling and tests

- `pnpm run lint` runs prettier and eslint over `src`, `e2e` and the configs, `pnpm run check`
  runs svelte-check, and `pnpm run format` formats changed files.
- `.husky/pre-commit` runs lint and check, and refuses to commit while a `link:` override is in
  place. CI (`.gitea/workflows/ci.yml`) runs lint, check and the Electron TypeScript build, plus a
  full build on pushes to `dev`.
- Flotilla has no unit tests. `e2e/` is a Playwright suite against a real zooid relay in Docker;
  `e2e/ARCHITECTURE.md` explains the harness and `e2e/USER_STORIES.md` lists the stories the specs
  cite. Agents don't run it. Its only footprint in the app is `src/lib/test/`.
- `scripts/link-deps.mjs` links `../welshman/packages/*` by writing temporary `link:` overrides
  into `pnpm-workspace.yaml`, installing, and restoring the file. Without those overrides welshman
  comes from the registry, so read its source under `node_modules/@welshman/*/dist`, or in
  `../welshman` when that checkout matches the installed version.

## Principles behind placement

**Check welshman before writing flotilla code.** Several commits replace app code with welshman
primitives: `render.ts` uses welshman's `summarize` (`9b0d8a55`), `actionItems.ts` uses
`rooms.get().pendingJoins` (`3d66fb31`), and `rooms.ts` uses the membership helpers (`847d8984`).

**When welshman lacks something, add it there.** The maintainer also maintains welshman, so a
missing primitive goes upstream rather than into an `@app` workaround. The `Command` and
`Pinboard` kinds live in `@welshman/domain`, and flotilla's `commands.ts` and `pinboards.ts` only
consume them. Expect rejection for app-level retry loops, liveness heuristics, or registries that
duplicate what `@welshman/net` already tracks.

**Add indirection only when it pays for itself.** `core.ts` exports the `reader`, `writer` and
`command` shortcuts because "almost every read or write goes through one of them". Platform checks
stay inline rather than going through a platform module, and `drafts.ts` is a module-level `Map`
rather than a persisted store.

## Placement guide

- **Parsing or building a nostr kind** → upstream in `@welshman/domain`, used through `reader` and
  `writer` from `@app/core`. See `flotilla-model` ("Adding a kind") and `welshman-domain`.
- **A space section for a kind** → a route under `src/routes/spaces/[relay]/`, with the kind in
  `CONTENT_KINDS`. The walkthrough below names every file involved, and `flotilla-model` ("Adding
  a kind") and `flotilla-views` ("Adding a space content page") have the checklists. Add the
  section to the regexes in `server.js`, or its link previews are titled as a room.
- **Non-UI logic for one feature** (scoring, filtering, stores keyed by URL) →
  `src/app/<feature>.ts`, with no component imports.
- **A keyed collection of one kind** → a plugin. A generic kind's plugin goes upstream in
  `@welshman/app`; a flotilla-specific one is a `DerivedPlugin` in `src/app`, exposed with
  `usePlugin`. See `flotilla-state`.
- **A preference** → a `SettingsValues` field in `settings.ts` if it follows the user, or a
  `kv`/`ss` store if it belongs to the device. See `flotilla-state`.
- **A relay or network policy** (what to ingest, when to AUTH, which sockets may open) → an
  `AppPolicy` in `policies.ts`. See `flotilla-state` and `welshman-net`.
- **Data every joined space needs locally** → the filters in `syncSpace` in `sync.ts`. Data that
  one page needs is loaded by that page. See `flotilla-state` and `flotilla-views`.
- **A modal or dialog** → `src/app/components/<Name>.svelte`, opened with `pushModal`. See
  `flotilla-views`.
- **A generic UI primitive** → `src/lib/components/<Name>.svelte` with a CSS family file next to it
  (`Button.svelte` and `button.css`), and no `@app` imports. See `flotilla-views`.
- **A non-nostr HTTP service** → its own module with typed request functions, a typed error class
  and a base URL from env, as in `hosting.ts` (`hostingFetch`, `HostingError`,
  `HOSTING_BACKEND_URL`).
- **A native capability** → JS in `src/app/<capability>.ts`, with inline `Capacitor` checks and a
  web fallback. If no Capacitor plugin fits, write one under
  `android/app/src/main/java/social/flotilla/`, register it in `MainActivity.java`, and bind it
  with `registerPlugin`. An iOS extension reaches the app through a `flotilla://` deep link.
- **A deployment setting** → a `VITE_` variable (see Env and branding).
- **Startup wiring** → a `setup*` or `sync*` function in the owning module that returns an
  `Unsubscriber`, called from the root layout (`setupHistory`, `syncKeyboard`, `Push.sync`).

## Walkthrough: classifieds

Classifieds (NIP-99, kind 30402, `CLASSIFIED`) touch every layer and follow current conventions
(`e6ce3e5e` is their redesign). Polls, goals, threads and calendar have the same shape without the
app module.

**Domain.** `Classified` in `@welshman/domain` pairs a `ClassifiedReader` (`title()`,
`summary()`, `price()`, `status()`, `images()`, `topics()`) with a `ClassifiedWriter` that has the
matching setters.

**Kind registries.** `CONTENT_KINDS` in `src/app/content.ts` drives sync, notifications, push,
search and the space nav entry. The kind also appears in `CONTENT_NOUNS`, the kind dispatch in
`NoteContent.svelte` and `NoteContentMinimal.svelte`, `makeClassifiedPath` and `makeContentPath` in
`routes.ts`, `title.ts`, `NIP46_PERMS` in `nip46.ts`, and the section regexes in `server.js`.
`NIP46_PERMS` leaves out polls, articles and goals, so listing a new kind there is optional.

**App module.** `src/app/classifieds.ts` holds the listing logic the page would otherwise inline
(`partitionListings`, `deriveTopicCounts`, `getStatus`, `matchesTopic`, `matchesQuery`). Each is a
small function over a domain reader:

```ts
export const getStatus = (event: TrustedEvent) => reader(Classified)(event).status() ?? "active"
```

**Components.** `ClassifiedForm` builds and publishes the event, and `ClassifiedCreate` and
`ClassifiedEdit` wrap it, supplying only the header. The list page and `ComposeMenu` open
`ClassifiedCreate` as a modal. From a room, `ComposeMenu` sets `shareToChat`, which also quotes the
new listing into the room. `ClassifiedActions` opens `ClassifiedEdit`. `ClassifiedItem` is the
card, and `NoteContentClassified` renders a listing wherever `NoteContent` is used.

**Routes.** `src/routes/spaces/[relay]/classifieds/+page.svelte` loads listings and their comments
with `makeFeed` and filters them with the `classifieds.ts` helpers. `[address]/+page.svelte` reads
one listing with `deriveEvent(address, [url])`.

Articles are composed on a full page (`spaces/[relay]/articles/create`, built by
`makeArticleCreatePath`) instead of in a modal.

## Related skills

- `flotilla-state`: the `App` instance and plugins, policies, persistence, sync, publishing
- `flotilla-views`: routes and layouts, components, modals, loading data from components
- `flotilla-model`: spaces as relays, NIP-29 rooms, NIP-86 management, content kinds, routing
- `welshman`: overview of the packages
- `welshman-app`: `App`, `use()`, `AppPolicy`, `DerivedPlugin`, commands and thunks
- `welshman-domain`: readers, writers, and adding a kind
- `welshman-net`: the pool, sockets and socket policies
- `welshman-util`: kind constants, tag specs, `RelaySelection`
