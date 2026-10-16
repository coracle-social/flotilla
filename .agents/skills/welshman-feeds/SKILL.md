---
name: welshman-feeds
description: "Use this skill when working with @welshman/feeds: building nostr feeds, FeedController, FeedCompiler, feed definitions, dynamic filtering, or composing feed sources."
---

# welshman/feeds — Dynamic Feed Construction

`@welshman/feeds` defines nostr feeds as data and executes them. A feed describes authors, kinds, tags and set operations as a typed tuple, and the package compiles it into relay requests and handles pagination, deduplication, and exhaustion. It uses `@welshman/net` for relay communication and `@welshman/util` for types.

## Installation

```bash
npm install @welshman/feeds
# pnpm add @welshman/feeds
# yarn add @welshman/feeds
```

## Key Exports

### Feed Types (enum + tuple types)

| Export | Description |
|---|---|
| `FeedType` | Enum of all feed type discriminants (`Author`, `Kind`, `Tag`, `Union`, `Intersection`, `Difference`, `DVM`, `List`, `Label`, `WOT`, `Scope`, `Relay`, `Search`, `ID`, `Address`, `CreatedAt`, `Global`) |
| `Scope` | Enum: `Followers`, `Follows`, `Network`, `Self` |
| `Feed` | Union type of all feed tuple types |
| `RequestItem` | `{ relays?: string[], filters?: Filter[] }` — output of compilation |

### Factory Functions

All feed definitions are typed tuples. The factories return them with the right tuple type, which raw arrays lack.

```typescript
// Leaf feeds
makeAuthorFeed(...pubkeys: string[]): AuthorFeed
makeKindFeed(...kinds: number[]): KindFeed
makeTagFeed(key: string, ...values: string[]): TagFeed
makeIDFeed(...ids: string[]): IDFeed
makeAddressFeed(...addresses: string[]): AddressFeed
makeRelayFeed(...urls: string[]): RelayFeed
makeSearchFeed(...terms: string[]): SearchFeed
makeGlobalFeed(): GlobalFeed
makeScopeFeed(...scopes: Scope[]): ScopeFeed
makeWOTFeed(...items: WOTItem[]): WOTFeed
makeCreatedAtFeed(...items: CreatedAtItem[]): CreatedAtFeed

// Dynamic / remote feeds
makeDVMFeed(...items: DVMItem[]): DVMFeed
makeListFeed(...items: ListItem[]): ListFeed
makeLabelFeed(...items: LabelItem[]): LabelFeed

// Set operations
makeUnionFeed(...feeds: Feed[]): UnionFeed
makeIntersectionFeed(...feeds: Feed[]): IntersectionFeed
makeDifferenceFeed(...feeds: Feed[]): DifferenceFeed
```

### Type Guards

```typescript
isAuthorFeed(feed)      isKindFeed(feed)     isTagFeed(feed)
isIDFeed(feed)          isAddressFeed(feed)  isRelayFeed(feed)
isSearchFeed(feed)      isGlobalFeed(feed)   isScopeFeed(feed)
isWOTFeed(feed)         isCreatedAtFeed(feed)
isDVMFeed(feed)         isListFeed(feed)     isLabelFeed(feed)
isUnionFeed(feed)       isIntersectionFeed(feed)  isDifferenceFeed(feed)
hasSubFeeds(feed)       // true for Union | Intersection | Difference
```

### Argument Extraction

```typescript
getFeedArgs(feed: AuthorFeed): string[]
getFeedArgs(feed: KindFeed): number[]
getFeedArgs(feed: CreatedAtFeed): CreatedAtItem[]
getFeedArgs(feed: WOTFeed): WOTItem[]
getFeedArgs(feed: UnionFeed): Feed[]
// overloaded for every feed type
```

### Conversion Utilities

```typescript
// Tags → feeds
feedsFromTags(tags: string[][], mappings?: TagFeedMapping[]): Feed[]
feedFromTags(tags: string[][], mappings?: TagFeedMapping[]): IntersectionFeed

// Filter(s) → feeds
feedsFromFilter(filter: Filter): Feed[]
feedFromFilter(filter: Filter): Feed
feedFromFilters(filters: Filter[]): Feed

// Default tag-to-feed mappings (override via DVMItem/ListItem mappings)
defaultTagFeedMappings: TagFeedMapping[]
// [["a", Address], ["e", ID], ["p", Author], ["r", Relay], ["t", Tag "#t"]]
```

### Traversal & Simplification

```typescript
walkFeed(feed: Feed, visit: (feed: Feed) => void): void
findFeed(feed: Feed, match: (feed: Feed) => boolean): Feed | undefined
simplifyFeed(feed: Feed): Feed  // flattens nested same-type set ops
```

### FeedCompiler

Transforms a `Feed` into `RequestItem[]` for direct relay querying.

