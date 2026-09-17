---
name: flotilla-model
description: "Use this skill when working on how flotilla speaks nostr: publishing or reading content in a space or room, adding or changing an event kind, NIP-29 room state, moderation and room invites, NIP-43 space membership and invite links, NIP-86 relay management and admin gating, NIP-42 auth or NIP-70 protected events, deciding which relays an event goes to, or replacing code that hand-parses tags or builds events with makeEvent."
---

# Flotilla's nostr model

Flotilla treats a relay as a community (a space) and a NIP-29 group on that relay as a channel (a
room). Most of the protocol logic lives below the app: `@welshman/domain` has a Reader/Writer pair
per kind, and `@welshman/app` plugins (`Rooms`, `RelayMemberLists`, `RelayManagement`, …) assemble
relay state out of those readers. Flotilla's own protocol code is a thin layer on top, mostly in
`src/app/access.ts`, `src/app/rooms.ts`, `src/app/management.ts` and the components that publish.

The per-feature kind inventory is in [kinds.md](kinds.md).

## Spaces and rooms

**A space is a relay URL.** No event defines one; the normalized URL is the identity, and routes
carry it as `encodeRelay(url)` (`src/app/relays.ts`) under `/spaces/[relay]`. Any relay can be
opened as a space. NIP-29 support only decides whether it has rooms.

**A room is a NIP-29 group `h` on that relay.** The same `h` can exist independently on several
relays, so anything room-scoped is keyed by both: `makeRoomKey(url, h)` from `@welshman/app` gives
`${url}'${h}`, and `isRoomId` in `src/app/rooms.ts` tests for the `'`. Other relay-scoped keys use
`|` (`${url}|${d}` for relay roles and NIP-CD commands) so the two can't collide. Room content
carries `["h", h]`; content with no `h` belongs to the whole space. `/spaces/[relay]/chat`
(`makeSpaceChatPath`) is the space-wide chat, which is `RoomChat` with no `h`.

**The user's spaces are their kind 10009 `ROOMS` list** (`RoomList` factory, `RoomLists` plugin):
`r` tags for spaces, `group` tags for rooms with the space URL as the hint. `userSpaceUrls` and
`deriveUserRooms(url)` in `src/app/rooms.ts` read it. "Joined" in the UI means "in this list",
which is separate from NIP-43 membership on the relay: `src/routes/spaces/[relay]/+layout.svelte`
prompts `SpaceJoin` for any URL not in `userSpaceUrls`. A deployment with `VITE_PLATFORM_RELAYS`
uses `PLATFORM_RELAYS` in place of the list for sync and navigation.

### NIP-11 relay info

The `Relays` plugin (`relays` in `src/app/core.ts`) fetches each relay's NIP-11 document into a
domain `Relay`. These fields drive protocol decisions:

| Read | Decides |
|---|---|
| `hasNip(29)` | whether the space has rooms. Without it everything lives in the space chat: `makeSpaceEntryPath` (`src/app/routes.ts`), `shareEvent` (`src/app/share.ts`), room search, notification grouping, `SpaceMenuRooms` |
| `hasNip(70)` | whether space content is marked protected (below) |
| `self` | the relay's own pubkey, the trust anchor for relay-signed state |
| `redirect_to` | the relay has moved. The space layout offers `SpaceRedirect`, which runs `roomLists.migrateRelay` and `goToMovedSpace` |
| `hasNip(50)`, `hasNip("BUD-02")`, `hasNip("9a")` | search, blossom uploads, push |

## Relay-signed state

The relay publishes NIP-29 and NIP-43 state under its NIP-11 `self` key: room metadata, admins,
members and pins, the space member list, and roles. Anyone can publish events of those kinds, so
readers must check the author. The welshman collections do: `Rooms` and every
`RelaySignedDerivedPlugin` (`RelayMemberLists`, `RelayRoles`, `RoomPinLists`) drop events whose
author isn't the relay's `self`, and re-check when NIP-11 loads. For a relay-authored kind with no
plugin, read through `deriveRelaySignedEvents(url, filters)` in `src/app/repository.ts`, as
`src/app/featured.ts` does, rather than a bare `deriveEventsForUrl`.

Content the space owns is published as the relay: `command.publishAsRelay(url)` has the relay
sign the event with its own key through the NIP-86 `signevent` method, then sends it back. Featured
content (`setFeaturedContent` in `src/app/featured.ts`) is written this way, and only users the
relay allows to call `signevent` can write it.

The library is written by its members. A shelf or a pin is signed with the member's own key and
published to the space like any other space content, so the library reads every `PINBOARD` seen on
the relay rather than only the relay's own. Whoever signed a shelf is the only one who can edit or
delete it, and anyone can pin to it.

