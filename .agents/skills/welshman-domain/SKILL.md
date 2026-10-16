---
name: welshman-domain
description: "Use this skill when working with @welshman/domain: reading, building, querying, and routing typed nostr events by kind — the Reader/Writer/Query trio (EventReader/EventWriter/EventQuery, ListReader/ListWriter) bound to dependencies through KindFactory.configure → ConfiguredKind, that sits between @welshman/util's raw event types and @welshman/app's data plugins. Covers Profile, NIP-51 lists (follows, mutes, pins, relays, bookmarks, topics, emoji, feeds, blossom), NIP-29 rooms, Flotilla relay/space membership, NIP-89 handlers, NIP-57/75 zaps, notes/deletes/reactions/reposts, NIP-54 wiki, and content kinds (comment, thread, article, classified, poll, calendar, report, label). Use it to parse an event into domain getters, build/edit an event template, build the filters and relays that fetch a kind's events, resolve publish relays via the RelaySelection routing DSL (routes/forceRoutes/requiresRelays/scenario), or handle NIP-44 private-list encryption."
---

# welshman/domain — Typed Readers, Writers & Routing for Nostr Kinds

## Overview

`@welshman/domain` translates nostr events to and from typed domain objects, and works out where to publish and fetch them. For each event kind it ships a matched trio:

- a **Reader** — a read-only view over a `TrustedEvent` with synchronous getters (`profile.name()`, `followList.pubkeys()`),
- a **Writer** — a mutable, chainable producer of an `EventTemplate` plus the relays to publish it to (`writer.renderTemplate()` / `writer.render()`), and
- a **Query** — a mutable, chainable producer of the `Filter`s that fetch the kind's events and the relays to request them from (`query.renderFilters()` / `query.render()`).

A kind is packaged as a **`KindFactory`**; you bind it to app dependencies once with `factory.configure(context)`, which returns a **`ConfiguredKind`** that mints readers, writers, and queries. Routing runs through the `@welshman/util` `RelaySelection` DSL and a `Resolver` supplied in the context.

It sits one layer above `@welshman/util` (raw `TrustedEvent`/`EventTemplate` types, tag getters, kind constants, the routing DSL) and one layer below `@welshman/app` (whose `Domain` plugin supplies the context and whose data plugins use these readers as their `eventToItem`). The package holds no stores or globals; dependencies arrive through the `KindContext`.

## Installation

```bash
npm install @welshman/domain
# or
pnpm add @welshman/domain
```

Peer deps: `@welshman/lib`, `@welshman/util`, `@welshman/signer`, `@welshman/net`, `@welshman/feeds`, and `nostr-tools`.

## Core mental model

1. **A kind is a `KindFactory`; bind it once with `configure`.** Each exported kind constant is `new KindFactory({kind, reader, writer, query})` — e.g. `export const Note = new KindFactory({kind: NOTE, reader: NoteReader, writer: NoteWriter, query: NoteQuery})`. Call `Note.configure(context)` to get a `ConfiguredKind` carrying the app's `resolver` and an optional `signer`, which is all `KindContext` holds. In an app, `@welshman/app`'s `Domain` plugin calls `configure` and memoizes the result.
2. **Readers wrap an event; Writers produce a template + relays; Queries produce filters + relays.** `configured.reader(event)` builds a Reader (unparsed) and `.parse()` populates it; `configured.writer(reader?)` builds a Writer, optionally seeded from a Reader (the edit flow); `configured.query()` builds a Query.
3. **Reading is sync unless the kind decrypts; getters are always sync.** You enter through `configured.reader(event).parse()`, which validates `event.kind` (throwing `Expected a kind X event, got kind Y`) and parses. `parse()` returns the reader for kinds that extend `EventReader` and a promise of it for kinds that extend `AsyncEventReader` — only the six private-tag lists and `AppData`, which have to decrypt. `await` works for both, and `Parsed<R>` is the type of whichever one a reader yields.
4. **Building is chainable; output is async.** Setters return `this`; you finish with `await w.renderTemplate()` (an `EventTemplate`), `await w.relays()` (publish urls), or `await w.render()` (both). None of these take arguments — the signer and resolver come from the context bound at `configure`.
5. **The signer is optional and lazy.** Most kinds ignore it. NIP-51 lists use it to *decrypt* private tags on read and *encrypt* them (NIP-44, self-encrypted) on build, and `ZapRequestWriter.requestInvoice` signs with it. The app supplies it as a lazy getter so auth policies can swap it after `configure`.
6. **Round-trips preserve unknown tags.** Seed a Writer from a Reader and any tags the class doesn't model are carried through verbatim into the rebuilt template.

## Reading an event

Go through a `ConfiguredKind`. `configured.reader` validates `event.kind === reader.kind` and builds the reader; chain `parse()` to populate it.

```typescript
import {Profile, FollowList} from "@welshman/domain"

// Bind dependencies once (the app's Domain plugin does this for you):
const profiles = Profile.configure(context)          // context: KindContext
const follows  = FollowList.configure(context)        // context.signer decrypts private tags

// kind 0 parses without IO, so there is nothing to await:
const profile = profiles.reader(event).parse()        // validates + parse()

// follow lists are public, but a mute list would decrypt — and then `parse()`
// returns a promise the type makes you await:
const list  = follows.reader(event).parse()
const mutes = await MuteList.configure(context).reader(event).parse()
```

