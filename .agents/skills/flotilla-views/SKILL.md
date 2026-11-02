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
/spaces/[relay]/{about,admin,library}
/spaces/[relay]/{threads,goals,polls}[/[id]]
/spaces/[relay]/{classifieds,articles,calendar}[/[address]]     articles/create
/notes/[nevent], /articles/[naddr], /articles/create   content with no space behind it
/chat, /chat/[chat]        DMs                           /people/[npub]  profile page
/settings/{profile,alerts,wallet,hosting,content,privacy,theme,about}
/join                      invite link landing           /share   share-intent landing
/[bech32]                  any nip19 entity, resolved and redirected
```

### Params

Every page has a route object in `src/app/navigation/pages.ts`, built with `defineRoute` from
`src/app/navigation/define.ts` and keyed by SvelteKit's generated `RouteId`. A route turns domain
values into its path (`pages.room.path({url, h})`) and its params back
(`pages.room.decode(params)`), and gives the page's title. Callers import the module as
`import * as pages from "@app/navigation/pages"`. Paths are byte-for-byte what they always were,
since unread state is keyed by them.

- `[relay]`: `encodeRelay(url)` strips `wss://` and the trailing slash and URI-encodes the rest;
  `decodeRelay` normalizes it back.
- `[h]`: the NIP-29 room id, unencoded. Static segments win over it, which `pages.spaceChat`
  relies on: its path is the room path for `chat`. A new static segment under `[relay]` shadows
  any room with that id.
- `[id]` for regular events, `[address]` for addressable ones, both URI-encoded. `[chat]` is
  `makeConversationId(pubkeys)` and `[npub]` the profile's npub, both owned by their routes.
- Query parameters a route owns are part of its params: `at` on rooms and the space chat,
  `topic` on classifieds, `h` and `shareToChat` on article create. `?event=` is the permalink
  target any page can carry, and `?note=` opens a note over any page.

Pages read params once into constants:

```typescript
const {params}: PageProps = $props()
const {url, address} = pages.classified.decode(params)
```

That is safe because the layouts remount their children when a param changes.
`spaces/+layout.svelte` keys on `relay`, `spaces/[relay]/+layout.svelte` and
`chat/+layout.svelte` key on the pathname, `[h]/+layout.svelte` and the space chat page key on
`?at=` and `?event=` (which is how a room transcript re-anchors on a permalink), and
`people/[npub]/+layout.svelte` keys on `npub`. A new param-bearing route needs the same `{#key}`,
or its page has to derive from `$page` instead. Routes read `$page` from the deprecated
`$app/stores`; the navigation modules use `page` from `$app/state`.

### Layouts

- `src/routes/+layout.svelte` runs the boot sequence, renders `AppContainer` and
  `ModalContainer`, and sets `document.title` from `getPageTitle`. `AppContainer` gates the route
  on a signed-in user (flotilla-state), showing `Landing` in a `noEscape` dialog otherwise.