## NIP-29 rooms

| Constant | Kind | Factory | Author | Flotilla use |
|---|---|---|---|---|
| `ROOM_META` | 39000 | `RoomMeta` | relay | name, about, picture, flags |
| `ROOM_ADMINS` | 39001 | `RoomAdmins` | relay | room admins |
| `ROOM_MEMBERS` | 39002 | `RoomMembers` | relay | member snapshot |
| `ROOM_PINS` | 39005 | `RoomPins` | relay | pinned messages |
| `ROOM_ADD_MEMBER` / `ROOM_REMOVE_MEMBER` | 9000 / 9001 | `RoomAddMember` / `RoomRemoveMember` | admin | `addRoomMembers`, `RoomMemberMenu` |
| `ROOM_EDIT_META` | 9002 | `RoomEdit` | admin | `rooms.editRoom` |
| `ROOM_CREATE` / `ROOM_DELETE` | 9007 / 9008 | `RoomCreate` / `RoomDelete` | admin | `RoomForm`, `RoomDetailMenu` |
| none (`ROOM_CREATE_INVITE` in `src/app/access.ts`) | 9009 | none | admin | `publishRoomInvite` |
| `ROOM_UPDATE_PINS` | 9010 | `RoomUpdatePins` | admin | `roomPinLists.setPins` |
| `ROOM_JOIN` / `ROOM_LEAVE` | 9021 / 9022 | `RoomJoin` / `RoomLeave` | user | `joinRoom` / `leaveRoom` in `src/app/access.ts` |
| `ROOM_CREATE_PERMISSION` | 19004 | `RoomCreatePermission` | not checked | `deriveUserCanCreateRoom` |

`@welshman/util` also defines `ROOM_ADD_PERM` (9003), `ROOM_REMOVE_PERM` (9004),
`ROOM_DELETE_EVENT` (9005) and `ROOM_EDIT_STATUS` (9006); flotilla uses none of them. An admin
removes a message with NIP-86 `banEvent` instead (`RoomItemMenu`, `EventMenu`).

### How `Rooms` builds a room

`rooms.get().forRoom(url, h)` yields `{id, url, h, meta, members, admins}` from the three
relay-signed state kinds. A `ROOM_DELETE` tombstones the room when it is at least as new as all of
that state, so a room re-created after deletion comes back. Membership (`members(url, h)`,
`membershipStatus(url, h)`) replays the 39002 snapshot, then newer 9000/9001 ops authored by an
admin or the relay, then pending 9021/9022 requests, into `MembershipStatus.Initial | Pending |
Granted`. `pendingJoins(url, h?)` lists unanswered join requests, and `deriveSpaceActionItems`
(`src/app/actionItems.ts`) merges them with reports into the admin queue.

`src/app/rooms.ts` puts space authority on top:

- `deriveUserIsRoomAdmin`: a space admin administers every room.
- `deriveUserRoomMembershipStatus`: an admin is always `Granted`.
- `addRoomMembers`: allows each non-member at the relay (NIP-86 `allowPubkey`) before publishing
  9000, because a room member the relay won't serve can't read the room.
- `deriveUserRooms`, `deriveOtherRooms`, `deriveOtherVoiceRooms`: rooms from the user's 10009
  list and the rest of the space, limited to rooms the relay still advertises. `meta.hasLivekit()`
  marks a voice room.

### Room flows

- **Create** (`RoomForm.svelte`): `rooms.createRoom` (9007, `h` from `randomId()`), tolerating an
  "already" error, then `rooms.editRoom` (9002) with metadata and flags, then `joinRoom`.
- **Delete** (`RoomDetailMenu.svelte`): `rooms.deleteRoom` (9008), then `roomLists.removeRoom`.
- **Join and leave** (`joinRoom`, `leaveRoom` in `src/app/access.ts`): two publishes, the
  9021/9022 the relay may refuse and the user's 10009 list, which is what puts the room in the
  sidebar. `isMembershipRefusal` counts `duplicate:` and "already a member" replies as success.
- **Invite** (`publishRoomInvite`): a 9009 with a random `code` tag. The link carries `h` and
  `code`, and `joinRoom(url, h, code)` sends the code as the join's `claim`.
- **Pins**: `roomPinLists.setPins(url, h, pins)` sends 9010 and the relay republishes 39005.
  `deriveRoomPinnedEvents` (`src/app/roomPins.ts`) loads the pinned events from the room's relay.

