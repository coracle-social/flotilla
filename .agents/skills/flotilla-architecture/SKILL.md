---
name: flotilla-architecture
description: "Use this skill when deciding where new code belongs in flotilla: which layer (routes, app/components, app/shell, app/areas, app/features, app/tools, app/navigation, app/core, lib) or welshman package owns it, which src/app module to extend, or how a kind-based space feature is laid out across the layers. Also use it for the layer and import rules, path aliases, the boot sequence, platform-specific behavior (Capacitor, Android, iOS, Electron, PWA), the link-preview server, env and branding variables, the e2e harness, and the lint/check tooling."
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
| Shell | `src/app/shell` | `@app/shell/x` | areas, features, tools, `@app/navigation`, `@app/core`, `@lib` |
| Areas | `src/app/areas` | `@app/areas/x` | features, tools, `@app/navigation`, `@app/core`, `@lib`; never another area |
| Features | `src/app/features` | `@app/features/x` | tools, `@app/navigation`, `@app/core`, `@lib` |
| Tools | `src/app/tools` | `@app/tools/x` | other tools, `@app/navigation`, `@app/core`, `@lib` |
| Navigation | `src/app/navigation` | `@app/navigation/x` | `@app/core`, `@lib` |
| Core | `src/app/core` | `@app/core/x` | `@lib` |
| Lib | `src/lib` | `@lib/x` | external packages only |

`svelte.config.js` defines the aliases `@src`, `@app`, `@lib` and `@assets`. Use `@lib`, not
SvelteKit's built-in `$lib`, which also resolves. There is no barrel file, so import each
component by its path (`@lib/components/Button.svelte`), not from `$lib/components` as the
AGENTS.md example has it. Icons come from `@assets/icons/<name>.svg?dataurl`.

SvelteKit's `$app/*` (`$app/navigation`, `$app/state`, `$app/stores`) is an external dependency,
unrelated to flotilla's `@app/*`. App modules use it freely, for example `navigation/dialogs.ts`,
`navigation/history.ts` and `core/sync.ts`.

### Why the graph is one-way

- `src/lib` stays reusable by other apps.
- `src/app` modules can be imported from anywhere (routes, components, other modules, the boot
  sequence) without pulling in UI.
- An `index.ts` only re-exports its directory's files and defines its `registerX`; files in the
  directory import each other directly, not through the index. AGENTS.md has the rule.
- Core and navigation never import shell, areas, features or tools. A module above them reaches into core through hooks (`registerSync`,
  `registerRetention`, `registerLogoutHandler`) from its own `registerX`,
  and `registerAll` in `src/app/index.ts` calls every `registerX`. The root layout calls
  `registerAll` first, and `core/app.ts` builds the `App` lazily after it.
  `flotilla-state` covers this under "App policies".

### Exceptions

No lint rule enforces the layers (`eslint.config.js` has no import restrictions), so review is the
only gate.

- **lib → app.** None. A lib component that needs app behavior takes it as a prop, or moves to
  `src/app/components`, as `IconInput` and its picker buttons did, and as `Link` did, which routes a
  click through `navigate`, with `PrimaryNavItem`, which renders it. Their CSS families stay in
  `lib/components`.
- **app → components.** The Electron screen-share adapter imports `ScreenSharePicker` to open a
  prompt in the middle of a flow that no component wraps. It is due to return a refusal that a flow
  maps to the prompt instead, as the voice tools return the provider to set up and
  `components/flows/voice.ts` opens its prompt.
- Nothing under `src/app` or `src/lib` imports from `src/routes`.

## Top-level layout

| Path | What it is |
|---|---|
| `src/routes` | SvelteKit pages; the root `+layout.svelte` also runs the boot sequence |
| `src/app` | Flotilla's state, policies and feature logic, plus `components/` |
| `src/lib` | App-agnostic utilities and the design-system components |
| `src/app.css` | The stylesheet the root layout imports: the design system, then the app's CSS families |
| `src/assets/icons` | SVG icons |
| `static/` | Logo, PWA icons, fonts, sounds |
| `android/`, `ios/` | Capacitor native projects, with flotilla's own plugins and iOS share extension |
| `electron/` | Desktop shell on `@capawesome/capacitor-electron`; a separate npm project |
| `server.js` | Optional node server: serves `build/` and adds link-preview metadata |
| `e2e/` | Playwright suite against a real relay; start with `e2e/ARCHITECTURE.md` |
| `scripts/` | Build, desktop, version-bump and welshman-linking scripts |
| `docs/feature_matrix.html` | Standalone feature matrix page |

