# Flotilla kinds by feature

The kinds flotilla reads and writes, grouped by feature. Constants come from `@welshman/util` and
factories from `@welshman/domain` unless noted. Room and space-membership kinds are in the NIP-29
and NIP-43 tables in [SKILL.md](SKILL.md). Routes are under `src/routes/`.

## Space content

| Feature | Constant (kind) | Factory | Module | Where |
|---|---|---|---|---|
| Chat | `MESSAGE` (9) | none | `src/app/features/spaces/rooms/index.ts` | `spaces/[relay]/chat`, `spaces/[relay]/[h]` (`RoomChat`) |
| Threads | `THREAD` (11) | `Thread` | none | `spaces/[relay]/threads`, `threads/[id]` (`ThreadCreate`) |
| Comments | `COMMENT` (1111) | `Comment` | `src/lib/util.ts` (`makeCommentFilter`), `src/app/features/spaces/rooms/index.ts` (`publishComment`) | `CommentCompose`, `EventReply`, `EventComments` |
| Articles | `LONG_FORM` (30023) | `Article` | `src/app/features/spaces/articles.ts` | `spaces/[relay]/articles`, `articles/create`, `articles/[address]` |
| Calendar | `EVENT_TIME` (31923) | `TimeEvent` | `src/app/features/feeds.ts` (`makeCalendarFeed`) | `spaces/[relay]/calendar`, `calendar/[address]` (`CalendarEventForm`) |
| Classifieds | `CLASSIFIED` (30402) | `Classified` | `src/app/features/spaces/classifieds.ts` | `spaces/[relay]/classifieds`, `classifieds/[address]` (`ClassifiedForm`) |
| Goals | `ZAP_GOAL` (9041) | `ZapGoal` | none | `spaces/[relay]/goals`, `goals/[id]` (`GoalCreate`) |
| Polls | `POLL` (1068), `POLL_RESPONSE` (1018) | `Poll`, `PollResponse` | none | `spaces/[relay]/polls`, `polls/[id]` (`PollCreate`, `PollVotes`) |
| Library | `PINBOARD` (30067), `PIN` (39067) | `Pinboard`, `Pin` | `src/app/features/spaces/pinboards.ts` | `spaces/[relay]/library` (`PinboardEdit`, `PinSave`); published by any member |
| Room pins | `ROOM_PINS` (39005), `ROOM_UPDATE_PINS` (9010) | `RoomPins`, `RoomUpdatePins` | `src/app/features/spaces/rooms/pins.ts` | `RoomItemMenu`, `RoomItemMenuMobile`, `RoomPinnedMessagesAll` |
| Featured content | `APP_DATA` (30078), `d` = `flotilla/featured-content` | `AppData` | `src/app/features/spaces/featured.ts` | `SpaceFeaturedContent`; published as the relay |
| Bot commands (NIP-CD) | `COMMAND` (31992) | `Command` | `src/app/features/spaces/rooms/commands.ts` | `RoomCompose`, `ContentCommand` |
| Voice room participants | `LIVEKIT_PARTICIPANTS` (39004, defined in `src/app/features/spaces/calls/index.ts`) | none | `src/app/features/spaces/calls/index.ts` | rooms where `meta.hasLivekit()` |

## Read-only content

Kinds flotilla renders but never publishes.

| Feature | Constant (kind) | Factory | Module | Where |
|---|---|---|---|---|
| Highlights (NIP-84) | `HIGHLIGHT` (9802) | `Highlight` | none | `NoteContentHighlight`, `NoteContentMinimalHighlight` |

## Interactions

| Feature | Constant (kind) | Factory | Module | Where |
|---|---|---|---|---|
| Reactions | `REACTION` (7) | `Reaction`, through the `Reactions` plugin | `src/app/features/reactions.ts` | `RoomItem`, `EventReactButtons`, `ContentActions`, `CommentActions`, `ArticleActionBar` |
| Zaps | `ZAP_REQUEST` (9734), `ZAP_RECEIPT` (9735) | `ZapRequest`; receipts checked by `Zappers.validZapReceipts` | `src/app/features/wallet.ts` (wallets) | `Zap`, `ZapButton`, `GoalSummary`; off on iOS |
| Reports | `REPORT` (1984) | `Report` | `src/app/features/spaces/management/actionItems.ts` | `Report`, `ReportMenu` |
| Deletes | `DELETE` (5) | `Delete`, through the `Deletes` plugin | none | `EventDeleteConfirm`, `ReportMenu` |

## Direct messages

| Feature | Constant (kind) | Factory | Module | Where |
|---|---|---|---|---|
| DMs | `DIRECT_MESSAGE` (14), `DIRECT_MESSAGE_FILE` (15), wrapped as `WRAP` (1059) | `DirectMessage` for 14, bypassed in `Conversation.svelte`; none for 15 | `src/app/features/messages.ts` | `chat`, `chat/[chat]` (`Chat`) |

Gift wraps are only synced once the user opts in (`shouldUnwrap` in `src/app/features/messages.ts`), and
`goToMessages` in `src/app/ui/routes.ts` asks for messaging relays (`MessagesEnable`) before opening a chat.

## User data

| Feature | Constant (kind) | Factory | Module | Where |
|---|---|---|---|---|
| Profile | `PROFILE` (0) | `Profile` | none | `settings/profile`, `SignUp`, `ProfileDelete` |
| Settings | `APP_DATA` (30078), `d` = `flotilla/settings`, encrypted | `AppData` | `src/app/core/settings.ts` | `settings/*` |
| Status (NIP-38) | `STATUS` (30315), `d` = `general` | none | `src/app/features/statuses.ts` | `ProfileStatus` |
| Profile pins | `PINS` (10001) | `PinList` | `src/app/features/pins.ts` | profile pages |
| Spaces and rooms | `ROOMS` (10009) | `RoomList` | `src/app/features/spaces/rooms/index.ts` | the sidebar, `spaces` |
| Follows and mutes | `FOLLOWS` (3), `MUTES` (10000) | `FollowList`, `MuteList` | `src/app/features/social.ts` | people pages, muting |
| Relay lists | `RELAYS` (10002), `MESSAGING_RELAYS` (10050), `SEARCH_RELAYS` (10007), `BLOCKED_RELAYS` (10006), `BLOSSOM_SERVERS` (10063) | `RelayList`, `MessagingRelayList`, `SearchRelayList`, `BlockedRelayList`, `BlossomServerList` | plugins in `src/app/core/plugins.ts` | `settings/*` |
| Account deletion | `VANISH` (62, written as a literal), `DELETE` (5) | none; `Delete` bypassed | none | `ProfileDelete` |
| Push subscriptions | 30390 (`PUSH_SUBSCRIPTION`, local) | none | `src/app/features/push/adapters/capacitor.ts` | background |