The relay enforces the `RoomMetaReader` flags (`isClosed`, `isHidden`, `isPrivate`,
`isRestricted`); the UI only reflects them. Until membership is `Granted`, `RoomChat` hides a
private room's messages and blocks posting to a restricted room, and `RoomDetail` describes the
flags.

## NIP-43 space membership

| Constant | Kind | Factory | Flotilla use |
|---|---|---|---|
| `RELAY_MEMBERS` | 13534 | `RelayMembers` | relay-signed member list, `relayMemberLists.forUrl(url)` |
| `RELAY_ADD_MEMBER` / `RELAY_REMOVE_MEMBER` | 8000 / 8001 | `RelayAddMember` / `RelayRemoveMember` | membership ops; the space chat shows 8000 the way a room shows 9000 |
| `RELAY_JOIN` | 28934 | `RelayJoin` | join request carrying a `claim` (`publishJoinRequest`) |
| `RELAY_INVITE` | 28935 | `RelayInvite` | unused since claims moved to NIP-86 |
| `RELAY_LEAVE` | 28936 | `RelayLeave` | `publishLeaveRequest` |
| `RELAY_ROLE` | 33534 | `RelayRole` | relay-signed role definitions (`relayRoles`) |

Roles are a flotilla extension. A member tag is `["member", pubkey, ...roleIds]`, and
`deriveSpaceMemberRoles` in `src/app/roles.ts` parses the role ids because `RelayMembersReader`
has no getter for them yet. Roles are only ever changed over
NIP-86 (`createRole`, `editRole`, `deleteRole`, `assignRole`, `unassignRole`), never by publishing
33534.

Joining a space (`attemptRelayAccess` and `Access` in `src/app/access.ts`):

1. Open the socket and drive NIP-42 auth, retrying up to three times.
2. Publish `RelayJoin` with the claim. The writer protects the event and requires a forced relay.
3. Translate refusals: "invite code" means rejected, "claim" means the space needs an invite.
4. `completeJoin`: `roomLists.addRelay(url)`, restart sync, and `Sync.push` the user's `RELAYS`,
   `MESSAGING_RELAYS`, `FOLLOWS` and `PROFILE` to the space so other members can see them.

Invite links are `${PLATFORM_URL}/join?r=<relay>&c=<claim>`, plus `h` and `code` for a room
(`makeInviteLink`; `parseInviteLink` also accepts a bare relay URL). `src/routes/join` renders
`SpaceInviteAccept`, which calls `Access.acceptInvite` to join the space and then the room.
`Access.prepareInvite` gets a claim over NIP-86 (`supportedmethods`, then `listclaims`, then
`createclaim`); this replaced reading `RELAY_INVITE` events. Leaving (`SpaceExit`,
`SpaceAuthError`) is `roomLists.removeRelay(url)` plus `publishLeaveRequest(url)`.

## NIP-86 relay management

`relayManagement.get().forUrl(url)` returns welshman's `ManagementApi`: JSON-RPC over HTTP at the
relay's URL, each call signed with a fresh NIP-98 event. Every method resolves to
`{result, error}`.

| Methods | Called from |
|---|---|
| `supportedMethods` | `deriveSpaceSupportedMethods` (`src/app/management.ts`), `Access.prepareInvite` |
| `banPubkey`, `unbanPubkey`, `allowPubkey`, `unallowPubkey`, `listBannedPubkeys` | `ProfileDetail`, `SpaceMemberMenu`, `SpaceMemberBannedMenu`, `SpaceInvite`, `ReportMenuList`, `addRoomMembers` |
| `banEvent` | `RoomItemMenu`, `EventMenu`, `ReportMenuList`, `RoomJoinItem` (dismissing a join request) |
| `createRole`, `editRole`, `deleteRole`, `assignRole`, `unassignRole` | `RoleCreate`, `RoleEdit`, `SpaceRoleMenu`, `SpaceMemberRoles`, `RoleAddMembers` |
| `listClaims`, `createClaim` | `Access.prepareInvite` |
| `changeRelayName`, `changeRelayDescription`, `changeRelayIcon` | `SpaceEdit` |
| `signEvent` | `Command.publishAsRelay` |

Admin status is inferred. A relay answers `supportedmethods` with everything it implements rather
than what the caller may use, and refuses non-admins outright, so `deriveUserIsSpaceAdmin(url)`
only means the list came back non-empty (re-checked at most every five minutes per URL). To gate
one capability, check the method (`$supportedMethods.includes("signevent")`) and still handle an
error from the call, since a listed method can be blocked for a particular user.
`deriveUserCanCreateRoom` adds `ROOM_CREATE_PERMISSION` grants to space admins.

