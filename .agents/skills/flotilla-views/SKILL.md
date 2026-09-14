---
name: flotilla-views
description: "Use this skill when adding or changing a route, layout, page, or component in flotilla: deciding between src/lib/components and src/app/components, naming a component, choosing its props, navigating or opening a modal, drawer, popover or toast, building a create/edit form, loading data from a page or component (detail pages, feeds, infinite scroll), wiring a button to a mutation with loading and error states, or styling a component."
---

# Flotilla views: routes, components, and how they reach state

Pages read their params, load what they show, and hand identifiers to components. Components are
flat, noun-first, and derive the rest from those identifiers.

## Routing

### No load functions

Nothing renders on a server (`ssr = false`; see flotilla-architecture for the build), so there are
no `+page.ts` files. Every page loads its own data in `onMount` or an `$effect`, and every layout
is a `+layout.svelte`.

### The tree

```
/                          redirect: goToHome()          /home    dashboard (Home* sections)
/spaces                    your spaces + discovery       /spaces/create
/spaces/[relay]            mobile space menu; desktop redirects to goToSpace()
/spaces/[relay]/[h]        room chat                     /spaces/[relay]/chat  space-level chat
/spaces/[relay]/{about,admin,directory,library}
/spaces/[relay]/{threads,goals,polls}[/[id]]
/spaces/[relay]/{classifieds,articles,calendar}[/[address]]     articles/create
/chat, /chat/[chat]        DMs                           /people/[npub]  profile page
/settings/{profile,alerts,wallet,hosting,content,privacy,theme,about}
/join                      invite link landing           /share   share-intent landing
/[bech32]                  any nip19 entity, resolved and redirected
```

### Params

- `[relay]`: `encodeRelay(url)` and `decodeRelay(param)` in `src/app/relays.ts`. Encoding strips
  `wss://` and the trailing slash and URI-encodes the rest; decoding normalizes it back. Build
  paths with the helpers in `src/app/routes.ts` rather than by hand.
- `[h]`: the NIP-29 room id, unencoded (`makeRoomPath(url, h)`). Static segments win over it,
  which `makeSpaceChatPath(url)` relies on: it is `makeRoomPath(url, "chat")` and lands on the
  static `chat` page. A new static segment under `[relay]` shadows any room with that id.
- `[id]` for regular events, `[address]` for addressable ones. `makeSpacePath(url, ...extra)`
  URI-encodes each extra segment and drops `undefined`, so `makeClassifiedPath(url, address)` is
  safe. `[chat]` is `makeChatId(pubkeys)` from `src/app/chats.ts`, and `[npub]` comes from
  `makeProfilePath(pubkey)`.
- State that shouldn't be a route goes in the query string: `?at=` (jump to a message), `?topic=`,
  `?board=`, `?page=`, and `?h=&shareToChat=1` on article create.

Pages read params once into constants:

```typescript
const {relay, address} = $page.params as MakeNonOptional<typeof $page.params>
const url = decodeRelay(relay)
```

That is safe because the layouts remount their children when a param changes.
`spaces/+layout.svelte` keys on `relay`, `spaces/[relay]/+layout.svelte` and
`chat/+layout.svelte` key on the pathname, `[h]/+layout.svelte` keys on `?at=`, and
`people/[npub]/+layout.svelte` keys on `npub`. A new param-bearing route needs the same `{#key}`,
or its page has to derive from `$page` instead. Routes read `$page` from the deprecated
`$app/stores`; only the two modal modules use `page` from `$app/state`.

### Layouts

- `src/routes/+layout.svelte` runs the boot sequence, renders `AppContainer` and
  `ModalContainer`, and sets `document.title` from `getPageTitle`. `AppContainer` gates the route
  on a signed-in user (flotilla-state), showing `Landing` in a `noEscape` dialog otherwise.