## `src/app` by directory

`src/app/components` is flat except for `hosting/`, `editor/` and `flows/`. `editor/` is flotilla's `@welshman/editor` setup (`makeEditor.ts`, mounted by `EditorContent.svelte`), with its suggestion rows and node views. `flows/` holds the UI that several components share or that a route or the root layout starts: `share.ts` (sharing an event, native shares and the Android share intent), `quotes.ts` (`goToQuote`, `quoteEvent`), `messages.ts` (`openMessages`, which asks for messaging relays first), `readAloud.ts` (`readEventAloud`, which asks to leave a call first) and `deepLinks.ts`. It also holds the CSS families for app
concepts (`conversation.css`, `room.css`, `role-badge.css`, `space-menu.css`), which
`src/app.css` imports. `flotilla-views` covers component conventions.

**`core/`: the app, session and background machinery**
- `app.ts`: the `App` store, `appPolicies`, `fromApp`
- `user.ts`: `user`, `deriveUserItem`, the user's own entries (`userProfile`, `userRelayList`,
  `userFollowList`, `userMuteList`, `userSearchRelayList`, `userSearchRelayUrls`, `userRoomList`,
  `userSpaceUrls`, and `activeSpaceUrls`, which is the platform's relays when configured), `syncUserList`,
  and the sync of the user's lists and their follows' lists
- `plugins.ts`: `usePlugin` and the plugin stores (`profiles`, `rooms`, `events`, …)
- `domain.ts`: the `reader`/`writer`/`command` shortcuts
- `session.ts`: the `session` store, `login`, restoring the saved session at boot, `logout`, and
  `registerLogoutHandler`
- `ingest.ts`: what the app accepts from a relay. It checks signatures, lets a relay in
  `trusted_relays` strip them, and holds back unsigned events from any other in
  `relaysPendingTrust` until the user decides
- `auth.ts`: NIP-42. `shouldAuth` decides which challenges the app answers on its own, and
  `authenticate(url)` authenticates on demand and explains a failure
- `database.ts`: `EventDatabase`, the signed-in user's events in SQLite, with
  `registerRetention` for what it keeps; `database.worker.ts` serves it with flotilla's own tables,
  one module each for retention, wraps and plugin items
- `storage.ts`: `kv`/`ss` (Capacitor Preferences and SecureStorage), `openRepository`, and the
  per-user cache of everything that isn't an event, in the same database
- `sync.ts`: `syncApplicationData`, `registerSync`, and the helpers registered syncs are built
  from (`pullAndListen`, `syncEach`)
- `settings.ts`: the `Settings` plugin over encrypted app data, plus notification settings
- `relays.ts`: `deriveRelayAccess(url)`, the one answer to whether the app can use a relay and why
  not, built from the socket, its auth, whether the relay keeps refusing requests, and pending trust; plus the
  policy that keeps blocked relays closed
- `publications.ts` (publish status by event id), `signer.ts` (signer request tracking and
  `signerHealth`), `notify.ts`
- `env.ts`: every `VITE_` value, parsed
- `nip46.ts`
- `pomade.ts`: email login through pomade, the pomade session type, and deactivating the session on
  logout
- `logger.ts` (log capture and sending), `device.ts` (a device id)

**`navigation/`: routing**
- `define.ts`: `defineRoute`, typed against SvelteKit's generated `RouteId` and `RouteParams`
- `pages.ts`: a route object per page (its path, params and title), `makeContentPath`,
  `getPageTitle`, and the relay and conversation codecs
- `locations.ts`: where an event lives (`getEventPath`, `goToEvent`), permalinks,
  `getActivityTarget`
- `dialogs.ts`: `pushModal`, `popModal`, `clearModals` and the dialog stack in page state
- `overlays.ts`: the note overlay, carried in the url as `?note=`
- `toast.ts`: `pushToast`, which shows one toast at a time
- `navigate.ts`: `navigate`, which gives dialog entries back before it moves
- `history.ts`: the last page per space and in messages, `goToSpace`, `goToHome`,
  `goToMessages`, and `currentSpaceUrls` (the space on screen) and `syncedSpaceUrls` (the user's
  spaces plus that one, which space syncs run over)

