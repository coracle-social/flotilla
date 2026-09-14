# Component naming vocabulary

Companion to `flotilla-views`. Names in `src/app/components` are `<Entity><Qualifier>`, flat and
PascalCase. This is what the qualifiers mean, drawn from the ~320 components there.

## Suffixes

| Suffix | Means | Examples |
|---|---|---|
| `Item` | one row or card in a list | `ClassifiedItem`, `NoteItem`, `PeopleItem`, `ReportItem`, `RoomItem` (a message in a room), `SpaceMenuRoomItem` |
| `Actions` | the footer row under an event: reactions, status, overflow menu | `ClassifiedActions`, `ThreadActions`, `GoalActions`, `EventActions` |
| `Menu` | the contents of a popover, taking an `onClick` that closes it | `EventMenu`, `ChatMenu`, `RoomItemMenu`, `SpaceMemberMenu` |
| `MenuList` | the popover contents when `*Menu` is the trigger instead | `ProfileMenu` → `ProfileMenuList`, `ReportMenu` → `ReportMenuList` |
| `Mobile` | the same actions as a modal, pushed on tap instead of hovered | `RoomItemMenuMobile`, `ChatMessageMenuMobile`, `SpaceMenuMobile` |
| `Create` / `Edit` | a modal that publishes a new or edited event | `ClassifiedCreate`, `RoomEdit`, `PinEdit` |
| `Form` | the fields shared by a Create/Edit pair | `ClassifiedForm`, `RoomForm`, `RoleForm` |
| `Detail` | a modal with everything known about an entity | `ProfileDetail`, `RoomDetail`, `ContentLinkDetail` |
| `Info` | a modal with an event's underlying data | `EventInfo`, `ProfileInfo` |
| `Summary` | a compact read-only digest, inline | `RelaySummary`, `GoalSummary`, `ReactionSummary` |
| `Status` | a small badge or indicator | `ClassifiedStatus`, `SignerStatus`, `ThunkStatus` |
| `Card` | a framed presentation of an event | `NoteCard`, `HomeInboxItemCard` |
| `Bar` | a horizontal strip across the top or bottom of something | `SpaceBar`, `ComposeBar`, `EventActionBar` |
| `Compose` | a message composer | `ChatCompose`, `RoomCompose`, `CommentCompose` |
| `Confirm` | the step that confirms an action or a code | `EventDeleteConfirm`, `LogInOTPConfirm`, `SignUpEmailConfirm` |
| `Add` | a modal that adds something to a collection | `SpaceAdd`, `PinAdd`, `RoomMembersAdd` |
| `Select` | a picker, as a modal or a bindable input | `PinboardSelect`, `TopicMultiSelect` |
| `Button` | a self-contained trigger | `ZapButton`, `DictationButton`, `RoomItemEmojiButton` |
| `Name`, `Image`, `Icon`, `Link`, `Circle` | one identifier rendered | `RoomName`, `RelayIcon`, `ProfileLink`, `ProfileCircle` |
| `Page` | the body of a route, when the page file delegates | `ProfilePage`, `ProfilePageNotes` |
| `Enable` | a gate that sets a feature up before letting you in | `ChatEnable`, `OpenRouterEnable` |

Verbs also work as qualifiers where no noun fits: `SpaceJoin`, `SpaceExit`, `SpaceInvite`,
`ProfileDelete`, `RoomSearch`.

## Prefix families

Most prefixes are the entity (`Space` 34 components, `Room` 28, `Profile` 26, `Chat` 11, plus one
per content kind). Four are families instead:

- `Event*` is kind-agnostic event UI: `EventMenu`, `EventActions`, `EventInfo`, `EventComments`.
- `Note*` renders an event as a note: `NoteItem`, `NoteCard`, `NoteContent`, one
  `NoteContent<Kind>` per kind, and a compact `NoteContentMinimal<Kind>`.
- `Content*` renders parsed content tokens: `ContentMention`, `ContentQuote`, `ContentTopic`.
- `Home*` are the dashboard's sections; `LogIn*` and `SignUp*` are auth steps; `Thunk*` show
  publish status; `Info*` are explainer dialogs (`InfoNostr`, `InfoKeys`, `InfoRelay`).

Eleven components are a bare entity, being the root of their feature: `Chat`, `Content`,
`Landing`, `Profile`, `Reaction`, `Report`, `Search`, `Share`, `Toast`, `Zap`, `Banner`.

## Outliers

Don't follow these:

- Verb-first or verb-in-the-middle: `EditFeaturedContent`, `ShareEvent`, `RoleAddMembers` (next
  to `RoomMembersAdd`), `WalletUpdateReceivingAddress`, `NewNotificationSound`, `MenuSettings`.
- `Modal` and `Dialog` suffixes: `IconPickerModal`, `ImageInputModal`, `VoiceRoomJoinDialog`,
  `VoiceCallAudioSettingsDialog`, and hosting's `PaymentDialog`, `PlanModal`,
  `CustomDomainModal`. Everything else is named for what it does, not for being a modal.
- `ReportDetails`, plural, next to `ProfileDetail` and `RoomDetail`.
- `SpaceMenu` is the space's sidebar navigation, not a popover, and it has its own family:
  `SpaceMenuHeader`, `SpaceMenuNavItems`, `SpaceMenuRooms`, `SpaceMenuDrawer`.