```typescript
class FeedCompiler {
  constructor(options: FeedCompilerOptions)
  canCompile(feed: Feed): boolean
  async compile(feed: Feed): Promise<RequestItem[]>
}

type FeedCompilerOptions = {
  router: FeedRouter                 // REQUIRED — resolves relay selections
  getPubkeysForScope: (scope: Scope) => string[]
  getPubkeysForWOTRange: (min: number, max: number) => string[]
  signer?: ISigner
  signal?: AbortSignal
  context?: AdapterContext           // net context: {pool, repository, getAdapter?}
}
```

### FeedController

Orchestrates loading/listening with pagination, deduplication, and set-operation handling.

```typescript
class FeedController {
  compiler: FeedCompiler
  constructor(options: FeedControllerOptions)
  async load(limit: number): Promise<void>
  listen(): () => Promise<void>
  async getLoader(): Promise<(limit: number) => Promise<void>>
  async getListener(): Promise<() => () => void>
  async getRequestItems(): Promise<RequestItem[] | undefined>
}

type FeedControllerOptions = FeedCompilerOptions & {
  feed: Feed
  tracker?: Tracker
  onEvent?: (event: TrustedEvent) => void
  onExhausted?: () => void
  useWindowing?: boolean
}
```

### Routing (`FeedRouter`)

The caller supplies relay routing through the `FeedRouter` interface.

```typescript
import type {RelaySelection, RelayScenario} from '@welshman/util'

export interface FeedRouter {
  resolve(selections: RelaySelection[]): Promise<RelayScenario>
}

// Decide which relays serve which filters under the outbox model
getFilterSelections(filters: Filter[], router: FeedRouter): Promise<RelaysAndFilters[]>
// RelaysAndFilters = {relays: string[]; filters: Filter[]}
```

`getFilterSelections` applies one rule per outbox source: a `search` filter goes to `searchRelays(10)`; a gift-wrap filter with no `authors` goes to `userMessaging()`; a filter with `authors` is chunked and sent to each author's `outbox()`; and everything additionally gets a low-weight `userInbox(0.2)` pass. Each group resolves with `addMinimalFallbacks`. The groups overlap by relay, so `requestPage` unions their filters per relay and opens one subscription each; chunking keeps one filter's `authors` array small, which is a separate concern from how many frames reach one relay.

`@welshman/app`'s `Router` plugin implements `FeedRouter`. The `RelaySelection` DSL is documented in the `welshman-util` skill.

### Display & validation helpers

`display*` functions render a feed definition as human-readable text. `displayFeed(feed)` dispatches on type, with `displayAuthorFeed`, `displayKindFeed`, `displayScopeFeed`, `displayTagFeed`, … underneath, plus `displayFeeds(feeds)` for a list.

`validate*` functions return a `ValidationError` (re-exported from `trava`) for a malformed feed tuple, and the feed itself otherwise. `validateFeed(feed)` dispatches on type, with `validateAuthorFeed`, `validateDVMFeed`, `validateFeedArgs`, `validateTagFeedMapping`, … underneath. Check anything decoded from a kind-31890 event with `validateFeed(feed) instanceof ValidationError` before compiling it.

## Common Patterns

### 1. Simple author + kind feed

```typescript
import { FeedController, makeIntersectionFeed, makeAuthorFeed, makeKindFeed } from '@welshman/feeds'
import { Scope } from '@welshman/feeds'

const controller = new FeedController({
  router,                                   // a FeedRouter — e.g. app.use(Router)
  feed: makeIntersectionFeed(
    makeAuthorFeed("pubkey1", "pubkey2"),
    makeKindFeed(1),
  ),
  getPubkeysForScope: (scope) => [],
  getPubkeysForWOTRange: (min, max) => [],
  onEvent: (event) => console.log(event.id),
  onExhausted: () => console.log('done'),
})

await controller.load(50)
```

### 2. Follows feed with WOT filtering

```typescript
import {
  FeedController, makeIntersectionFeed, makeScopeFeed,
  makeWOTFeed, makeKindFeed, Scope
} from '@welshman/feeds'

const controller = new FeedController({
  router,
  feed: makeIntersectionFeed(
    makeScopeFeed(Scope.Follows),
    makeWOTFeed({ min: 0.1 }),
    makeKindFeed(1, 6, 7),
  ),
  getPubkeysForScope: (scope) => {
    if (scope === Scope.Follows) return myFollowList
    return []
  },
  getPubkeysForWOTRange: (min, max) => wotIndex.getPubkeys(min, max),
  onEvent: handleEvent,
  onExhausted: markExhausted,
  useWindowing: true,
})

await controller.load(20)
```

### 3. DVM-powered algorithmic feed

```typescript
import {
  FeedController, makeIntersectionFeed, makeDVMFeed,
  makeWOTFeed, FeedType
} from '@welshman/feeds'

// DVMItem.mappings controls how DVM result tags become sub-feeds
const controller = new FeedController({
  router,
  feed: makeIntersectionFeed(
    makeDVMFeed({
      kind: 5300,
      tags: [['p', 'dvm-pubkey-hex']],
      mappings: [['p', [FeedType.Author]]],
    }),
    makeWOTFeed({ min: 0.05 }),
  ),
  getPubkeysForScope: () => [],
  getPubkeysForWOTRange: (min, max) => wotPubkeys,
  onEvent: handleEvent,
})
await controller.load(30)
```