- `spaces/[relay]/+layout.svelte` gates the space, pushing one modal at a time, once per url:
  `SpaceRedirect` (the NIP-11 document carries a `redirect_to`), `SpaceJoin` (the space is not in
  the user's room list, checked after a `forceLoad`), `SpaceAuthError`, `SpaceTrustRelay`. It
  renders `SecondaryNav` with `SpaceMenu` and wraps the page in `Page`, except at the space root.
- `settings/+layout.svelte` is a `SecondaryNav` of `SecondaryNavItem` links. A new settings page
  needs an entry there.
- `chat/+layout.svelte` is the conversation list, plus a FAB to start a chat.

Since the space layout supplies `Page`, a space page renders a `SpaceBar` and a `PageContent`:

```svelte
<SpaceBar>
  {#snippet leading()}<Icon icon={CaseMinimalistic} />{/snippet}
  {#snippet title()}<strong>Classifieds</strong>{/snippet}
  {#snippet action()}
    <Button class="button button-primary button-sm" onclick={createClassified}>Create</Button>
  {/snippet}
</SpaceBar>
<PageContent bind:element class="@container flex flex-col gap-3 p-2 sm:gap-4 sm:p-4">
```

Detail pages also pass `back`, a handler that calls `history.back()`, which `SpaceBar` shows on
mobile. Pages outside a space use `Page`, `PageBar` and `PageContent` themselves.

### URL builders, titles, deep links

`src/app/routes.ts` is the only place paths are built:

- `makeSpacePath`, `makeRoomPath`, `makeSpaceChatPath`, `makeProfilePath`, `makeChatPath`, and
  one builder per content page (`makeThreadPath`, `makeClassifiedPath`, `makeArticlePath`,
  `makeCalendarPath`, `makeGoalPath`, `makePollPath`, `makeLibraryPath`, `makeArticleCreatePath`).
- `makeContentPath(url, kind, idOrAddress)` maps a kind to its page. `makeEventPath` builds on it
  for any event, covering DMs, room messages (`?at=`) and comments (through the parent's `K`,
  `A` and `E` tags), and falls back to `entityLink` from `src/app/env.ts`, an external link.
- `goToEvent(event)` scrolls to the event if it is already rendered with a `data-event` attribute
  and navigates otherwise; `makeEventPermalink` is the shareable form.
- `goToSpace(url)` goes to `makeSpaceEntryPath(url)`: the last page visited in that space, which
  `setupHistory` records, else chat or about. `goToChat(pubkeys)` checks for messaging relays
  first, pushing `ChatEnable` if there are none.

`src/app/title.ts` maps route ids to tab titles. A new static route needs a `staticTitles` entry,
and a new event detail route needs an `eventRoutes` entry and a branch in `getPageTitle`.
Without one the tab shows only `PLATFORM_NAME`.

Deep links arrive in `handleDeepLink` in the root layout: push-notification links (`?relay=&id=`),
the iOS share extension (the `share` host), signer returns (`x-callback-url`), and otherwise a
plain path. Nostr entities go through `/[bech32]`, which sends profiles to `makeProfilePath`, and
loads events before calling `goToEvent`.

### Adding a space content page

1. `src/routes/spaces/[relay]/<name>/+page.svelte`, plus `[id]` or `[address]` for detail.
2. `make<Name>Path` in `src/app/routes.ts`, and a case in `makeContentPath`, so notifications and
   permalinks land there.
3. Titles in `src/app/title.ts`.
4. A `SecondaryNavItem` in `SpaceMenuNavItems.svelte`. Content entries appear only once the space
   holds that kind, which comes from `CONTENT_KINDS` in `src/app/content.ts`.

The registries outside the view layer, including the link-preview server, are in
flotilla-architecture and flotilla-model.

## Navigation, modals, popovers, toasts

### navigate, not goto

`navigate(path, {replaceState, keepModal})` in `src/app/modal.ts` wraps `goto`. With a modal open
it replaces the modal's history entry, so Back doesn't reopen it, and `keepModal` changes the
page underneath while leaving the stack open (`goToHome` uses it). `Link` calls `navigate` and
stops propagation, so a link inside a clickable card only follows the link. Plain `goto` survives
in pages for query-string updates (`replaceState`, `noScroll`, `keepFocus`) and redirects, where
no modal can be open.

### pushModal

```typescript
pushModal(ClassifiedEdit, {url, event})                        // replaces any open modals
pushModal(WalletConnect, {}, {nested: true})                   // stacks on top of the current one
pushModal(EmojiPicker, {onClick: onEmoji}, {replaceState: true}) // swaps out the current one
pushModal(SpaceMenuDrawer, {url: spaceUrl}, {drawer: true})    // side drawer instead of a dialog
```

Open modal ids live in SvelteKit page state (`App.PageState.modals` in `src/app.d.ts`), the
components live in a `$state` record in `src/app/modal.svelte.ts`, and `ModalContainer` mounts
each one inside `Dialog` or `Drawer`. Each modal owns a history entry, so Back closes it, and a
push without `nested` replaces the whole stack. `replaceState` suits mobile menus that open a
follow-up (`RoomItemMenuMobile`) and multi-step flows. `noEscape` removes the close button and
ignores Escape and the backdrop; the space gates use it. `ModalOptions.path` is never read.

Modal components take identifiers like any other component. `Dialog` supplies the chrome, and
`/join` renders `SpaceInviteAccept` in a `Dialog` directly. The usual shape:

```svelte
<Modal tag="form" onsubmit={preventDefault(submit)}>
  <ModalBody>
    <ModalHeader>
      <ModalTitle>Create a Room</ModalTitle>
      <ModalSubtitle>On <span class="text-primary">{displayRelayUrl(url)}</span></ModalSubtitle>
    </ModalHeader>
    ...fields
  </ModalBody>
  <ModalFooter>
    <Button class="button button-link" onclick={back}>Go back</Button>
    <Button type="submit" class="button button-primary" disabled={loading}>
      <Spinner {loading}>Create Room</Spinner>
    </Button>
  </ModalFooter>
</Modal>
```

A modal closes itself with `history.back()`, in 116 call sites. `clearModals()` ends a flow that
may sit on top of other modals, such as a delete confirmed from a menu. `popModal()` closes the
modal before doing something else in the same handler, where `history.back()` would race it:
`ProfileDetail` pops before `goToChat`, and `SearchBody` pops before `goToEvent`.

For yes/no questions, push `Confirm` from lib with `{title, message, confirm}`; it runs `confirm`
behind its own loading state. Reusable confirmations get a `*Confirm` wrapper
(`EventDeleteConfirm`).

### Popover menus

`MenuButton` renders a `Tippy` popover around the component you pass, adding an `onClick` prop
that hides it:

```svelte
<MenuButton component={ChatMenu} aria-label="Chat options" />
```

`EventMenu` attaches `onClick` to its `<ul>`, so any item closes the popover, and each item
usually pushes a modal. On mobile, rows push a `*MenuMobile` modal instead: `RoomItem` pushes
`RoomItemMenuMobile` on tap.

### Toasts

`pushToast` in `src/app/toast.ts` shows one toast at a time:

```typescript
pushToast({message: "Role created!"})
pushToast({theme: "error", message, action: {message: "Details", onclick}})
pushToast({timeout: 30_000, children: {component: ThunkToast, props: {thunk}}})
```

A `children` component receives the `toast` as a prop, so it can pop itself. `clip(value)` copies
to the clipboard and toasts.

## lib vs app components

`src/lib/components` knows nothing about the app instance, stores, or nostr kinds. Its components
import third-party libraries, `@welshman/lib` helpers, `@lib/*` and `@assets/*`, plus
`$app/stores` in `PrimaryNavItem` and `SecondaryNavItem`, which highlight the active path. What
lives there:

- page chrome: `Page`, `PageBar`, `PageContent`, `SecondaryNav*`, `PrimaryNavItem`, `FAB`
- modal chrome: `Dialog`, `Drawer`, `Modal`, `ModalBody`, `ModalHeader`, `ModalTitle`,
  `ModalSubtitle`, `ModalFooter`, `Confirm`
- controls: `Button`, `Link`, `Field`, `FieldInline`, `Input`, `InputList`, `ToggleInput`,
  `DateTimeInput`, `ImagesInput`, `IconInput`, `EmojiPicker`, `MenuButton`
- display and lists: `Icon`, `Badge`, `Card`, `Divider`, `Spinner`, `Tooltip`, `Tippy`,
  `Popover`, `Cv`, `VirtualList`, `Masonry`, `DragList`, `ScrollToTop`
- the CSS component families (`button.css`, `card.css`, …) and the theme tokens

Anything that takes an identifier and reads a store, publishes, or knows a kind is an app
component. A lib component that needs app behavior takes it as a prop, such as `MenuButton`'s
`component`. Three lib components import `@app` anyway; flotilla-architecture lists them under
its layer exceptions.

`src/app/components` is flat, and `hosting/` is the only subdirectory it has ever had, brought in
whole by the caravel port (cf938c63) with names that would blur into the flat `Relay*` family.
New components go in the flat folder.

## Naming

Names are `<Entity><Qualifier>`: the prefix says what it's about, the suffix what it does, which
keeps families adjacent in a flat listing. `ClassifiedActions`, `ClassifiedCreate`,
`ClassifiedEdit`, `ClassifiedForm`, `ClassifiedItem`, `ClassifiedStatus`.

Name a modal for what it does (`SpaceJoin`, `ClassifiedCreate`, `EventDeleteConfirm`); only a
handful carry a `Modal` or `Dialog` suffix. The suffix vocabulary, the prefix families, and the
names that break the pattern are in [naming.md](naming.md).

## Props

### Identifiers first, the event when you have it

`url` is a prop in 159 components, `h` in 32 and `pubkey` in 28. Relays, rooms and profiles have
stores, so a component takes the key and looks up the rest: `RoomName` takes `{url, h}` and reads
`$rooms.forRoom(url, h)`, `ProfileName` takes `pubkey` and reads `$profiles.display`.

Events are the exception, and 66 components take `event: TrustedEvent`, since the parent already
holds the event from a feed or a `deriveEvent`. An event prop usually travels with `url`, the
relay it lives on, which routes its replies and reactions, and with `context: FeedContext`, the
shared loader below. A component takes a pointer instead only when it has to load the event
itself, as `ContentQuote` does. Anything with neither a store nor an event is passed as its
domain reader: `RoleEdit` takes `role: RelayRoleReader`.

Identifier props are read once, `const room = $rooms.forRoom(url, h)`, since pages remount on a
param change and lists key by id. A prop that does change while mounted needs `$derived`:
`ClassifiedActions` reads its event that way, because editing a listing hands it a new version.

### The rest of the vocabulary

- Callbacks are camelCase `on*`: `onSubmit`, `onClose`, `onCancel`, `onReply`, `onSelect`,
  `onResolved`, plus the `onClick` that closes a popover. `RoomForm` and `ProfileEditForm` take a
  lowercase `onsubmit`, a leftover.
- Steps in a flow take `next`, and the signup steps add `step` and `totalSteps`.
- Snippets: `children`; `header` and `footer` on forms; `customActions`, which adds items to
  `EventActions`, `EventMenu` and `ProfileMenu`; `leading`, `title` and `action` on `SpaceBar`. A
  snippet can take arguments, as `RoomForm`'s `footer: Snippet<[{loading: boolean}]>` does.
- `$bindable` is for input-like components: `value` on `TopicMultiSelect` and
  `ProfileMultiSelect`, `element` on `PageContent`, `notifications` on `SpaceJoinNotifications`.
- Display flags are fine (`showRoom`, `showActivity`, `hideZap`, `class`); derived data is not.
- 24 app components and 20 lib components declare `interface Props`, against 232 using `type`.

## Reading state in a component

Components read plugins through the `usePlugin` stores exported from `src/app/core.ts`
(`$profiles`, `$relays`, `$rooms`, `$roomLists`, `$network`, `$thunks`, `$deletes`,
`$relayManagement`, …). `$app.use(X)` covers plugins with no export, such as `Zappers`,
`Pinboards` and `Feeds`; flotilla-state has the rules about which to use where.

How you bind depends on what the method returns:

```svelte
<script lang="ts">
  const room = $rooms.forRoom(url, h)                                 // Readable: one, forRoom
  const display = $profiles.display(pubkey, removeUndefined([url])).$ // Projection: take .$
  const shouldProtect = $relays.hasNip(url, 70)                       // Promise: load, hasNip
</script>

{$room?.meta?.name() || h} · {$display}
```

In a handler, call `.get()` on a projection instead of subscribing. The app modules add `derive*`
factories over the same data: `deriveEvent` and `deriveEventsById` in `src/app/repository.ts`,
`deriveUserIsSpaceAdmin` in `src/app/management.ts`, `deriveRelayAuthError` in
`src/app/access.ts`. Call them at the top of the script with fixed arguments, and wrap one in
`$derived` only when its arguments change, as the thread page does for filters that wait on the
root event.

Read an event's tags through a domain reader, `$derived(reader(Classified)(event))`, with
`reader` from `@app/core`. `$user` throws signed out, so use it only under the login gate.

## Loading from the network

A page or component loads what it displays; a layout loads what it gates on. Background sync for
data every page needs lives in `src/app/sync.ts`.

**One entity, or a handful of lists:** call plugin `load` in `onMount`, and toast on failure, as
`people/[npub]/+page.svelte` does for the profile, relay list, follow, pin, room and messaging
lists before loading the author's outbox with `$network.load`.

**A detail page:** `deriveEvent(address, [url])` loads when nothing local matches. While it is
empty, seven pages show a spinner that turns into a failure message:

```svelte
{#await sleep(5000)}
  <Spinner loading>Loading listing...</Spinner>
{:then}
  <p>Failed to load classified listing.</p>
{/await}
```

**Related events:** request them, abort on teardown, and read them back from the repository with
`deriveEventsAsc(deriveEventsById(filters))`.

```typescript
onMount(() => {
  const controller = new AbortController()

  $network.request({relays, filters, signal: controller.signal})

  return () => controller.abort()
})
```

That is `EventComments`. The thread detail page does the same in an `$effect`.

**A list that pages as you scroll:** `makeFeed`, `makeScrollLoader` and `makeFeedContext` from
`src/app/feeds.ts`. Every space list page uses them, as do `HomeNetwork`, `ProfilePageNotes` and
`RoomChat`. The threads and classifieds pages are the reference:

```typescript
const context = makeFeedContext({relays: [url]})

onDestroy(context.cleanup)

let older: Maybe<ReturnType<typeof makeScrollLoader>> = $state()
let element: HTMLElement | undefined = $state()
let events: Readable<TrustedEvent[]> = $state(readable([]))

const loading = $derived(isFeedLoading($older))
const exhausted = $derived($older?.status === "exhausted")

onMount(() => {
  const feed = makeFeed({relays: [url], onEvent: context.add, filters})

  events = feed.events
  older = makeScrollLoader(element!, feed.loadOlder)

  return () => {
    older?.stop()
    feed.cleanup()
  }
})
```

The feed is built in `onMount` because the loader needs the bound scroll element from
`<PageContent bind:element>`. `context.add` batches the reactions, comments and deletions for
every event the feed yields, rows get the same `context`, and their `*Actions` read
`context.related(event)` and `context.deleted(event)`. Close the list with `<Spinner {loading}>`
and an `{#if}` chain over loading, empty and exhausted. Calendars use
`makeCalendarFeed`, which pages by date tag rather than `created_at`.

`ProfileFeed` still drives welshman's `FeedController` through
`$app.use(Feeds).makeFeedController` and `createScroller`, but 27fa25c3 moved the home feed onto
the app helpers, which is the direction for new lists. Only `RoomChat` virtualizes; other long
lists wrap each row's root in `Cv`, which applies `content-visibility` and paints two viewports
ahead. All ten `*Item` components that appear in a list use it.

## Mutations from a component

flotilla-state covers the writer → command → thunk path. The component around it owns a
`loading` flag, awaits the first error, toasts it, and closes:

```typescript
const submit = async () => {
  loading = true

  try {
    const thunk = await command(eventWriter).then(publish)
    const error = await thunk.waitForError()

    if (error) {
      return pushToast({theme: "error", message: error})
    }

    history.back()
  } finally {
    loading = false
  }
}
```

Bind the flag to the button with `disabled={loading}` and `<Spinner {loading}>`. Plugin mutators
return a `Command` as well: `$deletes.deleteEvent(event, w => w.setProtected(protect))` then
`.publishToRelays([url])` in `EventDeleteConfirm`, or `$rooms.createRoom(url, room)` then
`.publish()` in `RoomForm`. NIP-86 calls resolve to `{error}` instead of a thunk:
`$relayManagement.forUrl(url).createRole(...)` in `RoleCreate`.

The hosting backend isn't nostr. Toast a readable message, and `console.error` anything that
isn't a `HostingError`, as `HomeHosting` and `hosting/CustomDomainModal` do. Publishes are
optimistic, so rows show progress in place: the seven per-kind `*Actions` components wrap their
contents in `ThunkStatusOrDeleted`, and chat pushes a `ThunkToast`.

## Forms

`Field` puts a label above its control, with optional `secondary` and `info` snippets.
`FieldInline` puts the label left and the control right, as settings and detail rows do. Controls
are plain elements styled by class (`<label class="input …">`, `<select class="select input">`),
or bindable inputs from lib (`ImagesInput`, `IconInput`) and app (`TopicMultiSelect`).

Create/edit pairs come in three shapes:

- **Fields only.** `RoleForm` exports `Values` from `<script module>`, takes
  `initialValues?: Partial<Values>`, `loading` and `onSubmit(values)`, and renders the footer.
  `RoleCreate` and `RoleEdit` each own their mutation, toast and close. `hosting/RelayForm` does
  the same with `Pick<HostedRelay, …>`. Use this shape when create and edit differ.
- **The form owns the mutation.** `RoomForm` creates, edits and joins, while `RoomCreate` and
  `RoomEdit` supply `header`, `footer({loading})` and where to go next.
- **The form owns the mutation and a draft.** `ClassifiedForm` persists fields with `DraftKey`
  and republishes the same `d` on edit. `ClassifiedCreate` passes a header, and `ClassifiedEdit`
  turns a reader into `initialValues`. Its `Values` type stays local, so `ClassifiedEdit`
  restates the shape; export it instead.

Rich text uses `makeEditor` from `src/app/editor` with `EditorContent`.

## Styling

- Classes come from the component families in `src/lib/components/*.css`, which `theme.css`
  imports: `button` with `button-primary|neutral|link|ghost|error` and
  `button-sm|xs|circle|square`, `card`, `badge`, `input`, `select`, `textarea`, `menu`. These are
  flotilla's own; daisyUI is not installed.
- Colors are the semantic tokens registered in `base.css`: `bg-surface`, `bg-surface-more`,
  `text-content`, `text-content-muted`, `border-line`, `text-primary`, `text-error`. The clay,
  flat and navy themes supply the values through `data-fl-theme`.
- Seven `class:` directives remain as leftovers; everything else builds classes with `cx`.
- Container queries go on the `PageContent`, as in `@2xl:grid-cols-2` for the classifieds grid.
- Icons are `import X from "@assets/icons/<name>.svg?dataurl"` with `<Icon icon={X} size={4} />`,
  where `size` counts 4px steps. List entries animate with `in:fly` from `@lib/transition`.

## Related skills

- `flotilla-architecture`: layer rules and exceptions, the `src/app` modules, boot, placement
- `flotilla-state`: plugin stores, `derive*` stores, drafts, settings, thunks and commands
- `flotilla-model`: spaces, rooms, NIP-43/29/86, content kinds, and where events are published
- `welshman-app`: plugins, projections, `Command`, thunks, `Feeds`
- `welshman-store`: `deriveEventsById`, `deriveEventsAsc`, the other repository stores
- `welshman-domain`: the readers and writers behind `reader` and `writer`
- `welshman-feeds`: `FeedController`, still used by `ProfileFeed`
- `welshman-editor`: the composer behind `makeEditor`