`ConfiguredKind.reader` / `.writer` / `.query` are instance arrow-function properties, so you can destructure them (`const {reader} = Profile.configure(ctx)`).

Common base getters available on every reader (all synchronous): `id()`, `author()`, `content()`, `tags()`, `createdAt()`, `identifier()` (d-tag), `address()` (`kind:pubkey:d`), `room()` (NIP-29 h-tag), `protect()` (has `["-"]`), `expiration()`, `contentWarning()` (has a NIP-36 `content-warning` tag), `contentWarningReason()`, `client()` (the NIP-89 `client` tag as `{name, address?, relay?}`), `emojis()`, `imeta()`, `quotes()`, `zapSplits()`. Each kind adds its own — e.g. `profile.name()`, `profile.display()`, `followList.pubkeys()`, `followList.includes(pk)`.

The getters for tags any kind can carry delegate to standalone functions in `src/behaviors/` — `isProtected`, `getExpiration`, `getContentWarning`, `getClient`, `getEmojis`, `getImeta`, `getQuotes`, `getZapSplits` (plus `splitZapAmount`). Use those on a bare event: `reader()` throws on a kind mismatch, so a cross-kind check can't go through a reader.

## Building / editing an event

```typescript
import {Profile, FollowList} from "@welshman/domain"

// Build from scratch:
const {writer} = Profile.configure(context)
const template = await writer()
  .setName("alice")
  .setAbout("hi")
  .renderTemplate()                           // EventTemplate {kind, content, tags}

// Edit an existing event (seed the writer from a reader):
const reader = FollowList.configure(context).reader(event).parse()
const w = FollowList.configure(context).writer(reader)   // seeded from reader
  .follow(pubkey)
const {event: template2, relays} = await w.render()    // template + publish urls
```

- Construct empty (`configured.writer()`) or from a reader (`configured.writer(reader)`) for the edit flow.
- Base behavior setters (chainable): `setContent`, `setRoom(url, room)`/`clearRoom` (h-tag + forced routes), `forceRoutes(...routes)`/`clearForcedRoutes`, `setProtected(bool)`, `setExpiration`/`clearExpiration`, `setContentWarning(reason?)`/`clearContentWarning`, `setClient(name, address?)`/`clearClient`, `setIdentifier`/`clearIdentifier` (d-tag, defaults to a random id), `addTags`, `keepTags(pred)`, `dropTags(pred)`. Shared tag helpers, the first three with relay hints: `addMention(pubkey)`, `addQuote(event)`/`removeQuote`, `addZapSplit(pubkey, split?)`/`removeZapSplit`, `addEmoji`/`removeEmoji`, `addImeta`/`removeImeta`. Each kind adds its own setters.
- Output methods (all async, no arguments):
  - `renderTemplate()` → `EventTemplate` — runs `validate()`, then renders tags and content. A tag that carries a relay hint fills its hint slot through the protected `hint(...routes)` helper, which resolves routes to a single url; `renderTags()` awaits every in-flight hint before returning. List content is encrypted here.
  - `scenario()` → `RelayScenario` (chainable: `.limit()`, `.policy()`, `.allowLocal()`, …), limited to 30 relays rather than the three a read resolves; `relays()` → `string[]` (the resolved publish urls).
  - `render()` → `{event: EventTemplate; relays: string[]}` — `renderTemplate()` and `relays()` together.

The caller signs the template. In an app you hand the writer to `Domain.command(writer)`, which calls `render()` and wraps it in a `Command`. Directly, you sign the `renderTemplate()` output:

```typescript
import {stamp} from "@welshman/util"
const signed = await signer.sign(stamp(await writer.renderTemplate()))   // SignedEvent
```

**Round-trip / extra-tag passthrough.** When a writer is seeded from a reader, every tag in `event.tags` starts in `extraTags`. The base constructor lifts out `h`/`-`/`expiration`/`content-warning`/`client`/`d` (into `roomTag`/`protectTag`/`expirationTag`/`contentWarningTag`/`clientTag`/`identifierTag`); each subclass lifts the tags it models. Whatever is left is re-emitted unchanged, so unmodeled tags survive an edit. Tag assembly is `[...renderBehaviorTags(), ...renderDomainTags(), ...extraTags]`.

## Querying a kind's events

```typescript
import {Note, Comment} from "@welshman/domain"

// Filters + the relays to request them from:
const {filters, relays} = await Note.configure(context)
  .query()
  .setAuthors([pubkey])
  .setSince(since)
  .setLimit(50)
  .render()

// Kind-specific queries add methods for the relationships the kind models:
const thread = await Comment.configure(context).query().forRoot(event).render()
```

