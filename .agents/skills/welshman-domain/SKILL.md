---
name: welshman-domain
description: "Use this skill when working with @welshman/domain: reading, building, querying, and routing typed nostr events by kind — the Reader/Writer/Query trio (EventReader/EventWriter/EventQuery, ListReader/ListWriter) bound to dependencies through KindFactory.configure → ConfiguredKind, that sits between @welshman/util's raw event types and @welshman/app's data plugins. Covers Profile, NIP-51 lists (follows, mutes, pins, relays, bookmarks, topics, emoji, feeds, blossom), NIP-29 rooms, Flotilla relay/space membership, NIP-89 handlers, NIP-57/75 zaps, notes/deletes/reactions, and content kinds (comment, thread, classified, poll, calendar, report). Use it to parse an event into domain getters, build/edit an event template, build the filters and relays that fetch a kind's events, resolve publish relays via the RelaySelection routing DSL (routes/forceRoutes/requiresRelays/scenario), handle NIP-44 private-list encryption, or migrate from the old Reader/Builder core (fromEvent/factory/toTemplate/toEvent/EventBuilder/ListBuilder/XBuilder/commandFromBuilder)."
---

# welshman/domain — Typed Readers, Writers & Routing for Nostr Kinds

## Overview

`@welshman/domain` translates nostr events to and from typed domain objects, and works out where to publish and fetch them. For each event kind it ships a matched trio:

- a **Reader** — a read-only view over a `TrustedEvent` with synchronous getters (`profile.name()`, `followList.pubkeys()`),
- a **Writer** — a mutable, chainable producer of an `EventTemplate` plus the relays to publish it to (`writer.renderTemplate()` / `writer.render()`), and
- a **Query** — a mutable, chainable producer of the `Filter`s that fetch the kind's events and the relays to request them from (`query.renderFilters()` / `query.render()`).

A kind is packaged as a **`KindFactory`**; you bind it to app dependencies once with `factory.configure(context)`, which returns a **`ConfiguredKind`** that mints readers, writers, and queries. Routing runs through the `@welshman/util` `RelaySelection` DSL and a `Resolver` supplied in the context.

It sits one layer above `@welshman/util` (raw `TrustedEvent`/`EventTemplate` types, tag getters, kind constants, the routing DSL) and one layer below `@welshman/app` (whose `Domain` plugin supplies the context and whose data plugins use these readers as their `eventToItem`). The package holds no stores, no network, no globals — dependencies arrive through the `KindContext`.

This replaces the old free-function helpers that used to live in `@welshman/util` (`makeProfile`/`readProfile`, `makeList`/`readList`, `readHandlers`, `Encryptable`, `makeRoomMetaEvent`/`makeRoomEditEvent`) **and** the earlier Reader/Builder core (`EventBuilder`/`ListBuilder`, `X.fromEvent`, `Kind.factory`, `builder.toTemplate`/`toEvent`). See the migration table below.

## Installation

```bash
npm install @welshman/domain
# or
pnpm add @welshman/domain
```

Peer deps: `@welshman/lib`, `@welshman/util`, `@welshman/signer`, `@welshman/net`, `@welshman/feeds`, and `nostr-tools`.

## Core mental model

1. **A kind is a `KindFactory`; bind it once with `configure`.** Each exported kind constant is `new KindFactory({kind, reader, writer, query})` — e.g. `export const Note = new KindFactory({kind: NOTE, reader: NoteReader, writer: NoteWriter, query: NoteQuery})`. Call `Note.configure(context)` to get a `ConfiguredKind` carrying the app's `resolver` and an optional `signer`, which is all `KindContext` holds. In an app you never call `configure` yourself — `@welshman/app`'s `Domain` plugin does it and memoizes the result.
2. **Readers wrap an event; Writers produce a template + relays; Queries produce filters + relays.** `configured.reader(event)` builds a Reader (unparsed) and `.parse()` populates it; `configured.writer(reader?)` builds a Writer, optionally seeded from a Reader (the edit flow); `configured.query()` builds a Query.
3. **Reading is sync unless the kind decrypts; getters are always sync.** You enter through `configured.reader(event).parse()`, which validates `event.kind` (throwing `Expected a kind X event, got kind Y`) and parses. `parse()` returns the reader for kinds that extend `EventReader` and a promise of it for kinds that extend `AsyncEventReader` — only the six private-tag lists and `AppData`, which have to decrypt. `await` works for both, and `Parsed<R>` is the type of whichever one a reader yields.
4. **Building is chainable; output is async.** Setters return `this`; you finish with `await w.renderTemplate()` (an `EventTemplate`), `await w.relays()` (publish urls), or `await w.render()` (both). None of these take arguments — the signer, resolver, and repository come from the context bound at `configure`.
5. **The signer is optional and lazy.** Most kinds ignore it. Only NIP-51 lists need it — to *decrypt* private tags on read, and to *encrypt* them (NIP-44, self-encrypted) on build. The app supplies it as a lazy getter so auth policies can swap it after `configure`.
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

