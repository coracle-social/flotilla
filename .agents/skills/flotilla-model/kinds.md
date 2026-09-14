# Flotilla kinds by feature

The kinds flotilla reads and writes, grouped by feature. Constants come from `@welshman/util` and
factories from `@welshman/domain` unless noted. Room and space-membership kinds are in the NIP-29
and NIP-43 tables in [SKILL.md](SKILL.md). Routes are under `src/routes/`.

## Space content

| Feature | Constant (kind) | Factory | Module | Where |
|---|---|---|---|---|
| Chat | `MESSAGE` (9) | none | `src/app/rooms.ts` | `spaces/[relay]/chat`, `spaces/[relay]/[h]` (`RoomChat`) |
| Threads | `THREAD` (11) | `Thread` | none | `spaces/[relay]/threads`, `threads/[id]` (`ThreadCreate`) |
| Comments | `COMMENT` (1111) | `Comment` | `src/app/content.ts` (`makeCommentFilter`) | `CommentCompose`, `EventReply` |
| Articles | `LONG_FORM` (30023) | `Article` | `src/app/articles.ts` | `spaces/[relay]/articles`, `articles/create`, `articles/[address]` |
| Calendar | `EVENT_TIME` (31923) | `TimeEvent` | `src/app/feeds.ts` (`makeCalendarFeed`) | `spaces/[relay]/calendar`, `calendar/[address]` (`CalendarEventForm`) |
| Classifieds | `CLASSIFIED` (30402) | `Classified` | `src/app/classifieds.ts` | `spaces/[relay]/classifieds`, `classifieds/[address]` (`ClassifiedForm`) |
| Goals | `ZAP_GOAL` (9041) | `ZapGoal` | none | `spaces/[relay]/goals`, `goals/[id]` (`GoalCreate`) |
| Polls | `POLL` (1068), `POLL_RESPONSE` (1018) | `Poll`, `PollResponse` | none | `spaces/[relay]/polls`, `polls/[id]` (`PollCreate`, `PollVotes`) |
| Library | `PINBOARD` (30067), `PIN` (39067) | `Pinboard`, `Pin` | `src/app/pinboards.ts` | `spaces/[relay]/library` (`PinboardEdit`, `PinAdd`); published as the relay |
| Room pins | `ROOM_PINS` (39005), `ROOM_UPDATE_PINS` (9010) | `RoomPins`, `RoomUpdatePins` | `src/app/roomPins.ts` | `RoomItemMenu`, `RoomPinnedMessagesAll` |
| Featured content | `APP_DATA` (30078), `d` = `flotilla/featured-content` | `AppData` | `src/app/featured.ts` | `SpaceFeaturedContent`; published as the relay |
| Bot commands (NIP-CD) | `COMMAND` (31992) | `Command` | `src/app/commands.ts` | `RoomCompose`, `ContentCommand` |
| Voice room participants | `LIVEKIT_PARTICIPANTS` (39004, defined in `src/app/call.ts`) | none | `src/app/call.ts` | rooms where `meta.hasLivekit()` |

## Interactions

| Feature | Constant (kind) | Factory | Module | Where |
|---|---|---|---|---|
| Reactions | `REACTION` (7) | `Reaction`, through the `Reactions` plugin | `src/app/reactions.ts` | `RoomItem`, `EventReactButtons`, the `*Actions` components |
| Zaps | `ZAP_REQUEST` (9734), `ZAP_RECEIPT` (9735) | `ZapRequest`; receipts checked by `Zappers.validZapReceipts` | `src/app/lightning.ts` (wallets) | `Zap`, `ZapButton`, `GoalSummary`; off on iOS |
| Reports | `REPORT` (1984) | `Report` | `src/app/actionItems.ts` | `Report`, `ReportMenuList` |
| Deletes | `DELETE` (5) | `Delete`, through the `Deletes` plugin | none | `EventDeleteConfirm`, `ReportMenuList` |

## Direct messages

| Feature | Constant (kind) | Factory | Module | Where |
|---|---|---|---|---|
| DMs | `DIRECT_MESSAGE` (14), `DIRECT_MESSAGE_FILE` (15), wrapped as `WRAP` (1059) | `DirectMessage` for 14, bypassed in `Chat.svelte`; none for 15 | `src/app/chats.ts` | `chat`, `chat/[chat]` (`Chat`) |

Gift wraps are only synced once the user opts in (`shouldUnwrap` in `src/app/sync.ts`), and
`goToChat` in `src/app/routes.ts` asks for messaging relays (`ChatEnable`) before opening a chat.

## User data

| Feature | Constant (kind) | Factory | Module | Where |
|---|---|---|---|---|
| Profile | `PROFILE` (0) | `Profile` | none | `settings/profile`, `SignUp`, `ProfileDelete` |
| Settings | `APP_DATA` (30078), `d` = `flotilla/settings`, encrypted | `AppData` | `src/app/settings.ts` | `settings/*` |
| Status (NIP-38) | `STATUS` (30315), `d` = `general` | none | `src/app/statuses.ts` | `ProfileStatus` |
| Profile pins | `PINS` (10001) | `PinList` | `src/app/pins.ts` | profile pages |
| Spaces and rooms | `ROOMS` (10009) | `RoomList` | `src/app/rooms.ts` | the sidebar, `spaces` |
| Follows and mutes | `FOLLOWS` (3), `MUTES` (10000) | `FollowList`, `MuteList` | `src/app/social.ts` | people pages, muting |
| Relay lists | `RELAYS` (10002), `MESSAGING_RELAYS` (10050), `SEARCH_RELAYS` (10007), `BLOCKED_RELAYS` (10006), `BLOSSOM_SERVERS` (10063) | `RelayList`, `MessagingRelayList`, `SearchRelayList`, `BlockedRelayList`, `BlossomServerList` | plugins in `src/app/core.ts` | `settings/*` |
| Account deletion | `VANISH` (62, written as a literal), `DELETE` (5) | none; `Delete` bypassed | none | `ProfileDelete` |
| Push subscriptions | 30390 (a literal, no constant) | none | `src/app/push/adapters/capacitor.ts` | background |
