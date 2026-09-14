---
name: welshman-feeds
description: "Use this skill when working with @welshman/feeds: building nostr feeds, FeedController, FeedCompiler, feed definitions, dynamic filtering, or composing feed sources."
---

# welshman/feeds — Dynamic Feed Construction

`@welshman/feeds` provides a declarative, composable system for defining and executing Nostr event feeds. You describe what you want (authors, kinds, tags, set operations) as a data structure, and the package compiles it into optimized relay requests and handles pagination, deduplication, and exhaustion. It sits on top of `@welshman/net` for relay communication and `@welshman/util` for types.

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

All feed definitions are typed tuples. Always use factories rather than raw arrays.

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
  async getListener(): Promise<() => Promise<void>>
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

`@welshman/feeds` has no way to turn a pubkey into relay urls, so it declares the capability as an interface and the caller supplies it.

```typescript
import type {RelaySelection, RelayScenario} from '@welshman/util'

export interface FeedRouter {
  resolve(selections: RelaySelection[]): Promise<RelayScenario>
}

// Decide which relays serve which filters under the outbox model
getFilterSelections(filters: Filter[], router: FeedRouter): Promise<RelaysAndFilters[]>
// RelaysAndFilters = {relays: string[]; filters: Filter[]}
```

`getFilterSelections` applies one rule per outbox source: a `search` filter goes to `searchRelays(10)`; a gift-wrap filter with no `authors` goes to `userMessaging()`; a filter with `authors` is chunked and sent to each author's `outbox()`; and everything additionally gets a low-weight `userInbox(0.2)` pass. Each group resolves with `addMinimalFallbacks`.

`@welshman/app`'s `Router` plugin implements `FeedRouter`, and `app.use(Feeds).makeFeedController(...)` supplies it (along with `getPubkeysForScope`, `getPubkeysForWOTRange`, the signer, and the app's net context) so you only pass `feed` and your callbacks. The `RelaySelection` DSL itself is documented in the `welshman-util` skill.

### Display & validation helpers

`display*` functions render a feed definition as human-readable text — `displayFeed(feed)` dispatches on type, with `displayAuthorFeed`, `displayKindFeed`, `displayScopeFeed`, `displayTagFeed`, … underneath, plus `displayFeeds(feeds)` for a list.

`validate*` functions throw on a malformed feed tuple — `validateFeed(feed)` dispatches, with `validateAuthorFeed`, `validateDVMFeed`, `validateFeedArgs`, `validateTagFeedMapping`, … underneath. Run `validateFeed` on anything decoded from a kind-31890 event before compiling it.

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
- **`@welshman/net`** — The `FeedController` delegates to `requestPage` for relay communication. The `FeedCompiler` delegates to `requestDVM` for DVM-based feeds. Neither accepts `request` or `requestDVM` as constructor options. `AdapterContext` from net is passed through `FeedCompilerOptions`.
- **`@welshman/app`** — `app.use(Feeds).makeFeedController({feed, onEvent, …})` supplies `router` (the `Router` plugin), `getPubkeysForScope`/`getPubkeysForWOTRange` (from `Wot`), the user's signer, and the app's `{pool, repository}` context. `Feeds` is also the kind-31890 saved-feed collection.
- **`Tracker`** — Optional deduplication helper (from `@welshman/net` or app layer). Pass a shared `Tracker` instance to avoid re-emitting events seen in other controllers.

## Gotchas & Tips

- **`router` is required.** `FeedCompilerOptions.router` has no default; a `FeedController` or `FeedCompiler` constructed without one will fail when it tries to resolve relays. In an app, go through `app.use(Feeds).makeFeedController(...)`.

- **Always use factory functions** (`makeAuthorFeed`, etc.) rather than constructing raw tuples — the tuple structure is internal and type safety depends on using factories.
- **`useWindowing: true`** is for relays that may return events out of chronological order. Do not use it for DVM/algorithmic feeds where order is part of the result.
- **`FeedController.load()` is stateful** — each call continues from where the last left off (pagination). Create a new controller to reset.
- **`canCompile` returns `false` only for `FeedType.Difference`** (and recursively for `Union`/`Intersection` whose sub-feeds include a `Difference`). DVM and List feeds return `true` from `canCompile` and are compiled asynchronously by `_compileDvms` and `_compileLists` inside the compiler's `compile` method. The feeds handled specially by `FeedController` (outside the compiled request flow) are `Difference`, `Union`, and `Intersection` — but only when `canCompile` returns `false` for them.
- **`simplifyFeed`** flattens nested same-type set operations (e.g. `union(union(a,b), c)` → `union(a,b,c)`). Run it before storing or serializing feed definitions.
- **`makeDifferenceFeed(included, ...excluded)`** — the first argument is the base feed to include; all subsequent feeds define events to exclude.
- **Tag key convention** — tag feeds use `#t`, `#e`, etc. (hash-prefixed) to match Nostr filter syntax. `makeTagFeed("#t", "bitcoin")` produces filter `{"#t": ["bitcoin"]}`.
- **`CreatedAtItem.relative`** — when set to `["since"]` or `["until"]`, the compiler treats those timestamps as relative offsets from the current time rather than absolute unix timestamps.
- **Intersection of feeds is AND logic across relay results** — an event must appear in responses from ALL sub-feeds to be emitted. This can significantly reduce result counts vs. a union.
