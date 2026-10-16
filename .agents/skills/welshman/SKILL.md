---
name: welshman
description: "Use this skill for general welshman questions: architecture overview, which package to use, getting started, nostr concepts, or when you're unsure which sub-skill applies. Welshman is a modular TypeScript nostr toolkit for building client applications."
---

## What is welshman

Welshman is a modular TypeScript nostr toolkit for building configurable client applications. It was extracted from the [Coracle](https://coracle.social) nostr client and powers both Coracle and [Flotilla](https://flotilla.social). Its packages are opt-in, from single utilities up to a full application framework.

## Package map

| Package | Description |
|---|---|
| `@welshman/util` | Core nostr types, event helpers, filters, NIP implementations, and the relay-selection routing DSL |
| `@welshman/lib` | General-purpose utilities: LRU cache, event emitter, deferred promises, task queue |
| `@welshman/net` | Relay connections, request/publish lifecycle, auth, and the `Repository`/`Tracker`/`WrapManager` stores |
| `@welshman/store` | Svelte store primitives over a `Repository` — live event and domain-object collections, cached loaders, persistence |
| `@welshman/signer` | Signing and login methods: NIP-01 (privkey), NIP-07 (extension), NIP-46 (bunker), NIP-55 (app), NIP-59 (gift wrap) |
| `@welshman/domain` | Typed Reader/Writer classes per event kind (profiles, notes, lists, rooms, relay management) that parse events, build templates, and emit relay routing |
| `@welshman/feeds` | Dynamic feed construction, filtering, and composition |
| `@welshman/app` | Instance-based application framework: an `App` composes net, store, signer, feeds, and domain, exposing data modules via `app.use(...)` |
| `@welshman/content` | Parser and renderer for nostr note content (links, mentions, media, custom formatting) |
| `@welshman/editor` | Tiptap-based rich-text editor with mention and embed support |

## Dependency layering

Each package depends only on packages above it in this list:

- `@welshman/lib` has no welshman dependencies, and `@welshman/util` depends on it
- `@welshman/net` depends on `lib` and `util`
- `@welshman/store` and `@welshman/signer` depend on `net`
- `@welshman/feeds` depends on `signer`, and `@welshman/domain` depends on `feeds`
- `@welshman/app` depends on all of the above
- `@welshman/content` has no welshman dependencies, and `@welshman/editor` depends only on `lib` and `util`

For deep-dives on any package, load the `welshman-<name>` skill (e.g. `welshman-net`, `welshman-app`, `welshman-domain`, `welshman-signer`).

Relay selection spans two packages. The `RelaySelection` DSL, `Resolver` and `RelayScenario` are in `@welshman/util` (`welshman-util` skill); the `Router` plugin that dereferences them is in `@welshman/app` (`welshman-app` skill).

## Getting started

Install only what you need:

```bash
# Full application framework, for a conventional client
npm i @welshman/app

# Lower-level packages, for assembling a client by hand
npm i @welshman/util @welshman/net @welshman/signer
```

## Key nostr concepts

- **event** — the fundamental data unit in nostr; a JSON object signed by a keypair
- **kind** — integer field on an event that determines its type (e.g. kind 1 = short text note, kind 0 = profile metadata)
- **filter** — a query object (`{kinds, authors, since, until, limit, ...}`) sent to relays to request matching events
- **relay** — a WebSocket server that stores and forwards nostr events; clients connect to multiple relays
- **NIP** — "Nostr Implementation Possibility"; numbered specifications defining protocol behavior and event kinds
- **pubkey** — 32-byte hex public key that identifies a nostr user
- **signer** — abstraction over key management; handles signing events and optionally encryption, regardless of where the private key lives (in-memory, browser extension, remote bunker, mobile app)

## Common use-case routing

| Goal | Package(s) to use |
|---|---|
| Fetch notes from relays | `@welshman/net` (low-level) or `@welshman/app` (high-level) |
| Compose typed events (notes, profiles, lists) | `@welshman/domain` |
| Select which relays to read from / publish to | `@welshman/util` (routing DSL) + `@welshman/app` (Router plugin) |
| Sign and publish events | `@welshman/domain` + `@welshman/app`, or `@welshman/signer` + `@welshman/net` |
| Build a feed UI | `@welshman/feeds` + `@welshman/app` |
| Parse note text and media | `@welshman/content` |
| Embed a composer / editor | `@welshman/editor` |
| Cache nostr events client-side | `@welshman/net` (`Repository`) + `@welshman/store` (reactive views over it) |
| Core event/filter utilities | `@welshman/util` |
| Low-level helpers (LRU, emitter, utility functions) | `@welshman/lib` |

### App Example

```typescript
import { Nip07Signer } from "@welshman/signer"
import { Note } from "@welshman/domain"
import { createApp, User, Domain, Profiles } from "@welshman/app"

// Each App owns its repository, socket pool, tracker, and signing user
const user = await User.fromSigner(new Nip07Signer())

const app = createApp({
  user,
  config: {
    getDefaultRelays: () => ["wss://relay.example.com", "wss://relay2.example.com"],
    getIndexerRelays: () => ["wss://indexer.example.com"],
  },
})

// Hydrate app.repository from storage here (see the welshman-net skill)

// Fetches via the outbox model unless the profile was loaded recently; forceLoad always fetches
const profile = await app.use(Profiles).load(user.pubkey)
if (profile) console.log("Hello,", profile.display())

// ...or subscribe reactively:
app.use(Profiles).one(user.pubkey).subscribe($profile => {
  if ($profile) console.log("Profile:", $profile.display())
})

// Domain builds the event and resolves its relays; the Command publishes it
const writer = app.use(Domain).writer(Note).setContent("Hello, Nostr!")
const command = await app.use(Domain).command(writer)

await command.publish()
```

### Lower-level Example

```typescript
import { AbstractAdapter, ClientMessage, isClientEvent, publish, request } from '@welshman/net'
import type { NetContext } from '@welshman/net'
import { call, sleep } from '@welshman/lib'
import { Nip01Signer } from '@welshman/signer'
import { makeEvent, NOTE } from '@welshman/util'

const pingSigner = Nip01Signer.fromSecret(/* nostr hex secret key */)
const pongSigner = Nip01Signer.fromSecret(/* nostr hex secret key */)
const RELAY_URL = "bogus.relay"

// Create an adapter for our relay url which just prints the content
export class PrintAdapter extends AbstractAdapter {
  get sockets() { return [] }
  get urls() { return [] }
  send = (message: ClientMessage) => {
    if (isClientEvent(message)) {
      const [_, event] = message
      console.log(event.content)
    }
  }
}

// A net context that routes our relay url to the custom adapter
const context: NetContext = {
  getAdapter: (url: string) => {
    if (url === RELAY_URL) {
      return new PrintAdapter()
    }
  },
}

// Loop, sending off pings every so often
call(async () => {
  while (true) {
    await sleep(1000)

    const ping = await pingSigner.sign(
      makeEvent(NOTE, {content: 'ping'})
    )

    await publish({event: ping, relays: [RELAY_URL], context})
  }
})

// Meanwhile, listen for pings and quote-note with a pong
call(async () => {
  request({
    relays: [RELAY_URL],
    context,
    filters: [{kinds: [NOTE], authors: [await pingSigner.getPubkey()]}],
    onEvent: async (ping, url) => {
      const pong = await pongSigner.sign(
        makeEvent(NOTE, {content: 'pong', tags: [["q", ping.id, RELAY_URL, ping.pubkey]]})
      )

      await publish({event: pong, relays: [RELAY_URL], context})
    },
  })
})
```