Common base getters available on every reader (all synchronous): `id()`, `author()`, `content()`, `tags()`, `createdAt()`, `identifier()` (d-tag), `address()` (`kind:pubkey:d`), `room()` (NIP-29 h-tag), `protect()` (has `["-"]`), `expiration()`, `contentWarning()` (has a NIP-36 `content-warning` tag), `contentWarningReason()`, `client()` (the NIP-89 `client` tag as `{name, address?, relay?}`). Each kind adds its own — e.g. `profile.name()`, `profile.display()`, `followList.pubkeys()`, `followList.includes(pk)`.

The getters for tags any kind can carry delegate to standalone functions in `src/behaviors/` — `isProtected`, `getExpiration`, `getContentWarning`, `getClient`, `getEmojis`, `getZapSplits` (plus `splitZapAmount`). Use those on a bare event: `reader()` throws on a kind mismatch, so a cross-kind check can't go through a reader.

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
- Base behavior setters (chainable): `setContent`, `setRoom(url, room)`/`clearRoom` (h-tag + forced routes), `forceRoutes(...routes)`/`clearForcedRoutes`, `setProtected(bool)`, `setExpiration`/`clearExpiration`, `setContentWarning(reason?)`/`clearContentWarning`, `setClient(name, address?)`/`clearClient`, `setIdentifier`/`clearIdentifier` (d-tag, defaults to a random id), `addTags`, `keepTags(pred)`, `dropTags(pred)`. Shared tag/hint helpers: `tagPubkey(pubkey, petname?)`, `addQuote(event, relay?)`, `addZapSplit(pubkey, split?)`. Each kind adds its own setters.
- Output methods (all async, no arguments):
  - `renderTemplate()` → `EventTemplate` — runs `validate()`, then renders tags and content. A tag that carries a relay hint fills its hint slot through the protected `hint(...routes)` helper, which resolves routes to a single url; `renderTags()` awaits every in-flight hint before returning. List content is encrypted here.
  - `scenario()` → `RelayScenario` (chainable: `.limit()`, `.policy()`, `.allowLocal()`, …); `relays()` → `string[]` (the resolved publish urls).
  - `render()` → `{event: EventTemplate; relays: string[]}` — `renderTemplate()` and `relays()` together.