- Every filter field has a set/add/remove/clear group (`setIds`/`addIds`/`removeIds`/`clearIds`, same for `Authors`), or set/clear for the scalars (`setSince`, `setUntil`, `setLimit`, `setSearch`). Tag filters go through `setTag(key, values)`/`addTag`/`removeTag`/`clearTag`/`clearTags`, with or without the `#` prefix. The kind itself is fixed by the factory.
- A field left alone is unconstrained; one set to an explicitly empty array matches nothing. Adding no values is a no-op.
- **`renderRoutes()` is abstract, so every kind states where its events live.** Two protected helpers cover the common shapes: `authorRoutes()` (the queried authors' outboxes) and `mentionRoutes()` (inboxes of the pubkeys a `#p` filter names). Content kinds use both; author-scoped kinds (lists, app data) use `authorRoutes()` alone; indexed kinds (`Profile`, `FollowList`, `RelayList`, `MessagingRelayList`) add `indexers()`; the `requiresRelays` room, relay-management and chat kinds return `[]`; `DirectMessage` returns `[userMessaging()]`.
- A query with nothing to route on resolves to **no relays**; there is no fallback to the user's own. `setRoutes(routes)` replaces the rendered routes (`[relay(url)]`, `[userInbox()]`, …), `addRoutes(routes)` requests those alongside them, and `setRoom(url, room)` scopes a NIP-29 query to one relay's room.
- Output methods mirror the writer's: `renderFilters()` → `Filter[]`, `relays()`/`scenario()` → the request relays, `render()` → both.
- Past `renderRoutes`, most query subclasses are empty. A kind that models a relationship overrides `renderDomainFilters()`, merged onto the base filter, one filter per variant. `CommentQuery.forRoot(event)`/`forParent(event)` emit a filter each for the `E`/`e` id and `A`/`a` address reference forms, since a relay ANDs a filter's fields, and route to each target author's inbox, where comments p-tagged to that author are delivered.

## Routing: routes / forceRoutes / requiresRelays

Publishing targets come from the `@welshman/util` `RelaySelection` DSL (`outbox`, `inbox`, `inboxes`, `userOutbox`, `seen`, `relay`, `relays`, `indexers`, …). A writer resolves them through `context.resolver`.

- **Default routing** (`EventWriter.renderRoutes`): `[userOutbox(), ...inboxes(pTaggedPubkeys, 0.5)]` — deliver to the author's write relays (weight 1) and to every p-tagged pubkey's read relays (weight 0.5). Most kinds use this (`NoteWriter`, …).
- **`forceRoutes(...routes)`** sets `forcedRoutes`; when non-empty, `scenario()` publishes **only** there, bypassing `renderRoutes()`. It takes routes rather than urls, so `forceRoutes(userInbox())` pins an event to the user's read relays without resolving them first. `setRoom(url, room)` sets `forcedRoutes=[relay(url)]` **and** the `h` tag (NIP-29 room events); `clearForcedRoutes()`/`clearRoom()` undo it.
- **`requiresRelays`** (a readonly `true` on a subclass) makes `validate()` demand `forcedRoutes`, throwing `A kind N event must publish to explicit relays (via setRoom or forceRoutes)`. The kinds that set it are the NIP-29 room ops and state, the relay-management ops and state, and NIP-C7 chat: `RoomCreate`, `RoomEdit`, `RoomDelete`, `RoomDeleteEvent`, `RoomCreateInvite`, `RoomJoin`, `RoomLeave`, `RoomAddMember`, `RoomRemoveMember`, `RoomMembers`, `RoomAdmins`, `RoomMeta`, `RoomPins`, `RoomUpdatePins`, `RoomCreatePermission`, `RelayJoin`, `RelayLeave`, `RelayInvite`, `RelayAddMember`, `RelayRemoveMember`, `RelayRole`, `RelayMembers`, `Message`. `RoomCreate`, `RoomDelete`, `RoomDeleteEvent`, `RoomCreateInvite`, `RoomEdit`, `RoomJoin`, `RoomLeave` and `RoomUpdatePins` also require a `roomTag`, so call `setRoom`.
- **Per-kind overrides.** Some writers replace `renderRoutes()`: `FollowListWriter`/`MuteListWriter`/`ReportWriter`/`LabelWriter` publish to `[userOutbox()]` only (p-tags are data, not recipients); `RelayListWriter` publishes to `indexers()` plus every relay the list references before or after the edit; `DeleteWriter` adds each deleted event's `seen` relays (and requires an `e`/`a` tag).

The DSL constructors `relays(urls)` and `inboxes(pubkeys)` return **arrays** (spread with `...`); the others return a single `RelaySelection`.

## Async & signer notes

- **Async surface:** all of `renderTemplate`/`render`/`scenario`/`relays`/`renderTags` are async. `reader(event).parse()` is async only for the kinds that decrypt (`ListReader` subclasses, `AppData`); every getter and every setter is synchronous.
- **Reading private list tags:** a `ListReader` only surfaces `privateTags` when the context carries the **author's own** signer (it decrypts NIP-44 content only when `signer.getPubkey() === event.pubkey`). Decryption failures are swallowed — `decrypted` stays `false` and private tags stay empty.
- **Writing private list tags:** `ListWriter.renderContent` is where encryption happens. If there are private tags it requires a signer and NIP-44-encrypts them to the author's own pubkey (`A signer is required to encrypt private tags`). If the source was never decrypted, the original ciphertext is preserved untouched (so you don't clobber tags you couldn't see).
- **`renderTemplate()`** needs a signer only for list kinds with non-empty private tags. Signing (`signer.sign(stamp(...))`) always needs one.
- **`d`-tag required** (base `validate` throws otherwise) for every parameterized-replaceable kind (30000–39999), such as `RelaySet`, `BookmarkSet`, `BadgeDefinition`, `Pinboard`, `Classified`, `Article`, `Wiki`, `WikiRedirect`, `AppData`, `Feed`, `DateEvent`, `TimeEvent`, `CalendarRsvp`, `Handler`, `HandlerRecommendation`, `RelayRole`, `RoomMeta`, `RoomAdmins`, `RoomMembers`, `RoomPins` and `Pin`. Call `setIdentifier()`; `ProfileBadges` sets its own. Each `Pin` needs a unique `d` tag, or pins from the same author collide at one address, and it also requires a content reference (`e`/`a`/`i` tag).

## Kind classes

### Profile

| Kind | NIP | Reader / Writer |
|---|---|---|
| 0 | NIP-01 | `ProfileReader` / `ProfileWriter` (factory `Profile`) |

`ProfileReader`: `name`, `nip05`, `lnurl`, `about`, `banner`, `picture`, `website`, `display()`. Writer: `update`, `setName`, `setNip05`, `setAbout`, `setBanner`, `setPicture`, `setWebsite`. (Also exports `parseLnUrl`, `displayPubkey`.)

### Core notes / deletes / reactions

| Kind | NIP | Reader / Writer |
|---|---|---|
| 1 | NIP-01 / NIP-10 | `NoteReader` / `NoteWriter` (factory `Note`) |
| 9 | NIP-C7 | `MessageReader` / `MessageWriter` (factory `Message`) |
| 5 | NIP-09 | `DeleteReader` / `DeleteWriter` (factory `Delete`) |
| 6 | NIP-18 | `RepostReader` / `RepostWriter` (factory `Repost`) |
| 7 | NIP-25 | `ReactionReader` / `ReactionWriter` (factory `Reaction`) |
| 16 | NIP-18 | `RepostReader` / `RepostWriter` (factory `GenericRepost`) |
| 14 | NIP-17 | `DirectMessageReader` / `DirectMessageWriter` (factory `DirectMessage`) |
| 9802 | NIP-84 | `HighlightReader` / `HighlightWriter` (factory `Highlight`) |

`DirectMessageReader`: `recipients()`, `subject()`, `parentId()`; writer `addRecipient`/`removeRecipient`/`setSubject`/`setParent`. The **writer** renders **no** routes (`[]`) — a NIP-17 message is published as one gift wrap per recipient, each to its own relays, so the caller fans it out (`app.use(Wraps).publish`). The **query** routes to `[userMessaging()]`.

`MessageReader`: `parent()` (the `Quote` the content opens with); writer `setParent(event)`/`clearParent()`; query `forParent(event)`. Chat lives on its hosting relay, so the writer sets `requiresRelays` and the query routes to `[]`; pin both with `setRoom`.

`HighlightReader`: `sources()`, `attributions()`, `mentions()`, `sourceContext()`, `comment()`, `references()`, `topics()`; writer `setSourceEvent`/`setSourceExternal`/`setSourceReference`, `addAttribution`/`removeAttribution`, `addMention`, `setSourceContext`/`clearSourceContext`, `setComment`/`clearComment`, `setTopics`.

`NoteReader`: `root()`/`parent()`, each an `EventRef` or `undefined`, from the NIP-10 marked `e`/`a` tags or unmarked `e` tags by position; a direct reply's parent is its root. `NoteWriter.setParent(event)` does NIP-10 reply threading (p-tags the parent's participants and the root's author, e/a-tags the parent and thread root with markers + relay hints). `DeleteReader`: `ids()`, `addresses()`, `kinds()`, `reason()`; `DeleteWriter`: `addEvent(event, roomUrl?)`, `setReason(reason)` (routes to the deleted events' `seen` relays; requires an `e`/`a` tag).