The hosting backend in `src/app/hosting.ts` is a separate HTTP API at `HOSTING_BACKEND_URL` for
relays the platform hosts. It authenticates with one NIP-98 header per pubkey, cached for a TTL,
instead of signing every call. `spaces/[relay]/admin` is its page, not a NIP-86 console. Hosting is
off on iOS (`HOSTING_ENABLED`).

## Auth, trust and protected events

- **NIP-42.** `authPolicy` in `src/app/policies.ts` never authenticates to a relay on the user's
  blocked-relay list and always does under `relay_auth: aggressive`. Under the default
  `conservative`, it authenticates only to relays in the user's room, relay or messaging-relay
  lists, or ones they have published to this session. `attemptRelayAccess` authenticates
  explicitly before a join.
- **Refusals.** `mostlyRestrictedPolicy` counts `restricted:` and `blocked:` replies per socket.
  Once most requests fail, `relaysMostlyRestricted` turns the space status to "Access Denied" and
  the layout shows `SpaceAuthError`.
- **Unsigned events.** Some relays strip signatures (hosted relays have a
  `policy_strip_signatures` flag). `ingestPolicy` and `trustPolicy` hold back unsigned events
  unless the relay is in the `trusted_relays` setting, while `SpaceTrustRelay` asks the user.
- **NIP-70.** Space content is protected exactly when the relay advertises NIP-70, so every space
  publish passes `setProtected(await relays.hasNip(url, 70))`. Per NIP-70 (a protocol claim not
  verified in this repo) a relay then accepts the event only from its author, which keeps space
  content from being copied elsewhere. The `RelayJoin`, `RelayLeave` and `RelayMembers` writers
  protect themselves, and `publishReaction` and `retractReaction` in `src/app/reactions.ts` check
  the relay for their callers.

## Which relays an event goes to

Space content goes to the space relay and nowhere else. The writer's routes decide where
`command.publish()` sends an event. See flotilla-state for the publishing pipeline itself.

| Tool | Effect | Use for |
|---|---|---|
| `writer.setRoom(url, h)` | adds `["h", h]` and forces `relay(url)` | anything in a room |
| `writer.forceRoutes(relay(url))` | forces the relay, no `h` | space-wide content, NIP-43 requests |
| default routes | the user's outbox plus inboxes of `p`-tagged pubkeys | profile, lists, settings, anything outside a space |
| `command.publishToRelays(urls)` | ignores the writer's relays | reactions, deletes, reports, comments, replies |
| `command.publishAsRelay(url)` | the relay signs via NIP-86 `signevent` | space-owned content |
| `wraps.get().publish({event, recipients})` | a NIP-59 wrap per recipient, to their `MESSAGING_RELAYS` | DMs and DM reactions and deletes |

`validate()` throws when an `h` tag has no forced route, and every room and relay-membership writer
sets `requiresRelays`, so a missing relay fails loudly. A content form forces the space relay and
adds `setRoom` only when it is posting into a room, as `ThreadCreate`, `ClassifiedForm`,
`CalendarEventForm`, `GoalCreate`, `PollCreate` and the article create route all do.

Some routing is built into welshman. `Reactions.react` and `Deletes.deleteEvent` find the target's
relay in the tracker and copy its `h`. The 10009 writer publishes to the user's outbox and to every
space it lists or used to list, so each relay hears about joins and leaves. Kind 9 has no factory,
so `RoomChat` and `publishRoomQuote` publish raw templates through `Thunks`.

Reads are scoped the same way. Request from the space relay (`relays: [url]`, plus `"#h": [h]` for
a room) and read results with `deriveEventsForUrl(url, filters)`, which uses the tracker to keep
only events seen on that relay. A repository-wide query would mix rooms that share an `h` across
relays. `src/app/sync.ts` pulls each space's room state, membership and recent content in the
background; see flotilla-state.

## Content kinds

The space sections are the kinds in `CONTENT_KINDS` (`src/app/content.ts`): `ZAP_GOAL`,
`EVENT_TIME`, `THREAD`, `CLASSIFIED`, `POLL`, `PINBOARD` and `LONG_FORM`. Each has list and detail
routes under `spaces/[relay]/`, reached through `makeContentPath` in `src/app/routes.ts`. Chat is
`MESSAGE` (kind 9). Comments (`COMMENT`, NIP-22) thread under any content kind, and
`makeCommentFilter(kinds)` selects them by `#K`. A content form with `shareToChat` set also posts
a kind 9 quoting the new event (`publishRoomQuote`), so clients that only render chat still see
it. Zaps and goals are off on iOS (`ENABLE_ZAPS` in `src/app/env.ts`).