- `spaces/[relay]/+layout.svelte` authenticates to the space on mount and gates it, pushing one
  modal at a time, once per url:
  `SpaceRedirect` (the NIP-11 document carries a `redirect_to`), `SpaceJoin` (the space is not in
  the user's room list, checked after a `forceLoad`), `SpaceAuthError`, `SpaceTrustRelay`. It
  renders `SecondaryNav` with `SpaceMenu` and wraps the page in `Page`, except at the space root.
- `settings/+layout.svelte` is a `SecondaryNav` of `SecondaryNavItem` links. A new settings page
  needs an entry there.
- `chat/+layout.svelte` is the conversation list, plus a FAB to start a conversation.

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

### Paths, titles, deep links

`src/app/navigation/` owns routing:

- `pages.ts`: the routes, `makeContentPath(url, kind, idOrAddress)` (a kind's list or item page),
  and `getPageTitle`, which the root layout puts in the tab. Every page id must be in
  `pageRoutes`, so a page added without a route and title fails the type check.
- `locations.ts`: where an event lives. `getEventPath(event, urls)` covers DMs, room messages
  (`?at=`) and comments (through their root), and returns `undefined` for an event with no page.
  `goToEvent(event)` scrolls to the event if it is rendered with a `data-event` attribute,
  navigates otherwise, and opens anything without a page as a note. `makeEventPermalink` is the
  shareable form.
- `history.ts`: `setupHistory` records the last page visited in each space and in messages.
  `goToSpace(url)` goes to that page, else the space's about page, and `goToHome` goes home, or
  to the first platform space.
- `overlays.ts`: the note overlay (below).

`goToMessages(pubkeys)` lives in `src/app/features/messages.ts`, since it first asks for messaging
relays with `MessagesEnable`.

Deep links arrive in `handleDeepLink` in `src/app/features/deepLinks.ts`: push-notification links
(`?relay=&id=`), the iOS share extension (the `share` host), signer returns (`x-callback-url`), and
otherwise a plain path. Nostr entities go through `/[bech32]`, which sends profiles to their
page, and loads events before calling `goToEvent`.

### Adding a space content page

1. `src/routes/spaces/[relay]/<name>/+page.svelte`, plus `[id]` or `[address]` for detail.
2. Its routes in `src/app/navigation/pages.ts`, with titles, entries in `pageRoutes`, and a case
   in `makeContentPath`, so notifications and permalinks land there.
3. A `SecondaryNavItem` in `SpaceMenuNavItems.svelte`. Content entries appear only once the space
   holds that kind, which comes from `CONTENT_KINDS` in `src/app/features/spaces/content.ts`.

The registries outside the view layer, including the link-preview server, are in
flotilla-architecture and flotilla-model.

## Navigation, modals, popovers, toasts

### navigate, not goto

`navigate(path, {replaceState, keepModal})` in `src/app/navigation/navigate.ts` wraps `goto`. With a
dialog open it gives the dialog's history entry back first, so Back doesn't reopen it, and `keepModal` changes the
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

There are two kinds of overlay. A dialog (`src/app/navigation/dialogs.ts`) is transient: its id
lives in SvelteKit page state (`App.PageState.modals` in `src/app.d.ts`) and its component in a
record in memory, so a reload drops it. A note is a place: `openNote(pointer)` and
`openEventNote(event)` in `src/app/navigation/overlays.ts` put it in the url as `?note=`, so it
survives a reload and can be shared. `ModalContainer` mounts the note beneath any dialogs, each
inside `Dialog` or `Drawer`.

A dialog pushed on its own takes a history entry, so Back closes it, and `popModal` closes it by
going back over that entry. One swapped in with `replaceState` takes over the entry of the dialog
it replaces, and one swapped onto the page's own entry has none, so closing it only edits page
state. History moves land asynchronously, so `pushModal`, `popModal`, `openNote` and `navigate`
queue behind each other (`traverse`): `popModal()` then `goToEvent(event)` goes back once, then
navigates. A push without `nested` replaces the whole stack. `replaceState` suits mobile menus
that open a follow-up (`RoomItemMenuMobile`) and multi-step flows. `noEscape` removes the close
button and ignores Escape and the backdrop; the space gates use it.

A note takes an entry the same way, so Back goes back to the note it was opened from rather than
out of the overlay. One reached by a link or a reload has no entry of its own (`ownsNote`), and
`closeNote` strips `?note=` from the url instead of going back over it.

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
`ProfileDetail` pops before `goToMessages`, and `SearchBody` pops before `goToEvent`.

For yes/no questions, push `Confirm` from lib with `{title, message, confirm}`; it runs `confirm`
behind its own loading state. Reusable confirmations get a `*Confirm` wrapper
(`EventDeleteConfirm`).

### Popover menus

`MenuButton` renders a `Tippy` popover around the component you pass, adding an `onClick` prop
that hides it. It shows the menu-dots icon unless given children, opens `bottom-end` unless given a
`placement`, and takes `strayMargin` to hide once the pointer strays that many pixels from the
popover, as the hover actions on a chat row do:

```svelte
<MenuButton component={MessagesMenu} aria-label="Chat options" />
```

`EventMenu` puts `onClick` on its `<ul>` as `onclickcapture`, so any item closes the popover, and
each item usually pushes a modal. It has to be the capture phase: `Button` stops propagation, and
Svelte's delegated `onclick` on the `<ul>` would never see the click. On mobile, rows push a
`*MenuMobile` modal instead: `RoomItem` pushes `RoomItemMenuMobile` on tap.

`Tooltip` is `Tippy` with a string `content` and the `tooltip` theme, whose CSS lives in
`tooltip.css`. `Tippy` appends popovers to the page's `.tippy-target`, or to the open dialog's
`.dialog-tippy-target` so they stack above it.

### Toasts

`pushToast` in `src/app/features/toast.ts` shows one toast at a time:

```typescript
pushToast({message: "Role created!"})
pushToast({theme: "error", message, action: {message: "Details", onclick}})
pushToast({timeout: 30_000, children: {component: PublicationToast, props: {publication}}})
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
- controls: `Button`, `Link`, `Field`, `FieldInline`, `InputList`, `ToggleInput`,
  `DateTimeInput`, `ImagesInput`, `EmojiPicker`, `MenuButton`, `SegmentedButtons`
- display and lists: `Icon`, `ImageIcon`, `Divider`, `Spinner`, `LoadingFallback`, `Tooltip`,
  `Tippy`, `Cv`, `VirtualList`, `Masonry`, `DragList`, `ScrollToTop`
- the CSS component families (`button.css`, `card.css`, `badge.css`, `input.css`, …) and the
  theme tokens. Cards, badges and inputs are plain markup with these classes
  (`<div class="card card-sm">`, `<span class="badge badge-primary">`,
  `<div class="input input-group"><input /></div>`) rather than components.

Anything that takes an identifier and reads a store, publishes, or knows a kind is an app
component. A lib component that needs app behavior takes it as a prop, such as `MenuButton`'s
`component`. `Link` imports `@app` anyway; flotilla-architecture lists it under its layer
exceptions.

`src/app/components` is flat, and `hosting/` is the only subdirectory it has ever had, brought in
whole by the caravel port (cf938c63) with names that would blur into the flat `Relay*` family.
New components go in the flat folder.

## Naming

Names are `<Entity><Qualifier>`: the prefix says what it's about, the suffix what it does, which
keeps families adjacent in a flat listing. `ClassifiedCreate`, `ClassifiedEdit`, `ClassifiedForm`, `ClassifiedItem`, `ClassifiedStatus`.

Name a modal for what it does (`SpaceJoin`, `ClassifiedCreate`, `EventDeleteConfirm`); only a
handful carry a `Modal` or `Dialog` suffix. The suffix vocabulary, the prefix families, and the
names that break the pattern are in [naming.md](naming.md).

## Props

### Identifiers first, the event when you have it

`url` is a prop in 159 components, `h` in 32 and `pubkey` in 28. Relays, rooms and profiles have
stores, so a component takes the key and looks up the rest: `RoomName` takes `{url, h}` and reads
`$rooms.forRoom(url, h)`, `ProfileName` takes `pubkey` and reads `$profiles.display`.

Events are the exception, and 66 components take `event: TrustedEvent`, since the parent already
holds the event from a feed or `$events.one`. An event prop usually travels with `url`, the
relay it lives on, which routes its replies and reactions, and with `context: FeedContext`, the
shared loader below. A component takes a pointer instead only when it has to load the event
itself, as `ContentQuote` does. Anything with neither a store nor an event is passed as its
domain reader: `RoleEdit` takes `role: RelayRoleReader`.

Identifier props are read once, `const room = $rooms.forRoom(url, h)`, since pages remount on a
param change and lists key by id. A prop that does change while mounted needs `$derived`:
`ContentActions` reads its event that way, because editing a listing hands it a new version.

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
- Props are declared as `type Props`, never an `interface` or an inline object type.

## Reading state in a component

Components read plugins through the `usePlugin` stores exported from `src/app/core/plugins.ts`
(`$profiles`, `$relays`, `$rooms`, `$roomLists`, `$events`, `$network`, `$publisher`, `$deletes`,
`$relayManagement`, …). `$app.use(X)` covers plugins with no export, such as `Zappers`,
`Pinboards` and `Feeds`; flotilla-state has the rules about which to use where.

How you bind depends on what the method returns:

```svelte
<script lang="ts">
  const room = $rooms.forRoom(url, h)                                 // Readable: one, forRoom
  const display = $profiles.display(pubkey, removeUndefined([url])).$ // Projection: take .$
  const replies = $events.asc(filters).$                              // raw repository queries
  const relay = $relays.one(url)                                      // Readable: one, then $relay?.hasNip(n)
</script>

{$room?.meta?.name() || h} · {$display}
```

In a handler, call `.get()` on a projection instead of subscribing. The app modules add `derive*`
factories over the same data: `deriveSpaceActionItems` in `src/app/features/spaces/actionItems.ts`,
`deriveSpaceSupportedMethods` in `src/app/features/spaces/management.ts`, `deriveRelayAccess` in
`src/app/core/relays.ts`. Call them at the top of the script with fixed arguments, and wrap one in
`$derived` only when its arguments change, as the thread page does for filters that wait on the
root event.

Read an event's tags through a domain reader, `$derived(reader(Classified)(event))`, with
`reader` from `@app/core/domain`. `$user` throws signed out, so use it only under the login gate.

## Loading from the network

A page or component loads what it displays; a layout loads what it gates on. Background sync for
data every page needs lives in `src/app/core/sync.ts`.

**One entity, or a handful of lists:** call plugin `load` in `onMount`, and toast on failure, as
`people/[npub]/+page.svelte` does for the profile, relay list, follow, pin, room and messaging
lists before requesting the author's outbox with `$network.request`.

**A detail page:** `$events.one(address, [url]).$` loads when nothing local matches. While it is
empty, seven pages show `LoadingFallback`, a spinner that turns into a failure message after
five seconds:

```svelte
<LoadingFallback
  loadingMessage="Loading listing..."
  failureMessage="Failed to load classified listing." />
```

**Related events:** request them, abort on teardown, and read them back from the repository with
`$events.asc(filters).$`.

```typescript
onMount(() => {
  const controller = new AbortController()

  $network.request({relays, filters, signal: controller.signal})

  return () => controller.abort()
})
```

That is `EventComments`. The thread detail page does the same in an `$effect`.

**A list that pages as you scroll:** `makeFeed`, `makeScrollLoader` and `makeFeedContext` from
`src/app/features/feeds.ts`. Every space list page uses them, as do `HomeNetworkRecent` and `RoomChat`.
The threads and classifieds pages are the reference:

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
every event the feed yields, rows get the same `context`, and their action rows read
`context.related(event)` and `context.deleted(event)`. Close the list with `<Spinner {loading}>`
and an `{#if}` chain over loading, empty and exhausted. Calendars use
`makeCalendarFeed`, which pages by date tag rather than `created_at`.

`makeNetworkFeed` in `src/app/features/social/networkFeed.ts` builds on those helpers to draw each reply under
the note it answers. The home Network section and `ProfilePageNotes` both use it. A muted author's
events are left out of it, so `ProfilePageNotes` says the person is muted where it would otherwise
report that they have no notes.

`ProfileFeed` still drives welshman's `FeedController` through
`$app.use(Feeds).makeFeedController` and `createScroller`, but 27fa25c3 moved the home feed onto
the app helpers, which is the direction for new lists. Only `RoomChat` virtualizes; other long
lists wrap each row's root in `Cv`, which applies `content-visibility` and paints two viewports
ahead. All ten `*Item` components that appear in a list use it. A virtualized list takes its
`threshold` from the loader paging it, since a list that stops growing short of the loader's
runway leaves the loader fetching history the list never draws.

## Mutations from a component

flotilla-state covers the writer → command → publication path. The component around it owns a
`loading` flag, awaits the first error, toasts it, and closes. Anything thrown on the way (a signer
refusing, a relay unreachable) is logged and toasted in a `catch`, so a bare `try`/`finally` never
lets it escape the handler:

```typescript
const submit = async () => {
  loading = true

  try {
    const publication = await command(eventWriter).then(publish)
    const error = await publication.getError()

    if (error) {
      return pushToast({theme: "error", message: error})
    }

    history.back()
  } catch (e) {
    console.error(e)
    pushToast({theme: "error", message: "Failed to save your changes."})
  } finally {
    loading = false
  }
}
```

Bind the flag to the button with `disabled={loading}` and `<Spinner {loading}>`. Plugin mutators
return a `Command` as well: `$deletes.deleteEvent(event, w => w.setProtected(protect))` then
`.publishToRelays([url])` in `EventDeleteConfirm`, or `$rooms.createRoom(url, room)` then
`.publish()` in `RoomForm`. NIP-86 calls resolve to `{error}` instead of a publication:
`$relayManagement.forUrl(url).createRole(...)` in `RoleCreate`.

The hosting backend isn't nostr. Toast `hostingErrorMessage(e, fallback)` from `hosting.ts`,
which returns a `HostingError`'s own message and logs anything else before falling back. Publishes are
optimistic, so rows show progress in place: `ContentActions`, `CommentActions` and `ArticleActionBar`
wrap their contents in `PublicationStatusOrDeleted`, and chat pushes a `PublicationToast`.

## Forms

`Field` puts a label above its control, with optional `secondary` and `info` snippets.
`FieldInline` puts the label left and the control right, as settings and detail rows do. Controls
are plain elements styled by class (`<label class="input …">`, `<select class="select input">`),
or bindable inputs from lib (`ImagesInput`) and app (`IconInput`, `TopicMultiSelect`).

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
  restates the shape; export it instead, as `ArticleForm` does. `ArticleForm` is the same shape
  on a full page: it renders the `SpaceBar` with its Publish button, takes the title as `header`,
  and lands on the published article.

Rich text uses `makeEditor` from `src/app/features/editor` with `EditorContent`.

## Styling

- Classes come from the component families in `src/lib/components/*.css`, which `theme.css`
  imports, and the app-concept families in `src/app/components/*.css`, which `src/app.css`
  imports after `theme.css`. A class goes in `@layer components` either way. The lib families
  include `button` with `button-primary|neutral|link|ghost|error` and `button-sm|xs|circle|square`,
  `card`, `badge`, `input`, `select`, `textarea` and `menu`. These are flotilla's own; daisyUI is
  not installed.
- Colors are the semantic tokens registered in `base.css`: `bg-surface`, `bg-surface-more`,
  `text-content`, `text-content-muted`, `border-line`, `text-primary`, `text-error`. The clay,
  flat, navy and nature themes supply the values through `data-fl-theme`.
- Classes are built with `cx`; no `class:` directives remain.
- Container queries go on the `PageContent`, as in `@2xl:grid-cols-2` for the classifieds grid.
  Beside the navs a page is about 326px narrower than the screen, so a screen `lg:` layout switch
  becomes `@2xl:` inside a page, as on the home, about, goals, article and settings pages.
- Icons are `import X from "@assets/icons/<name>.svg?dataurl"` with `<Icon icon={X} size={4} />`,
  where `size` counts 4px steps. List entries animate with `in:fly` from `@lib/transition`.

## Related skills

- `flotilla-architecture`: layer rules and exceptions, the `src/app` modules, boot, placement
- `flotilla-state`: plugin stores, `derive*` stores, drafts, settings, publications and commands
- `flotilla-model`: spaces, rooms, NIP-43/29/86, content kinds, and where events are published
- `welshman-app`: plugins, projections, `Command`, `Publisher`, `Events`, `Feeds`
- `welshman-store`: `deriveEventsById`, `deriveEventsAsc`, the repository stores under `Events`
- `welshman-domain`: the readers and writers behind `reader` and `writer`
- `welshman-feeds`: `FeedController`, still used by `ProfileFeed`
- `welshman-editor`: the composer behind `makeEditor`