**`features/`: one feature each**

The app's sections are DMs (`areas/messages.ts`), spaces (`spaces/`), the home page (`areas/home/`), and
hosting (`hosting.ts`, with its own auth). Each space concern is a sub-feature under `spaces/`:

- `spaces/activity.ts` (each space's latest activity per room, chat and content item, registered with `tools/activity.ts`)
- `spaces/sync.ts` (`syncCurrentSpace`, the space-wide relay and content syncs) and
  `spaces/reactions.ts` (reacting inside a space). `spaces/index.ts` registers the syncs and
  retention.
- `spaces/rooms/`: chat rooms. `room.ts` (one room's type, name and members), `publish.ts`
  (writing into a space or room), `lists.ts` (the user's room list), `permissions.ts`,
  `search.ts`, `transcript.ts` (grouping a room's messages into rows), `sync.ts`,
  `membership.ts` (joining and leaving a room, room invite codes), `pins.ts`, `commands.ts`
  (NIP-CD slash commands)
- `spaces/membership.ts`: joining and leaving a space, and whether someone is a member
- `spaces/invites.ts`: invite links, and accepting one
- `spaces/payments.ts`: relay fees, checkout, and the paid-space gate
- `spaces/management.ts`: NIP-86 admin checks and bans; `roles.ts` and `actionItems.ts` (the admin
  review queue)
- `spaces/calls/`: `state.ts` (call state), `participants.ts`, `layout.ts` (the video layout and
  spotlight), `endpoint.ts` (the relay's LiveKit endpoint), `engine.ts` (LiveKit join, leave,
  devices, the video tiles a call shows), `screenShare/`. Everything but `engine.ts` stays free of
  livekit values, since the root layout loads `calls/index.ts` and `engine.ts` is imported
  lazily.
- Content types: `spaces/articles.ts`, `calendar.ts`, `classifieds.ts`, `goals.ts`,
  `pinboards.ts`

Outside `spaces/`:

- Content: `feeds/` (lists that page as you scroll: `timeline.ts` is the core, a welshman projection of what the repository holds for some relays shown above a floor that paging lowers; `relayFeed.ts` is one relay's timeline, `authorFeed.ts` pages a set of authors in groups over their outboxes, `calendarFeed.ts` windows calendar events by day, `networkFeed.ts` builds the home Network tab's feed and a profile's, grouping notes, replies and follows' interactions into one card per note, with the persisted facet toggles; `windows.ts` asks the relays for one time range), `interactions/` (`interactions.ts` indexes the replies, reactions, zaps and comments an event collected by the event they answer and loads them in batches, `stats.ts` counts an event's comments, reactions, reposts and zaps, and `reactions.ts` reacts outside a space)
- `notes/`: kind 1 notes and the replies and comments under them. `notes.ts` holds the `Notes` plugin (loading a note, or many at once, from the relays its refs point at, and a reply's thread), `resolver.ts` loads in the background the notes a list names but doesn't hold, and `threads.ts` builds a thread's filters and comment tree
- Platform and voice: `push/` (`push.ts` picks a `PushAdapter` from `adapters/`, `actions.ts` holds the user's actions, `relaySubscriptions.ts` keeps the NIP-9a subscriptions on each relay, `taps.ts` opens what a tapped notification names, and `server.ts` talks to the push server's HTTP API), `reminders.ts`

**`tools/`, `areas/` and `shell/`: the layers `features/` is moving into**

- `tools/`: `activity.ts` (the latest activity per path, joined from the sources each area registers with `registerActivity`, and what is unread: `unreadPaths`, `unreadDots`, which the nav's dots draw, and the counts), `drafts.ts` (`DraftKey`, unsent form values held in memory), `wallet.ts` (wallet,
  invoices), `theme.ts` (`colorFor`, the active theme and font size), `uploads.ts` (Blossom, image
  compression), `scheduling.ts` (the message and error for a scheduled post a relay refuses), `render.ts` (events as
  plain text or a one-line summary, for push notifications and reading aloud), `content.ts`
  (`CONTENT_KINDS`, the kinds with a section of their own, and `partitionByActivity`, which the
  list pages use to sort a kind by latest comment), `targets.ts` (what an event is about: what a
  reply answers, a reaction reacts to, a zap zaps), and `alerts/` (which events alert, the user's
  alert settings, and `stream.ts`, the in-app stream of alerting messages), `publish.ts`
  (`publishToNetwork`, posting outside a space), `quotes.ts`, `share.ts` (the `Share` type,
  `pendingShare`, and `shareTo`, which hands a share to a room or conversation), and `people/`
  (`people.ts` has display names for any list of pubkeys and `bootstrapPubkeys`, and `muting.ts`
  has `isEventMuted` and `derivePubkeyMuted`, `statuses.ts` has the NIP-38 `Statuses` plugin, and `pins.ts` has a person's pinned notes), and `checked.ts` (what has been read, per path, synced
  to dufflepud, with `isChecked`, the rule for reading it, and `holdChecked`, which keeps a path
  unread while it's on screen), and `audio/` (speech to text and text to speech: `providers.ts`
  builds the voice providers with the user's settings, `stt.ts` holds a composer's dictation, kept
  across navigation and sent as a voice note or transcribed, and `tts.ts` holds the message being
  read aloud. Both return the provider to set up when none is ready, and `components/flows/voice.ts`
  opens its prompt)
- `areas/`: `messages.ts` (DM conversations, the gift-wrap sync and `shouldUnwrap`, and the conversations' activity), `home/` (the home page: `activity/` builds the Recent stream's rows, which are `ActivityItem`s of three types, a chat at its latest message, a space's unread content and what was done to one of your notes, with `model.ts` the pure part, `sync.ts` polling your inbox relays for what tags you, and `stream.ts` the stores the stream renders, `activityItems` and `activityCounts`; `healthChecks.ts` is the page's account checklist; `index.ts` defines `registerHome`), and `bookmarks.ts` (bookmark folders and search)
- `shell/`: `badges.ts` (the app icon badge, drawn from the unread count), `analytics.ts` (Plausible pageviews), `loading.ts` (the page loading bar),
  `signer/signerAlerts.ts` (the toast that offers help when the signer stops answering),
  `downloads.ts` (saving files the native app's web view downloads)

A feature gets a `src/app/features/<feature>.ts` only when it has non-UI logic to hold. Polls, goals,
threads and calendar events have no module; their components use domain readers directly.

## `src/lib`

Lib code is app-agnostic. It may use svelte, SvelteKit, Capacitor and welshman, but never `@app`,
env, or the `App` instance. A good test is whether it would work unchanged in another nostr
client.

- `util.ts`: small helpers (`errorMessage`, `buildUrl`, `normalizeTopic`, `makeCommentFilter`)
- `media.ts`: content types, a url's `imeta` tags, `isImageUrl`, and decrypting an encrypted
  attachment
- `html.ts`: DOM helpers such as `isMobile`, `createScroller`, `copyToClipboard`
- `icons.ts` (the icon picker's options, globbed from `@assets/icons`), `markdown.ts`
  (`markdownToText`), `keyboard.ts` (`syncKeyboard`, which marks the body `keyboard-open` while the native
  keyboard is up)
- `pager.ts`: a `Pager` (the load state of one direction of a list, and the `page`/`settle` actions a scroll container drives), `combinePagers`, and `followScroll`, which binds a pager to a scroll container
- `audio/`: `recorder.ts` (recording from the microphone), `devices.ts` (device lists and a live
  input level), `codec.ts` (decoding to mono samples at a model's rate, and WAV encoding),
  `playback.ts` (keeping Android awake while media plays), and `voice.ts` with `providers/` (the
  voice provider contract, `resolveVoiceProvider`, and the on-device and OpenRouter providers,
  configured with options). Speech to text takes a `File`, and text to speech returns one
- `push/permission.ts`: the push permission states and the message for each
- `stt/`: the on-device stt model (Whistle over a wasm engine, run in a worker), its download and
  cache, and `transcribeLocally`
- `tileGrid.ts` (the call grid's geometry), `location.ts` (place search, geohashes and a profile's
  location)
- `currency.ts`, `transition.ts`, `implicit.ts` (hands state from one page to the next)
- `test/`: the DEV-only hooks the e2e harness injects through
- `components/`: the design system, entered through `theme.css` (see `flotilla-views`), which
  `src/app.css` imports ahead of the app's own CSS families

## Boot sequence

`src/routes/+layout.svelte` runs the boot sequence. It calls `registerAll()` first, so every
`AppPolicy`, retention rule and sync hook is in place before anything calls `app.get()`. `applySavedTheme()` stamps the last theme and font
size from `localStorage` before first paint. Then, in order:

1. `restoreSession()` restores the saved session, if there is one, which builds a user-scoped
   `App` through `login`.
2. It awaits `.ready` on the `synced` stores boot reads (device, wallet, push and notification
   settings, `shouldUnwrap`, `forceHealthChecks`).
3. It waits for storage, then `setupDeepLinks()` listens for warm-start links and handles a
   cold-start one.
4. Each long-running subscription goes onto one `unsubscribers` list: `setupHistory`,
   `syncApplicationData`, `setupShareIntents`, `syncKeyboard`, badges, `Push.sync()`,
   `syncSignerAlerts`, and `syncTheme`, which mirrors the theme stores back to `localStorage`.

When login swaps in a new `App`, the layout runs `syncApplicationData` again. Routes render inside
`AppContainer`, behind the login gate, and `ModalContainer` renders outside it. `flotilla-state`
covers the gate, login and logout.

## Platform layer

One web build runs in several shells:

- **Web/PWA.** `SvelteKitPWA` in `vite.config.ts` generates the service worker and manifest,
  except when `FLOTILLA_DESKTOP=1`. `src/service-worker.js` only claims clients.
- **Android/iOS.** Capacitor wraps `build/` (`capacitor.config.ts`). `scripts/build/app.sh` runs the
  web build, `cap sync`, and native asset generation.
- **Desktop.** `electron/main.ts` starts the Capawesome Electron platform, driven by
  `scripts/desktop/build.sh` and `scripts/desktop/dev.mjs`.
- **`server.js`.** A Hono server that serves `build/`. For `/join` and `/spaces/...` URLs it
  rewrites the OpenGraph tags from the relay's NIP-11 document, fetched through welshman's
  `Relays`. `vite.config.server.ts` bundles it and the `Dockerfile` runs it. It is not an API, and
  the app works from any static host.

Platform checks call Capacitor directly. There is no wrapper module:

```ts
export const ENABLE_ZAPS = Capacitor.getPlatform() !== "ios" // src/app/core/env.ts
export const HOSTING_ENABLED = Capacitor.getPlatform() !== "ios" // src/app/features/hosting.ts

if (!Capacitor.isPluginAvailable("Keyboard")) return noop // src/lib/keyboard.ts
```

The iOS flags exist because of App Store payment policy, so anything that takes money checks
`ENABLE_ZAPS` or `HOSTING_ENABLED`. `isMobile` from `@lib/html` detects a touch screen and says
nothing about the platform.

Flotilla's own native code:

- `android/app/src/main/java/social/flotilla/`: `AndroidPushFallbackPlugin` and its worker (push
  without FCM), and `ShareIntentPlugin`. `MainActivity.java` registers them, and JS binds them with
  `registerPlugin` (`push/adapters/android.ts`, `components/flows/share.ts`).
- `ios/App/ShareExtension/`: the extension can't call into the app, so it opens a
  `flotilla://share` URL. `handleDeepLink` in `src/app/components/flows/deepLinks.ts` passes that to
  `shareFromNative`.

`Push` in `src/app/features/push/push.ts` chooses an adapter at runtime: the Android fallback, Capacitor
`PushNotifications` (FCM/APNs through `PUSH_SERVER`), or web notifications.

## Env and branding

`src/app/core/env.ts` reads the `VITE_` values and exports them as typed constants, with relay lists
parsed by `fromCsv` and `normalizeRelayUrl`. In DEV each lookup checks `window.__TEST_ENV__` first,
which lets the e2e harness point a browser at its own relays. Elsewhere, only `logger.ts` and the
about page read a `VITE_` value (`VITE_BUILD_HASH`); other `import.meta.env` reads are `DEV`
guards.

- `.env` is committed and holds working defaults. `.env.local` (gitignored) overrides it. There is
  no `.env.template`, though AGENTS.md and the README refer to one.
- Env is read at build time. `scripts/build/web.sh` sources `.env` without overwriting variables
  already set, then fills the `{NAME}`, `{URL}`, `{ACCENT}` and `{DESCRIPTION}` placeholders from
  `src/app.html` in `build/index.html`. `server.js` reads `VITE_PLATFORM_NAME` and
  `VITE_PLATFORM_DESCRIPTION` at runtime.
- A non-empty `VITE_PLATFORM_RELAYS` turns on platform mode, which disables space browsing and
  makes the first platform relay the home page (`goToHome` in `navigation/history.ts`, `PrimaryNav`,
  `sync.ts`).
- `VITE_THEME`, exported as `FL_THEME`, selects the design preset in
  `src/lib/components/theme.css`.
- `VITE_HIDE_NOSTR`, exported as `HIDE_NOSTR`, hides protocol details: relay addresses and relay
  settings, npubs, NIP-05 addresses, event and profile JSON, and nostr explainers. A space named by
  its address goes through `RelayLabel`, which shows its name instead when the flag is set.
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
- Flotilla has no unit tests. `e2e/` is a Playwright suite against a real relay in Docker, zooid by
  default or caravel with `E2E_RELAY=caravel`; `e2e/ARCHITECTURE.md` explains the harness and `e2e/USER_STORIES.md` lists the stories the specs
  cite. Agents don't run it. Its only footprint in the app is `src/lib/test/`.
- `scripts/link-deps.mjs` links `../welshman/packages/*` by writing temporary `link:` overrides
  into `pnpm-workspace.yaml`, installing, and restoring the file. Without those overrides welshman
  comes from the registry, so read its source under `node_modules/@welshman/*/dist`, or in
  `../welshman` when that checkout matches the installed version.

## Principles behind placement

**Check welshman before writing flotilla code.** Several commits replace app code with welshman
primitives: `tools/render.ts` uses welshman's `summarize` (`9b0d8a55`), `spaces/actionItems.ts` uses
`rooms.get().pendingJoins` (`3d66fb31`), and `spaces/rooms` uses the membership helpers (`847d8984`).

**When welshman lacks something, add it there.** The maintainer also maintains welshman, so a
missing primitive goes upstream rather than into an `@app` workaround. The `Command` and
`Pinboard` kinds live in `@welshman/domain`, and flotilla's `spaces/rooms/commands.ts` and `pinboards.ts` only
consume them. Expect rejection for app-level retry loops, liveness heuristics, or registries that
duplicate what `@welshman/net` already tracks.

**Add indirection only when it pays for itself.** `core/domain.ts` exports the `reader`, `writer` and
`command` shortcuts because "almost every read or write goes through one of them". Platform checks
stay inline rather than going through a platform module, and `drafts.ts` is a module-level `Map`
rather than a persisted store.

## Placement guide

- **Parsing or building a nostr kind** → upstream in `@welshman/domain`, used through `reader` and
  `writer` from `@app/core/domain`. See `flotilla-model` ("Adding a kind") and `welshman-domain`.
- **A space section for a kind** → a route under `src/routes/spaces/[relay]/`, with the kind in
  `CONTENT_KINDS`. The walkthrough below names every file involved, and `flotilla-model` ("Adding
  a kind") and `flotilla-views` ("Adding a space content page") have the checklists. Add the
  section to the regexes in `server.js`, or its link previews are titled as a room.
- **Non-UI logic** (scoring, filtering, stores keyed by URL), with no component imports →
  `src/app/areas/<area>` when one section of the app owns it, `src/app/tools` when several areas
  build on it, `src/app/shell` when it spans areas or serves the whole app from the root layout,
  and `src/lib` when it needs nothing from the app once its dependencies are passed in.
- **A keyed collection of one kind** → a plugin. A generic kind's plugin goes upstream in
  `@welshman/app`; a flotilla-specific one is a `DerivedPlugin` in `src/app`, exposed with
  `usePlugin`. See `flotilla-state`.
- **A preference** → a `SettingsValues` field in `settings.ts` if it follows the user, or a
  `kv`/`ss` store if it belongs to the device. See `flotilla-state`.
- **A relay or network policy** (what to ingest, when to AUTH, which sockets may open) → an
  `AppPolicy` registered by the module that owns the concern, using `pool.addSocketPolicy` for a
  socket policy. See `flotilla-state` and `welshman-net`.
- **Data every joined space needs locally** → a `registerSync` from the sub-feature's `registerX`,
  usually `syncEach(syncedSpaceUrls, …)` or `syncEach(currentSpaceUrls, …)`. Data that
  one page needs is loaded by that page. See `flotilla-state` and `flotilla-views`.
- **A modal or dialog** → `src/app/components/<Name>.svelte`, opened with `pushModal`. See
  `flotilla-views`.
- **A generic UI primitive** → `src/lib/components/<Name>.svelte` with a CSS family file next to it
  (`Button.svelte` and `button.css`), and no `@app` imports. See `flotilla-views`.
- **A non-nostr HTTP service** → its own module with typed request functions, a typed error class
  and a base URL from env, as in `hosting.ts` (`hostingFetch`, `HostingError`,
  `HOSTING_BACKEND_URL`).
- **A native capability** → JS in `src/lib/<capability>.ts`, or `src/app/tools/<capability>.ts` when it
  needs app state, with inline `Capacitor` checks and a web fallback. If no Capacitor plugin fits, write one under
  `android/app/src/main/java/social/flotilla/`, register it in `MainActivity.java`, and bind it
  with `registerPlugin`. An iOS extension reaches the app through a `flotilla://` deep link.
- **A deployment setting** → a `VITE_` variable (see Env and branding).
- **Startup wiring** → a `setup*` or `sync*` function in the owning module that returns an
  `Unsubscriber`, called from the root layout (`setupHistory`, `syncKeyboard`, `Push.sync`).
- **A module's contribution to core** (background sync, what storage keeps, logout cleanup) → a
  `registerX` in the module that calls core's hooks, added to `registerAll` in
  `src/app/index.ts`.

## Walkthrough: classifieds

Classifieds (NIP-99, kind 30402, `CLASSIFIED`) touch every layer and follow current conventions
(`e6ce3e5e` is their redesign). Polls, goals, threads and calendar have the same shape without the
app module.

**Domain.** `Classified` in `@welshman/domain` pairs a `ClassifiedReader` (`title()`,
`summary()`, `price()`, `status()`, `images()`, `topics()`) with a `ClassifiedWriter` that has the
matching setters.

**Kind registries.** `CONTENT_KINDS` in `src/app/tools/content.ts` drives sync, notifications, push,
search and the space nav entry. The kind also appears in the noun switch in `HomeActivity`, the kind dispatch in
`NoteContent.svelte` and `NoteContentMinimal.svelte`, the `classifieds` and `classified` routes
and `makeContentPath` in `navigation/pages.ts`, `NIP46_PERMS` in `nip46.ts`, and the section regexes in `server.js`.
`NIP46_PERMS` leaves out polls, articles and goals, so listing a new kind there is optional.

**App module.** `src/app/features/spaces/classifieds.ts` holds the listing logic the page would otherwise inline
(`deriveTopicCounts`, `getStatus`, `matchesTopic`, `matchesQuery`). Each is a
small function over a domain reader:

```ts
export const getStatus = (event: TrustedEvent) => reader(Classified)(event).status() ?? "active"
```

**Components.** `ClassifiedForm` builds and publishes the event, and `ClassifiedCreate` and
`ClassifiedEdit` wrap it, supplying only the header. The list page and `ComposeMenu` open
`ClassifiedCreate` as a modal. From a room, `ComposeMenu` sets `shareToChat`, which also quotes the
new listing into the room. Its `ContentActions` row opens `ClassifiedEdit` through `editForm`. `ClassifiedItem` is the
card, and `NoteContentClassified` renders a listing wherever `NoteContent` is used.

**Routes.** `src/routes/spaces/[relay]/classifieds/+page.svelte` loads listings and their comments
with `makeSpaceFeed` and filters them with the `classifieds.ts` helpers. `[address]/+page.svelte` reads
one listing with `$events.one(address, [url]).$`.

Articles are composed on a full page (`spaces/[relay]/articles/create`, whose
`pages.articleCreate` route carries `h` and `shareToChat`) instead of in a modal. The page decodes
them from its route and renders `ArticleForm`.

## Related skills

- `flotilla-state`: the `App` instance and plugins, policies, persistence, sync, publishing
- `flotilla-views`: routes and layouts, components, modals, loading data from components
- `flotilla-model`: spaces as relays, NIP-29 rooms, NIP-86 management, content kinds, routing
- `welshman`: overview of the packages
- `welshman-app`: `App`, `use()`, `AppPolicy`, `DerivedPlugin`, commands and the `Publisher`
- `welshman-domain`: readers, writers, and adding a kind
- `welshman-net`: the pool, sockets and socket policies
- `welshman-util`: kind constants, tag specs, `RelaySelection`