[kinds.md](kinds.md) lists every kind by feature, with its factory, module and route.

### Adding a kind

1. Add the constant to `@welshman/util` and a factory to `@welshman/domain` upstream (see
   welshman-domain, "Adding a new kind").
2. Publish through `writer(Factory)` and `command(...)`, with `setRoom` or `forceRoutes` and
   `setProtected(await relays.hasNip(url, 70))` for space content.
3. For a new space section, add the kind to `CONTENT_KINDS` (which feeds sync, notifications, push,
   search and `SpaceMenuNavItems`), `CONTENT_NOUNS` and `makeContentPath`, and add routes under
   `spaces/[relay]/`.
4. If users sign it through a remote signer, add it to `NIP46_PERMS` in `src/app/nip46.ts`.
5. If it is relay-scoped state that has to survive a reload, add it to the `kinds` map in
   `src/app/storage.ts`.
6. If the relay signs it, read it through a `RelaySignedDerivedPlugin` or `deriveRelaySignedEvents`.

## Parsing and building events

AGENTS.md gives the rule. In protocol code a hand-built event also loses behavior the writer
carries:
`RelayJoinWriter` adds `-`, `DeleteWriter.addEvent` copies the target's `h` and routes to its
relay, `RoomListWriter` publishes to every listed space, and `validate()` refuses a room event with
no relay.

In order of preference:

1. The kind's reader: `reader(Thread)(event).title()`, `reader(TimeEvent)(event).start()`.
2. Base reader getters when the kind is known (`room()`, `protect()`, `expiration()`, `imeta()`),
   or the standalone helpers when it isn't (`getImeta`, `getExpiration`, `getReplyTags`,
   `getCommentTagValues`, `getEmojis`).
3. `tagValue(tagSpec("h"), event.tags)` in code that handles many kinds at once (notifications,
   `makeEventPath`, feed grouping), where no single reader applies.

When welshman lacks a kind or a getter, add it there rather than working around it in the app. A
tag spec is the right tool only for a tag nothing else will read, like the `content` tags on
featured-content app data.

### Known exceptions

These predate the rule or are waiting on welshman. Don't copy them; fix one when you touch it.

- **No factory yet:** `MESSAGE` (9) in `RoomChat` and `publishRoomQuote`; 9009 room invites in
  `src/app/access.ts`; `LIVEKIT_PARTICIPANTS` (39004, a local constant in `src/app/call.ts`);
  `STATUS` (30315) in `src/app/statuses.ts`, where `ProfileStatus` still uses `tags.find`; push
  subscriptions (a literal 30390) in `src/app/push/adapters/capacitor.ts`; `DIRECT_MESSAGE_FILE`
  (15) in `Chat.svelte`.
- **Factory exists but bypassed:** DMs built with `makeEvent` in `Chat.svelte` (`DirectMessage`);
  relay lists in `SignUp.svelte` (`RelayList`, `MessagingRelayList`); deletes in
  `ProfileDelete.svelte` and the push adapter (`Delete`); the vanish request as a literal `62`
  (`VANISH`).
- **Getter exists but bypassed:** titles in `src/app/title.ts`, `NoteContentThread` and the
  threads pages; calendar `start`/`end` in `src/app/feeds.ts` and the calendar page; poll `response`
  tags in `PollVotes`; `p` tags of `RELAY_ADD_MEMBER`, `ROOM_ADD_MEMBER` and
  `ROOM_CREATE_PERMISSION` (`SpaceMembersSummary`, `RoomItemAddMember`, `src/app/management.ts`);
  comment `E`/`A` tags in the list pages and `src/app/classifieds.ts`; `imeta` unpacking in
  `src/app/content.ts` and `Chat.svelte`.
- **Getter missing upstream:** role ids on `member` tags (`src/app/roles.ts`); the legacy `name`
  fallback for calendar titles (`CalendarEventHeader`).

Mind the name clash: `ROOM` from `@app/rooms` is the tag name `"h"`, while `ROOM` from
`@welshman/util` is kind 35834.

## Related skills

- flotilla-architecture: where protocol code sits among the layers and modules
- flotilla-state: the `App`, plugins, background sync, persistence, and the publishing pipeline
- flotilla-views: routes, components, and loading data from components
- welshman-domain: readers, writers, and adding a kind
- welshman-util: kind constants, tag specs, `RelaySelection` routing, NIP-42/86/98 helpers
- welshman-app: `Rooms`, `RelayManagement`, `RelaySignedDerivedPlugin`, `Command`, `Wraps`
- welshman-net: sockets, auth state and socket policies