There is **no** `toEvent`/`toRumor`/`toTemplate` on the writer — the caller signs the template. In an app you hand the writer to `Domain.command(writer)` (which calls `render()` and wraps it in a `Command`). Directly, you sign the `renderTemplate()` output:

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
- **`renderRoutes()` is abstract, so every kind states where its events live.** Two protected helpers cover the common shapes: `authorRoutes()` (the queried authors' outboxes) and `mentionRoutes()` (inboxes of the pubkeys a `#p` filter names). Content kinds use both; author-scoped kinds (lists, app data) use `authorRoutes()` alone; indexed kinds (`Profile`, `FollowList`, `RelayList`, `MessagingRelayList`) add `indexers()`; the 20 `requiresRelays` room/relay-management kinds return `[]`; `DirectMessage` returns `[userMessaging()]`.
- A query with nothing to route on resolves to **no relays**; there is no fallback to the user's own. `setRoutes(routes)` replaces the rendered routes (`[relay(url)]`, `[userInbox()]`, …), `addRoutes(routes)` requests those alongside them, and `setRoom(url, room)` scopes a NIP-29 query to one relay's room.
- Output methods mirror the writer's: `renderFilters()` → `Filter[]`, `relays()`/`scenario()` → the request relays, `render()` → both.
- Past `renderRoutes`, most query subclasses are empty. A kind that models a relationship overrides `renderDomainFilters()`, merged onto the base filter, one filter per variant. `CommentQuery.forRoot(event)`/`forParent(event)` emit a filter each for the `E`/`e` id and `A`/`a` address reference forms, since a relay ANDs a filter's fields, and route to each target author's inbox, where comments p-tagged to that author are delivered.

## Routing: routes / forceRoutes / requiresRelays

Publishing targets come from the `@welshman/util` `RelaySelection` DSL (`outbox`, `inbox`, `inboxes`, `userOutbox`, `seen`, `relay`, `relays`, `indexers`, …). A writer resolves them through `context.resolver`.

- **Default routing** (`EventWriter.renderRoutes`): `[userOutbox(), ...inboxes(pTaggedPubkeys, 0.5)]` — deliver to the author's write relays (weight 1) and to every p-tagged pubkey's read relays (weight 0.5). Most kinds use this (`NoteWriter`, …).
- **`forceRoutes(...routes)`** sets `forcedRoutes`; when non-empty, `scenario()` publishes **only** there, bypassing `renderRoutes()`. It takes routes rather than urls, so `forceRoutes(userInbox())` pins an event to the user's read relays without resolving them first. `setRoom(url, room)` sets `forcedRoutes=[relay(url)]` **and** the `h` tag (NIP-29 room events); `clearForcedRoutes()`/`clearRoom()` undo it.
- **`requiresRelays`** (a readonly `true` on a subclass) makes `validate()` demand `forcedRoutes` — throwing `A kind N event must publish to explicit relays (via setRoom or forceRoutes)`. The 20 kinds that set it are all NIP-29 room ops/state and relay-management ops/state: `RoomCreate`, `RoomEdit`, `RoomDelete`, `RoomDeleteEvent`, `RoomJoin`, `RoomLeave`, `RoomAddMember`, `RoomRemoveMember`, `RoomMembers`, `RoomAdmins`, `RoomMeta`, `RoomPins`, `RoomUpdatePins`, `RoomCreatePermission`, `RelayJoin`, `RelayLeave`, `RelayInvite`, `RelayAddMember`, `RelayRemoveMember`, `RelayRole`, `RelayMembers`. (`RoomCreate` and `RoomJoin` additionally require a `roomTag` — call `setRoom`.)
- **Per-kind overrides.** Some writers replace `renderRoutes()`: `FollowListWriter`/`MuteListWriter`/`ReportWriter` publish to `[userOutbox()]` only (p-tags are data, not recipients); `RelayListWriter` adds `indexers()` and notifies every relay added to or removed from the list; `DeleteWriter` adds each deleted event's `seen` relays (and requires an `e`/`a` tag).

The DSL constructors `relays(urls)` and `inboxes(pubkeys)` return **arrays** (spread with `...`); the others return a single `RelaySelection`. Note `relay(url)`/`relays(urls)` replaced the old `relayHint`/`relayHints`.

## Async & signer notes

- **Async surface:** all of `renderTemplate`/`render`/`scenario`/`relays`/`renderTags` are async. `reader(event).parse()` is async only for the kinds that decrypt (`ListReader` subclasses, `AppData`); every getter and every setter is synchronous.
- **Reading private list tags:** a `ListReader` only surfaces `privateTags` when the context carries the **author's own** signer (it decrypts NIP-44 content only when `signer.getPubkey() === event.pubkey`). Decryption failures are swallowed — `decrypted` stays `false` and private tags stay empty.
- **Writing private list tags:** `ListWriter.buildContent` is where encryption happens. If there are private tags it requires a signer and NIP-44-encrypts them to the author's own pubkey (`A signer is required to encrypt private tags`). If the source was never decrypted, the original ciphertext is preserved untouched (so you don't clobber tags you couldn't see).
- **`renderTemplate()`** needs a signer only for list kinds with non-empty private tags. All other kinds ignore it. Signing (`signer.sign(stamp(...))`) always needs a signer.
- **`d`-tag required** (base `validate` throws otherwise) for parameterized-replaceable kinds: `RelaySet` (30002), `BadgeDefinition` (30009), `Pinboard` (30067), `Classified` (30402), `Feed` (31890), `DateEvent` (31922), `TimeEvent` (31923), `CalendarRsvp` (31925), `HandlerRecommendation` (31989), `Handler` (31990), `RoomMeta` (39000), `RoomAdmins` (39001), `RoomMembers` (39002), `Pin` (39067). Call `setIdentifier()`. `Pin` additionally requires a content reference (`e`/`a`/`i` tag) — without a unique `d` tag per pin, every pin from the same author would collide at the same address, since kind 39067 is itself addressable.
- **Explicit relays required** (`requiresRelays`, see above): all NIP-29 room and relay-management ops. Call `setRoom(url, room)` (which sets both the `h` tag and the forced route) or `forceRoutes(...routes)`.

## Kind classes

Each row: kind# — NIP — Reader / Writer.

### Profile

| Kind | NIP | Reader / Writer |
|---|---|---|
| 0 | NIP-01 | `ProfileReader` / `ProfileWriter` (factory `Profile`) |

`ProfileReader`: `name`, `nip05`, `lnurl`, `about`, `banner`, `picture`, `website`, `display(fallback?)`. Writer: `update`, `setName`, `setNip05`, `setAbout`, `setBanner`, `setPicture`, `setWebsite`. (Also exports `parseLnUrl`, `displayPubkey`.)

### Core notes / deletes / reactions

| Kind | NIP | Reader / Writer |
|---|---|---|
| 1 | NIP-01 / NIP-10 | `NoteReader` / `NoteWriter` (factory `Note`) |
| 5 | NIP-09 | `DeleteReader` / `DeleteWriter` (factory `Delete`) |
| 7 | NIP-25 | `ReactionReader` / `ReactionWriter` (factory `Reaction`) |
| 14 | NIP-17 | `DirectMessageReader` / `DirectMessageWriter` (factory `DirectMessage`) |
| 9802 | NIP-84 | `HighlightReader` / `HighlightWriter` (factory `Highlight`) |

`DirectMessageReader`: `recipients()`, `subject()`, `parentId()`; writer `addRecipient`/`removeRecipient`/`setSubject`/`setParent`. The **writer** renders **no** routes (`[]`) — a NIP-17 message is published as one gift wrap per recipient, each to its own relays, so the caller fans it out (`app.use(Wraps).publish`). The **query** routes to `[userMessaging()]`.

`HighlightReader`: `sources()`, `attributions()`, `mentions()`, `sourceContext()`, `comment()`, `references()`, `topics()`; writer `setSourceEvent`/`setSourceExternal`/`setSourceReference`, `addAttribution`/`removeAttribution`, `addMention`, `setSourceContext`/`clearSourceContext`, `setComment`/`clearComment`, `setTopics`.

`NoteWriter.setParent(event)` — NIP-10 reply threading (p-tags the parent's participants, e/a-tags the parent and thread root with markers + relay hints). `DeleteReader`: `ids()`, `addresses()`, `kinds()`, `reason()`; `DeleteWriter`: `addEvent(event)`, `setReason(reason)` (routes to the deleted events' `seen` relays; requires an `e`/`a` tag).

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

`ListWriter` mutators (public/private split): `addPublic`/`addPrivate`, `keepPublic`/`keepPrivate`/`keepTags`, `dropPublic`/`dropPrivate`/`dropTags`. Each kind also exposes intent-named helpers, e.g. `FollowListWriter.follow(pubkey, relayHint?, petname?)`/`unfollow`, `MuteListWriter.mutePublicly`/`mutePrivately`/`unmute`, `RelayListWriter.addReadUrl`/`addWriteUrl`/`removeReadUrl`/`removeWriteUrl`/`setReadUrls`/`setWriteUrls`/`setTags`, `RoomListWriter.addRoom`/`removeRoom`/`addRelay`/`removeRelay`/`setRelays`. (Note `FollowList` is a plain `EventWriter`, not a `ListWriter` — follows are public.)

### Rooms (NIP-29)

Room ops are scoped by the `h` tag and must publish to explicit relays — use `setRoom(url, room)`. Metadata kinds 39000–39002 are addressable per room.

| Kind | NIP | Reader / Writer |
|---|---|---|
| 9000 | NIP-29 | `RoomAddMemberReader` / `RoomAddMemberWriter` |
| 9001 | NIP-29 | `RoomRemoveMemberReader` / `RoomRemoveMemberWriter` |
| 9002 | NIP-29 | `RoomEditReader` / `RoomEditWriter` |
| 9007 | NIP-29 | `RoomCreateReader` / `RoomCreateWriter` |
| 9005 | NIP-29 | `RoomDeleteEventReader` / `RoomDeleteEventWriter` |
| 9008 | NIP-29 | `RoomDeleteReader` / `RoomDeleteWriter` |
| 9021 | NIP-29 | `RoomJoinReader` / `RoomJoinWriter` |
| 9022 | NIP-29 | `RoomLeaveReader` / `RoomLeaveWriter` |
| 19004 | NIP-29 / Flotilla | `RoomCreatePermissionReader` / `RoomCreatePermissionWriter` |
| 39000 | NIP-29 | `RoomMetaReader` / `RoomMetaWriter` |
| 39001 | NIP-29 | `RoomAdminsReader` / `RoomAdminsWriter` |
| 39002 | NIP-29 | `RoomMembersReader` / `RoomMembersWriter` |
| 9010 | NIP-29 | `RoomUpdatePinsReader` / `RoomUpdatePinsWriter` — the pin op |
| 39005 | NIP-29 | `RoomPinsReader` / `RoomPinsWriter` — the relay-signed pin snapshot |

`RoomMetaReader`: `name`, `about`, `picture`, `pictureMeta`, `isClosed`/`isHidden`/`isPrivate`/`isRestricted`/`hasLivekit`; writer `setName`/`setAbout`/`setPicture`/`setClosed`/`setHidden`/`setPrivate`/`setRestricted`/`setLivekit`. `RoomJoinReader`: `claim()`, `reason()` (free-text `content`); writer `setClaim`/`setReason`. `RoomAddMemberWriter.addPubkey`.

### Relay membership (Flotilla "spaces" — relay-level, NIP-29-adjacent)

| Kind | NIP | Reader / Writer |
|---|---|---|
| 8000 | Flotilla | `RelayAddMemberReader` / `RelayAddMemberWriter` |
| 8001 | Flotilla | `RelayRemoveMemberReader` / `RelayRemoveMemberWriter` |
| — | Flotilla | `RelayRoleReader` / `RelayRoleWriter` |
| 13534 | Flotilla | `RelayMembersReader` / `RelayMembersWriter` |
| 28934 | Flotilla | `RelayJoinReader` / `RelayJoinWriter` |
| 28935 | NIP-29 | `RelayInviteReader` / `RelayInviteWriter` |
| 28936 | Flotilla | `RelayLeaveReader` / `RelayLeaveWriter` |

`RelayMembersReader`: `pubkeys()`, `isMember(pk)`; writer `addPubkey(pk, role?)`/`removePubkey`/`setPubkeys` (its constructor calls `setProtected(true)` per NIP-43). All of these set `requiresRelays` — publish with `forceRoutes(relay(url))` or `setRoom`.

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

`ZapRequestReader`: `amount`, `lnurl`, `recipient`, `eventId`, `urls` (the comment is the base `content()`). `ZapReceiptReader`: `bolt11`, `invoiceAmount`, `request`, `sender`, `recipient`, `eventId`, `comment`, `preimage`, plus `verify(zapper)`.

### Content

| Kind | NIP | Reader / Writer |
|---|---|---|
| 11 | NIP-7D | `ThreadReader` / `ThreadWriter` |
| 20 | NIP-68 | `PictureReader` / `PictureWriter` |
| 1018 | NIP-88 | `PollResponseReader` / `PollResponseWriter` |
| 1068 | NIP-88 | `PollReader` / `PollWriter` |
| 1111 | NIP-22 | `CommentReader` / `CommentWriter` |
| 1984 | NIP-56 | `ReportReader` / `ReportWriter` |
| 30067 | Pinboards | `PinboardReader` / `PinboardWriter` |
| 30402 | NIP-99 | `ClassifiedReader` / `ClassifiedWriter` |
| 30078 | NIP-78 | `AppDataReader` / `AppDataWriter` |
| 31890 | NIP-51 | `FeedReader` / `FeedWriter` |
| 31922 | NIP-52 | `DateEventReader` / `DateEventWriter` |
| 31923 | NIP-52 | `TimeEventReader` / `TimeEventWriter` |
| 31925 | NIP-52 | `CalendarRsvpReader` / `CalendarRsvpWriter` |
| 39067 | Pinboards | `PinReader` / `PinWriter` |
| 30023 | NIP-23 | `ArticleReader` / `ArticleWriter` (factory `Article`) |
| 31992 | slash commands | `CommandReader` / `CommandWriter` (factory `Command`) |

`CommentReader`: `root()`/`parent()`; writer `setRoot`/`setParent`/`setRootFromEvent`/`setParentFromEvent`, plus `replyTo(event)`, which parents on `event` and roots on the thread it is in — the root tags of a comment, `event` itself for any other kind. `PollReader`: `title`, `options`, `pollType`, `endsAt`, `isClosed`, `urls`, plus `results(responses)`; writer `addOption`, `setPollType`, `setEndsAt`. `ReportWriter`: `setPubkey`/`setEventId`/`setReason` (routes to `[userOutbox()]`). `DateEventReader` (31922): the all-day sibling of `TimeEvent`, with `start`/`end` as `YYYY-MM-DD` strings and `end` exclusive; writer `setTitle`/`setLocation`/`setStart`/`setEnd`, deriving the same `D` day-bucket tags (the start day alone when there is no end). `CalendarRsvpReader` (31925): `calendarEvent()` (the event's address), `calendarEventId()`, `status()`, `freebusy()`; writer `setCalendarEvent`/`setCalendarEventFromEvent` (which also e-tags and p-tags the organizer), `setStatus`/`setFreebusy`/`clearFreebusy`, where declining clears free/busy and `validate()` requires an event and a status; query `forCalendarEvent(address)`, which asks the organizer's inbox. `PictureReader` (20): `title`, `topics()`, `location`, `geohash`, plus the shared `imeta()`; writer `setTitle`/`setTopics`/`setLocation`/`setGeohash` and the shared `addImeta`/`removeImeta`. It derives the top-level `x` and `m` tags from its attached images, and `validate()` requires at least one image. Exported types: `CommentRef`, `ClassifiedPrice`, `PollType`, `PollOption`, `PollResult`, `PinReference`, `RsvpStatus`, `RsvpFreebusy`.

`ArticleReader` (long-form, 30023): `title`, `summary`, `image`, `publishedAt`, `topics()`; writer `setTitle`/`setSummary`/`setImage`/`setPublishedAt`/`setTopics`.

`CommandReader` (31992): `command`, `title`, `description`, `args()`, `scopes()`, plus `matches(target: CommandScopeTarget)`; writer `setCommand`/`setTitle`/`setDescription`/`setArgs`/`setScopes`. The invocation grammar itself (parsing/rendering `/command arg…`) lives in `@welshman/util`'s `Command.ts`, so non-domain callers can use it.

`RoomPinsReader`/`RoomUpdatePinsReader`: `pins()`, `ids()`, `addresses()` (`RoomPinsReader` adds `isPinned`); writer `setPins`. Both set `requiresRelays`.

`PinboardReader` (30067): `title`, `description`, `image`, `topics()`, `collaborative()`; writer `setTitle`/`setDescription`/`setImage`/`setTopics`/`setCollaborative`. `PinReader` (39067): `boards()`, `isProfilePin()`, `reference()` (a `PinReference` discriminated union), `title`, `topics()`; writer `addBoard`/`removeBoard`, `setEvent`/`setAddress`/`setExternal`, `setTitle`/`setTopics`.

### Badges (NIP-58)

| Kind | NIP | Reader / Writer |
|---|---|---|
| 8 | NIP-58 | `BadgeAwardReader` / `BadgeAwardWriter` |
| 30008 | NIP-58 | `ProfileBadgesReader` / `ProfileBadgesWriter` |
| 30009 | NIP-58 | `BadgeDefinitionReader` / `BadgeDefinitionWriter` |

`BadgeDefinitionReader` (30009): `name`, `description`, `image()`, `thumbs()` (both `BadgeImage`, `{url, dim?}`); writer `setName`/`setDescription`/`setImage`/`setThumbs`, and `setIdentifier()` for the badge's slug. `BadgeAwardReader` (8): `badge()` (the definition's address), `awardees()`; writer `setBadge`/`addAwardee`/`removeAwardee`, and `validate()` requires both a badge and an awardee. `ProfileBadgesReader` (30008): `badges()` (a `ProfileBadge[]` of `{address, awardId, relay?}` read from consecutive `a`/`e` pairs, in display order), `includes(address)`; writer `setBadges`/`addBadge`/`removeBadge`. Its `d` tag is fixed at `profile_badges` by the writer, so it never needs `setIdentifier()`. Exported types: `BadgeImage`, `ProfileBadge`.

## Using it from @welshman/app

`@welshman/app`'s `Domain` plugin binds the app's dependencies (resolver from the `Router` plugin, repository, and a lazy signer getter) and memoizes one `ConfiguredKind` per factory:

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

`Domain.command(writer)` requires a signed-in user, calls `writer.render()`, and returns a `Command` (`.publish()` / `.publishToRelays(urls)`). This replaces the old `Router.commandFromBuilder(builder)`. The `Router` plugin's `resolver` (a `Resolver`) is what dereferences every route to concrete relay urls.

## Gotchas

- **Enter through a `ConfiguredKind`.** `Profile.configure(ctx).reader(event).parse()` to read, `configure(ctx).writer()` to build. In an app, `app.use(Domain).reader(Profile)` and `.writer(Profile)`.
- **The writer never signs.** `renderTemplate()` gives an `EventTemplate` you sign yourself (`signer.sign(stamp(await writer.renderTemplate()))`), or hand the writer to `Domain.command`. `renderTemplate`/`scenario`/`relays`/`render` take no arguments; dependencies come from the context.
- **Private list tags need the author's signer in the context.** With no signer (or someone else's) a `ListReader` yields only public tags; `decrypted` stays `false`. Bind the author's own signer to see private entries.
- **Don't clobber undecryptable lists.** If you edit a list you couldn't decrypt and try to write private tags, `validate()` throws `Unable to modify list when decryption was not performed`. Editing only public tags is fine — the original ciphertext is preserved.
- **Room / relay-management kinds need explicit relays.** They set `requiresRelays`, so `render()` throws unless you called `setRoom(url, room)` or `forceRoutes(...routes)`. `RoomCreate`/`RoomJoin` also require the `h` tag (use `setRoom`).
- **Parameterized-replaceable kinds throw without a `d` tag** — call `setIdentifier()` (or let it default to a random id).
- **`RoomJoin`/`RelayJoin`/`RelayInvite` read the invite code via `claim()`.**