### 4. List-based feed (NIP-51 list)

```typescript
import { FeedController, makeListFeed, makeKindFeed, makeUnionFeed, FeedType } from '@welshman/feeds'

const controller = new FeedController({
  router,
  feed: makeUnionFeed(
    makeListFeed({
      addresses: ["10003:pubkey:identifier"],
      // default tag mappings applied unless overridden
    }),
    makeKindFeed(1),
  ),
  getPubkeysForScope: () => [],
  getPubkeysForWOTRange: () => [],
  onEvent: handleEvent,
})
await controller.load(25)
```

### 5. Converting existing filters to a feed

```typescript
import { ago, HOUR } from '@welshman/lib'
import { feedFromFilters, FeedCompiler } from '@welshman/feeds'

const filters = [
  { kinds: [1], authors: ["pubkey1"], since: ago(HOUR) },
  { kinds: [6], "#e": ["event-id"] },
]

const feed = feedFromFilters(filters)

const compiler = new FeedCompiler({
  router,
  getPubkeysForScope: () => [],
  getPubkeysForWOTRange: () => [],
})

const requestItems = await compiler.compile(feed)
// => [{filters: [{kinds:[1], authors:["pubkey1"], since:...}]}, ...]
```

### 6. Traversing a feed tree to inspect contents

```typescript
import { walkFeed, isKindFeed, isAuthorFeed, getFeedArgs } from '@welshman/feeds'

const kinds = new Set<number>()
const authors = new Set<string>()

walkFeed(myFeed, (node) => {
  if (isKindFeed(node)) getFeedArgs(node).forEach(k => kinds.add(k))
  if (isAuthorFeed(node)) getFeedArgs(node).forEach(p => authors.add(p))
})

console.log('Kinds in feed:', [...kinds])
console.log('Authors in feed:', [...authors])
```

## Integration Notes

- **`@welshman/util`** — `Filter`, `TrustedEvent`, and nostr primitives used throughout. `getIdFilters()` is used internally by the compiler for address feeds.
- **`@welshman/signer`** — `ISigner` interface, passed optionally through `FeedCompilerOptions` for DVM requests that require signing.
- **`@welshman/net`** — `FeedController` loads pages through this package's `requestPage` and `countPage`, and `FeedCompiler` runs DVM feeds through `requestDVM`. All three call net's `request`, `count` and `publish` with the `AdapterContext` from `FeedCompilerOptions`.
- **`@welshman/app`** — `app.use(Feeds).makeFeedController({feed, onEvent, …})` supplies `router` (the `Router` plugin), `getPubkeysForScope`/`getPubkeysForWOTRange` (from `Wot`), the user's signer, and the app's `{pool, repository}` context. `Feeds` is also the kind-31890 saved-feed collection.
- **`Tracker`** — From `@welshman/net`. A `Tracker` shared between controllers suppresses events it has already seen.

## Gotchas & Tips

- **`router` is required.** `FeedCompilerOptions.router` has no default, and a `FeedController` or `FeedCompiler` without one fails when it resolves relays. In an app, use `app.use(Feeds).makeFeedController(...)`.
- **`useWindowing: true`** is for relays that may return events out of chronological order. Do not use it for DVM or algorithmic feeds, where order is part of the result.
- **Windowing is calibrated with COUNT.** From the second page on, a windowed loader asks the relays how many events its next window holds (NIP-45, through `countPage`) and scales the window toward a full page, with up to three probes. The first page keeps the window `guessFilterDelta` picked, so no events wait on a count. Relays that do not support COUNT get a window widened after each short page instead.
- **`FeedController.load()` is stateful** — each call continues from where the last left off (pagination). Create a new controller to reset.
- **`canCompile` returns `false` only for `FeedType.Difference`**, and for a `Union` or `Intersection` that contains one. DVM, List and Label feeds compile, fetching their events inside `compile`. `FeedController` runs a separate controller per sub-feed only for a `Difference`, `Union` or `Intersection` that cannot compile.
- **`simplifyFeed`** flattens nested same-type set operations (e.g. `union(union(a,b), c)` → `union(a,b,c)`) and unwraps set operations with a single sub-feed.
- **`makeDifferenceFeed(included, ...excluded)`** — the first argument is the base feed to include; all subsequent feeds define events to exclude.
- **Tag key convention** — tag feeds use `#t`, `#e`, etc. (hash-prefixed) to match Nostr filter syntax. `makeTagFeed("#t", "bitcoin")` produces filter `{"#t": ["bitcoin"]}`.
- **`CreatedAtItem.relative`** — a field listed in `relative` (`"since"` or `"until"`) is an offset in seconds before now rather than a unix timestamp.
- **Intersections** — a compilable intersection becomes intersected filters and relays. One that cannot compile emits only events that every sub-feed returned.