`ReactionReader`: `eventId()`, `eventAddress()`, `pubkey()`, `eventKind()`; writer `setEvent(event)` (replaces the target: `k`, `p`, hinted `e`, plus `a` for a replaceable event; requires an `e` tag), with the reaction itself in `setContent`. `Repost` (kind 6, notes) and `GenericRepost` (kind 16, any other kind) share `RepostReader`: `eventId()`, `eventAddress()`, `pubkey()`, `eventKind()` (`1` for kind 6, the `k` tag for kind 16), `repostedEvent()` (the event JSON-decoded from content, or `undefined` unless it has an event's shape and the `e` tag's id; its signature is unchecked); writer `setEvent(event)` JSON-encodes the event into content and tags it like a reaction, adding `k` only for kind 16. `validate()` requires an `e` tag and accepts empty content; non-empty content must be the `e`-tagged event with a valid id and signature, matching any `k` tag, and on `Repost` must be a kind-1 note — use `GenericRepost` for other kinds.

### Lists (ListReader/ListWriter — public/private split, NIP-44 encryption)

| Kind | NIP | Reader / Writer |
|---|---|---|
| 3 | NIP-02 | `FollowListReader` / `FollowListWriter` |
| 10000 | NIP-51 | `MuteListReader` / `MuteListWriter` |
| 10001 | NIP-51 | `PinListReader` / `PinListWriter` |
| 10002 | NIP-65 | `RelayListReader` / `RelayListWriter` |
| 10003 | NIP-51 | `BookmarkListReader` / `BookmarkListWriter` |
| 10004 | NIP-51 | `CommunityListReader` / `CommunityListWriter` |
| 10006 | NIP-51 | `BlockedRelayListReader` / `BlockedRelayListWriter` |
| 10007 | NIP-51 | `SearchRelayListReader` / `SearchRelayListWriter` |
| 10009 | NIP-51 | `RoomListReader` / `RoomListWriter` |
| 10014 | NIP-51 | `FeedListReader` / `FeedListWriter` |
| 10015 | NIP-51 | `TopicListReader` / `TopicListWriter` |
| 10030 | NIP-51 | `EmojiListReader` / `EmojiListWriter` |
| 10050 | NIP-17 | `MessagingRelayListReader` / `MessagingRelayListWriter` |
| 10063 | Blossom BUD-03 | `BlossomServerListReader` / `BlossomServerListWriter` |
| 30002 | NIP-51 | `RelaySetReader` / `RelaySetWriter` |
| 30003 | NIP-51 | `BookmarkSetReader` / `BookmarkSetWriter` |