## OLD → NEW migration

| Old API | New API |
|---|---|
| `new Kind({reader, builder, router})` | `new KindFactory({kind, reader, writer, query})` |
| `Kind` class | `KindFactory` (+ `ConfiguredKind` after `.configure`) |
| `EventBuilder` (base) / `XBuilder` | `EventWriter` / `XWriter` |
| `ListBuilder` | `ListWriter` |
| `X.fromEvent(event)` / `Kind.factory(event)` / `Kind.read(event)` | `factory.configure(ctx).reader(event).parse()` (validates kind, then parses — await only for lists / app data) |
| `Kind.builder(...)` / `new XBuilder(...)` | `factory.configure(ctx).writer(reader?)` |
| `builder.toTemplate()` | `writer.renderTemplate()` → `Promise<EventTemplate>` |
| `builder.toEvent(signer)` | `signer.sign(stamp(await writer.renderTemplate()))` |
| `builder.toRumor(signer)` | `prep(await writer.renderTemplate(), await signer.getPubkey())` |
| `Router.commandFromBuilder(builder)` | `app.use(Domain).command(writer)` |
| `parse(signer)` | `parse()` (reads `def.context.signer`) |
| `builder.finalize(context)` | `writer.render()` (no arg; context bound at `configure`) |
| standalone `resolve(...)` | `new Resolver(routeResolver, options)` → `.scenario`/`.relays`/`.relay` |
| `relayHint(url)` / `relayHints(urls)` | `relay(url)` / `relays(urls)` |
| — (new) | `inboxes(pubkeys, weight?)`, `Resolver`, `RelayScenario`, `KindContext` |

## Related skills

- `welshman-util` — the raw `TrustedEvent`/`EventTemplate` types, kind constants, tag getters, and the `RelaySelection` routing DSL + `Resolver`/`RelayScenario` these classes build on.
- `welshman-app` — the instance-based app layer whose `Domain` plugin supplies the `KindContext`, whose `Router` plugin supplies the resolver, and whose data plugins use these readers as `eventToItem`.
- `welshman-signer` — the `ISigner` interface and NIP-44 `decrypt`/`encrypt` used for private list tags and for signing rendered templates.