`ListWriter` mutators (public/private split): `addPublic`/`addPrivate`, `keepPublic`/`keepPrivate`/`keepTags`, `dropPublic`/`dropPrivate`/`dropTags`. Each kind also exposes intent-named helpers, e.g. `FollowListWriter.follow(pubkey, relayHint?, petname?)`/`unfollow` (`follow` replaces any existing `p` tag for that pubkey, and pads NIP-02's relay slot with an empty string when a petname arrives without a hint; its reader has `pubkeys()`, `includes(pk)`, `petnames()`, `petname(pk)`), `MuteListWriter.mutePublicly`/`mutePrivately`/`unmute` (its reader has `pubkeys()`, `words()`, `topics()`, `ids()`, `addresses()` over public and decrypted private tags), `RelayListWriter.addReadUrl`/`addWriteUrl`/`removeReadUrl`/`removeWriteUrl`/`setReadUrls`/`setWriteUrls`/`setTags`, `RoomListWriter.addRoom`/`removeRoom`/`addRelay`/`removeRelay`/`setRelays`/`migrateRelay` (`removeRoom`, `removeRelay` and `migrateRelay` also match legacy `["h", roomId, url]` entries, which the writer keeps in the `h` form). (Note `FollowList` is a plain `EventWriter`, not a `ListWriter` — follows are public.)

### Rooms (NIP-29)

Room ops are scoped by the `h` tag and must publish to explicit relays — use `setRoom(url, room)`. Metadata kinds 39000–39002 and 39005 are addressable per room.

| Kind | NIP | Reader / Writer |
|---|---|---|
| 9000 | NIP-29 | `RoomAddMemberReader` / `RoomAddMemberWriter` |
| 9001 | NIP-29 | `RoomRemoveMemberReader` / `RoomRemoveMemberWriter` |
| 9002 | NIP-29 | `RoomEditReader` / `RoomEditWriter` |
| 9007 | NIP-29 | `RoomCreateReader` / `RoomCreateWriter` |
| 9005 | NIP-29 | `RoomDeleteEventReader` / `RoomDeleteEventWriter` |
| 9008 | NIP-29 | `RoomDeleteReader` / `RoomDeleteWriter` |
| 9009 | NIP-29 | `RoomCreateInviteReader` / `RoomCreateInviteWriter` |
| 9021 | NIP-29 | `RoomJoinReader` / `RoomJoinWriter` |
| 9022 | NIP-29 | `RoomLeaveReader` / `RoomLeaveWriter` |
| 19004 | NIP-29 / Flotilla | `RoomCreatePermissionReader` / `RoomCreatePermissionWriter` |
| 39000 | NIP-29 | `RoomMetaReader` / `RoomMetaWriter` |
| 39001 | NIP-29 | `RoomAdminsReader` / `RoomAdminsWriter` |
| 39002 | NIP-29 | `RoomMembersReader` / `RoomMembersWriter` |
| 9010 | NIP-29 | `RoomUpdatePinsReader` / `RoomUpdatePinsWriter` — the pin op |
| 39005 | NIP-29 | `RoomPinsReader` / `RoomPinsWriter` — the relay-signed pin snapshot |

`RoomPinsReader`/`RoomUpdatePinsReader` (the latter extends the former): `pins()`, `ids()`, `addresses()`, `isPinned(idOrAddress)`; writer `setPins(idsOrAddresses)`, which replaces every `e`/`a` tag with the full list. Both set `requiresRelays`. `RoomUpdatePins` also requires the `h` tag (`setRoom`), while `RoomPins`, like `RoomMeta`, takes the room id as its `d` tag (`setIdentifier(roomId)`).

`RoomMetaReader`: `name`, `about`, `picture`, `pictureMeta`, `isClosed`/`isHidden`/`isPrivate`/`isRestricted`/`hasLivekit`; writer `setName`/`setAbout`/`setPicture`/`setClosed`/`setHidden`/`setPrivate`/`setRestricted`/`setLivekit`. `RoomJoinReader`: `claim()`; writer `setClaim` (a free-text reason goes in the content). `RoomAddMemberWriter.addPubkey`. `RoomAdminsReader`: `pubkeys()`, `rolesFor(pk)`, `rolesByPubkey()` over `["p", pubkey, ...roles]` tags; writer `addPubkey(pk, roles?)` (omitting `roles` keeps the admin's existing ones), `removePubkey`, `setPubkeys` (keeps retained admins' roles).

### Relay membership (Flotilla "spaces" — relay-level, NIP-29-adjacent)

| Kind | NIP | Reader / Writer |
|---|---|---|
| 8000 | Flotilla | `RelayAddMemberReader` / `RelayAddMemberWriter` |
| 8001 | Flotilla | `RelayRemoveMemberReader` / `RelayRemoveMemberWriter` |
| 33534 | Flotilla | `RelayRoleReader` / `RelayRoleWriter` |
| 13534 | Flotilla | `RelayMembersReader` / `RelayMembersWriter` |
| 28934 | Flotilla | `RelayJoinReader` / `RelayJoinWriter` |
| 28935 | NIP-29 | `RelayInviteReader` / `RelayInviteWriter` |
| 28936 | Flotilla | `RelayLeaveReader` / `RelayLeaveWriter` |

`RelayMembersReader`: `pubkeys()`, `isMember(pk)`, `rolesFor(pk)`, `rolesByPubkey()` over `["member", pubkey, ...roleIds]` tags; writer `addPubkey(pk, roles?)` (omitting `roles` keeps existing ones)/`removePubkey`/`setPubkeys` (keeps retained members' roles) (its constructor calls `setProtected(true)` per NIP-43, as do `RelayJoin`'s and `RelayLeave`'s). `RelayRoleReader`: `label()`, `description()`, `color()`, `order()`; writer `setLabel`/`setDescription`/`setColor(hue)`/`setOrder`. All of these set `requiresRelays` — publish with `forceRoutes(relay(url))` or `setRoom`.

### Handlers (NIP-89)

| Kind | NIP | Reader / Writer |
|---|---|---|
| 31989 | NIP-89 | `HandlerRecommendationReader` / `HandlerRecommendationWriter` |
| 31990 | NIP-89 | `HandlerReader` / `HandlerWriter` |

`HandlerReader`: JSON content → `values: HandlerMeta`; getters `name`, `about`, `picture`, `website`, `lud16`, `nip05`, `kinds()`; writer `setName`/…/`setKinds(number[])`. Exports type `HandlerMeta`.

### Zaps (NIP-57 / NIP-75)

| Kind | NIP | Reader / Writer |
|---|---|---|
| 9041 | NIP-75 | `ZapGoalReader` / `ZapGoalWriter` |
| 9734 | NIP-57 | `ZapRequestReader` / `ZapRequestWriter` |
| 9735 | NIP-57 | `ZapReceiptReader` / `ZapReceiptWriter` |

`ZapRequestReader`: `amount`, `lnurl`, `recipient`, `eventId`, `urls` (the comment is the base `content()`). `ZapRequestWriter.requestInvoice(zapper)` signs the request and fetches a bolt11 invoice. `ZapReceiptReader`: `bolt11`, `invoiceAmount`, `request`, `sender`, `recipient`, `eventId`, `comment`, `preimage`; check it with `Zapper.validate(receipt)`, which returns a `Zap` or `undefined`. `ZapGoalReader`: `title`, `summary`, `image`, `amount`, `urls`, `closedAt`, plus `progress(zaps)`/`counted(zaps)`. Every `amount` tag is read through `msatsTags`, so one holding anything but a whole number of millisats is absent rather than truncated — `undefined` on a request, 0 on a goal, and a rejected receipt in `Zapper.validate`.

### BOLT12 zaps (NIP-B1)

| Kind | NIP | Reader / Writer |
|---|---|---|
| 9736 | NIP-B1 | `Bolt12ZapReader` / `Bolt12ZapWriter` |
| 9737 | NIP-B1 | `Bolt12ZapIntentReader` / `Bolt12ZapIntentWriter` |
| 10058 | NIP-B1 | `Bolt12OfferReader` / `Bolt12OfferWriter` |

The payer signs the zap itself, so there is no zapper to validate it against. `Bolt12ZapReader.intent()` and `.offer()` return the kind-9737 intent in the `description` tag and the kind-10058 announcement in the `offer_event` tag, verifying the signatures they arrive with — both come as JSON rather than from a relay. Neither is parse state, so reading a zap's other tags costs no verification. `validate()` returns a `Bolt12ZapClaim` (`{event, intent, offer, offers, target, amount, proof, payerNote}`) or undefined, having checked everything but the `lnp` payer proof. `getBolt12ZapPaymentHash(claim)` is that half: it decodes the proof with `@welshman/util`, checks the settled payment carries the claim's note and amount and pays one of the announced offers, and returns the `invoice_payment_hash`. `sumBolt12Zaps(claims)` runs it, deduplicates per target, and totals what passes; a profile total is the claims whose `target` is undefined. `Bolt12ZapWriter.validate` runs it too, against the amount, offers and intent id the zap it is rendering names, so an unsettled proof is refused before the zap is signed.

### Content

| Kind | NIP | Reader / Writer |
|---|---|---|
| 11 | NIP-7D | `ThreadReader` / `ThreadWriter` |
| 20 | NIP-68 | `PictureReader` / `PictureWriter` |
| 1018 | NIP-88 | `PollResponseReader` / `PollResponseWriter` |
| 1068 | NIP-88 | `PollReader` / `PollWriter` |
| 1111 | NIP-22 | `CommentReader` / `CommentWriter` |
| 1984 | NIP-56 | `ReportReader` / `ReportWriter` |
| 1985 | NIP-32 | `LabelReader` / `LabelWriter` |
| 30067 | Pinboards | `PinboardReader` / `PinboardWriter` |
| 30402 | NIP-99 | `ClassifiedReader` / `ClassifiedWriter` |
| 30078 | NIP-78 | `AppDataReader` / `AppDataWriter` |
| 31890 | Saved feeds | `FeedReader` / `FeedWriter` |
| 31922 | NIP-52 | `DateEventReader` / `DateEventWriter` |
| 31923 | NIP-52 | `TimeEventReader` / `TimeEventWriter` |
| 31925 | NIP-52 | `CalendarRsvpReader` / `CalendarRsvpWriter` |
| 39067 | Pinboards | `PinReader` / `PinWriter` |
| 30023 | NIP-23 | `ArticleReader` / `ArticleWriter` (factory `Article`) |
| 31992 | slash commands | `CommandReader` / `CommandWriter` (factory `Command`) |

`CommentReader`: `root()`/`parent()`, each an `EventRef` from the uppercase or lowercase tags, or `undefined` when they name no event; writer `setRoot`/`setParent`/`setRootFromEvent`/`setParentFromEvent`, plus `replyTo(event)`, which parents on `event` and roots on the thread it is in — the root tags of a comment, `event` itself for any other kind. `PollReader`: `title`, `options`, `pollType`, `endsAt`, `isClosed`, `urls`, plus `results(responses)`; writer `addOption`, `setPollType`, `setEndsAt`. `ReportWriter`: `setPubkey`/`setEventId`/`setReason` (routes to `[userOutbox()]`). `DateEventReader` (31922): the all-day sibling of `TimeEvent`, with `start`/`end` as `YYYY-MM-DD` strings and `end` exclusive; writer `setTitle`/`setLocation`/`setStart`/`setEnd`, deriving the same `D` day-bucket tags (the start day alone when there is no end). `CalendarRsvpReader` (31925): `calendarEvent()` (the event's address), `calendarEventId()`, `status()`, `freebusy()`; writer `setCalendarEvent(address, relay?)`/`setCalendarEventFromEvent(event, relay?)` (which also e-tags and p-tags the organizer; a given `relay` is the hint for `a` and `e`, otherwise the `e` hint comes from the organizer's outbox), `setStatus`/`setFreebusy`/`clearFreebusy`, where declining clears free/busy and `validate()` requires an event and a status; query `forCalendarEvent(address)`, which asks the organizer's inbox. `PictureReader` (20): `title`, `topics()`, `location`, `geohash`, plus the shared `imeta()`; writer `setTitle`/`setTopics`/`setLocation`/`setGeohash` and the shared `addImeta`/`removeImeta`. It derives the top-level `x` and `m` tags from its attached images, and `validate()` requires at least one image. Exported types: `ClassifiedPrice`, `PollType`, `PollOption`, `PollResult`, `PinReference`, `ExternalRef`, `RsvpStatus`, `RsvpFreebusy`.

`LabelReader` (1985): `namespaces()` (`L` values), `labels(namespace?)` (`l` values, optionally in one namespace), `eventIds()`, `pubkeys()`, `addresses()`, `topics()`, `urls()` (`r` values that parse as any url, unnormalized); writer `addLabel(name, namespace)`/`removeLabel(name, namespace)` (which add the `L` declaration and drop it with its last label), `addEventId`/`addPubkey`/`addAddress`/`addTopic`/`addUrl` and the matching `remove*`, all without relay hints. `validate()` requires an `l` tag, and the writer routes to `[userOutbox()]` only.

`ArticleReader` (long-form, 30023): `title`, `summary`, `image`, `publishedAt`, `topics()`; writer `setTitle`/`setSummary`/`setImage`/`setPublishedAt`/`setTopics`.

`CommandReader` (31992): `command`, `title`, `description`, `args()`, `scopes()`, plus `matches(target: CommandScopeTarget)`; writer `setCommand`/`setTitle`/`setDescription`/`setArgs`/`setScopes`. The invocation grammar itself (parsing/rendering `/command arg…`) lives in `@welshman/util`'s `Command.ts`, so non-domain callers can use it.

`PinboardReader` (30067): `title`, `description`, `image`, `topics()`, `collaborative()`; writer `setTitle`/`setDescription`/`setImage`/`setTopics`/`setCollaborative`. `PinReader` (39067): `boards()`, `isProfilePin()`, `reference()` (a `PinReference`: an `EventRef`, or an `ExternalRef` `{external, kind?}`), `title`, `topics()`; writer `addBoard`/`removeBoard`, `setEvent`/`setAddress`/`setExternal`, `setTitle`/`setTopics`.

### Wiki (NIP-54)

| Kind | NIP | Reader / Writer |
|---|---|---|
| 818 | NIP-54 | `WikiMergeRequestReader` / `WikiMergeRequestWriter` (factory `WikiMergeRequest`) |
| 30818 | NIP-54 | `WikiReader` / `WikiWriter` (factory `Wiki`) |
| 30819 | NIP-54 | `WikiRedirectReader` / `WikiRedirectWriter` (factory `WikiRedirect`) |

An article's `d` tag is its subject run through `@welshman/util`'s `normalizeWikiName`; the `Wiki` and `WikiRedirect` writers' `validate()` rejects an unnormalized one, and their queries' `forName(...names)` normalize the names given. `WikiReader`: `title()`, `summary()`, `fork()`, `deferral()` (each a `WikiVersion`, `{address?, id?, relay}`, from `e`/`a` tags marked `fork`/`defer`); writer `setName(name)` (normalized `d` plus `title`), `setTitle`/`setSummary`, `setFork(event)`/`clearFork()`, `setDeferral(event)`/`clearDeferral()`. `WikiRedirectReader`: `articleAddress()`; writer `setName(name)`, `setArticle(event)` (requires the `a` tag); query `forName`, `forArticle(...events)`. `WikiMergeRequestReader`: `articleAddress()`, `articleAuthor()`, `baseId()` (unmarked `e`), `sourceId()` (`e` marked `source`); writer `setArticle(event)` (`a`, `p`, `e`), `setSource(event)`, requiring both; query `forArticle(event)`, which filters on the article's address and adds its author's inbox.

### Badges (NIP-58)

| Kind | NIP | Reader / Writer |
|---|---|---|
| 8 | NIP-58 | `BadgeAwardReader` / `BadgeAwardWriter` |
| 30008 | NIP-58 | `ProfileBadgesReader` / `ProfileBadgesWriter` |
| 30009 | NIP-58 | `BadgeDefinitionReader` / `BadgeDefinitionWriter` |

`BadgeDefinitionReader` (30009): `name`, `description`, `image()`, `thumbs()` (both `BadgeImage`, `{url, dim?}`); writer `setName`/`setDescription`/`setImage`/`setThumbs`, and `setIdentifier()` for the badge's slug. `BadgeAwardReader` (8): `badge()` (the definition's address), `awardees()`; writer `setBadge`/`addAwardee`/`removeAwardee`, and `validate()` requires both a badge and an awardee. `ProfileBadgesReader` (30008): `badges()` (a `ProfileBadge[]` of `{address, awardId, relay?}` read from consecutive `a`/`e` pairs, in display order), `includes(address)`; writer `setBadges`/`addBadge`/`removeBadge`. Its `d` tag is fixed at `profile_badges` by the writer, so it never needs `setIdentifier()`. Exported types: `BadgeImage`, `ProfileBadge`.

## Using it from @welshman/app

`@welshman/app`'s `Domain` plugin binds the app's dependencies (resolver from the `Router` plugin and a lazy signer getter) and memoizes one `ConfiguredKind` per factory:

```typescript
import {Domain} from "@welshman/app"
import {FollowList, Note} from "@welshman/domain"

// read side (event decoder for a data plugin):
eventToItem: app.use(Domain).reader(Note)                 // ConfiguredKind.reader

// fetch side — query → filters + relays:
const {filters, relays} = await app.use(Domain).query(Note).setAuthors([pubkey]).render()

// mutation side — writer → Command → publish:
const reader = existingReader                             // from a prior read, or undefined
const writer = app.use(Domain).writer(FollowList, reader).follow(pubkey)
const command = await app.use(Domain).command(writer)    // render() + wrap
command.publish()                                          // or .publishToRelays(urls)
```

`Domain.command(writer)` requires a signed-in user, calls `writer.render()`, and returns a `Command` (`.publish()` / `.publishToRelays(urls)`). The `Router` plugin's `resolver` (a `Resolver`) is what dereferences every route to concrete relay urls.

## Gotchas

- **The writer never signs.** `renderTemplate()` gives an `EventTemplate` you sign yourself (`signer.sign(stamp(await writer.renderTemplate()))`), or hand the writer to `Domain.command`. `renderTemplate`/`scenario`/`relays`/`render` take no arguments; dependencies come from the context.
- **Private list tags need the author's signer in the context.** With no signer (or someone else's) a `ListReader` yields only public tags; `decrypted` stays `false`. Bind the author's own signer to see private entries.
- **Don't clobber undecryptable lists.** If you edit a list you couldn't decrypt and try to write private tags, `validate()` throws `Unable to modify list when decryption was not performed`. Editing only public tags is fine — the original ciphertext is preserved.
- **Room, relay-management and chat kinds need explicit relays.** They set `requiresRelays`, so `render()` throws unless you called `setRoom(url, room)` or `forceRoutes(...routes)`. Most room ops also require the `h` tag, which `setRoom` sets.
- **Parameterized-replaceable kinds throw without a `d` tag.** Call `setIdentifier()`, which defaults to a random id.
- **`RoomJoin`/`RelayJoin`/`RelayInvite` read the invite code via `claim()`.**

## Related skills

- `welshman-util` — the raw `TrustedEvent`/`EventTemplate` types, kind constants, tag getters, and the `RelaySelection` routing DSL + `Resolver`/`RelayScenario` these classes build on.
- `welshman-app` — the instance-based app layer whose `Domain` plugin supplies the `KindContext`, whose `Router` plugin supplies the resolver, and whose data plugins use these readers as `eventToItem`.
- `welshman-signer` — the `ISigner` interface and NIP-44 `decrypt`/`encrypt` used for private list tags and for signing rendered templates.
