---
name: welshman-signer
description: "Use this skill when working with @welshman/signer: nostr signing, login methods (NIP-07, NIP-46, NIP-55, NIP-59, NIP-01), ISigner interface, or encrypted events."
---

# welshman/signer — Signing & Login

## Overview

`@welshman/signer` provides a unified `ISigner` interface and concrete implementations for every major nostr signing method: local keypair (NIP-01), browser extension (NIP-07), remote bunker/Nostr Connect (NIP-46), native mobile app via Capacitor (NIP-55), and Gift Wrap encryption (NIP-59). All signers share the same API surface, so callers can swap signing methods without changing application logic. This package depends on `@welshman/util`, `@welshman/lib`, and (for NIP-46) `@welshman/net`. It has no dependency on `@welshman/app`.

## Installation

```bash
npm install @welshman/signer
# or
pnpm add @welshman/signer
yarn add @welshman/signer
```

## Key Exports

### ISigner Interface

The common contract all signers implement.

```typescript
import type {ISigner, SignOptions, EncryptionImplementation} from '@welshman/signer'

interface ISigner {
  sign: SignWithOptions
  nip04: EncryptionImplementation
  nip44: EncryptionImplementation
  getPubkey: () => Promise<string>
  cleanup?: () => Promise<void>
}

type SignOptions = {signal?: AbortSignal}
type Sign = (event: StampedEvent) => Promise<SignedEvent>
type SignWithOptions = (event: StampedEvent, options?: SignOptions) => Promise<SignedEvent>
type Encrypt = (pubkey: string, message: string) => Promise<string>
type Decrypt = (pubkey: string, message: string) => Promise<string>
type EncryptionImplementation = {encrypt: Encrypt; decrypt: Decrypt}
```

### Helpers & wrappers

| Export | Description |
|---|---|
| `decrypt(signer, pubkey, message)` | Picks nip04 or nip44 by sniffing the ciphertext for `?iv=` |
| `nip04` / `nip44` | The raw primitives (`encrypt`/`decrypt` taking an explicit secret; `nip04.detect(m)`; `nip44.getSharedSecret`, LRU-cached) |
| `WrappedSigner` | An `ISigner` that routes every method through a `SignerMethodWrapper`, and an `Emitter`. `@welshman/app` layers decrypt-caching and signer logging onto the user's signer this way, via `User.wrapSigner(wrap)` |
| `SignerMethodWrapper` | `<T>(method: string, thunk: () => Promise<T>, args: unknown[]) => Promise<T>` — `method` is `"sign"`, `"getPubkey"`, `"nip44.decrypt"`, …; `args` lets a wrapper key a cache off the call's arguments |
| `signWithOptions(promise, options)` | Races a signing promise against a 30 s timeout and the caller's `AbortSignal` |

### Nip01Signer (local keypair)

| Export | Description |
|---|---|
| `new Nip01Signer(secret)` | Create from an existing hex private key |
| `Nip01Signer.fromSecret(secret)` | Alias constructor (returns `Nip01Signer`) |
| `Nip01Signer.ephemeral()` | Create with a randomly-generated private key |

### Nip07Signer (browser extension)

| Export | Description |
|---|---|
| `new Nip07Signer()` | Delegates all operations to the browser extension (nos2x, Alby, etc.) |
| `getNip07()` | Returns the `window.nostr` object if present, otherwise `undefined` |

### Nip46Signer (remote / bunker)

| Export | Description |
|---|---|
| `new Nip46Signer(broker)` | ISigner that routes operations through a `Nip46Broker` |
| `new Nip46Broker(params)` | Create a broker directly from `Nip46BrokerParams` |
| `Nip46Broker.parseBunkerUrl(url)` | Parses a `bunker://` URL into `{ signerPubkey, connectSecret, relays }` |
| `Nip46Broker.fromBunkerUrl(url)` | Create a broker directly from a `bunker://` URL |
| `broker.makeNostrconnectUrl(metadata)` | Generates a `nostrconnect://` URL for QR display |
| `broker.waitForNostrconnect(url, signal)` | Resolves when the remote signer approves the connection; `signal` is a required `AbortSignal` |
| `broker.getBunkerUrl()` | Returns a `bunker://` URL for persisting the session |

### Nip55Signer (native mobile)

This package never imports `nostr-signer-capacitor-plugin` — it types the plugin structurally as `Nip55` and the app hands it over. Install it (`npm install nostr-signer-capacitor-plugin`) and register it once at startup:

```ts
import {NostrSignerPlugin} from "nostr-signer-capacitor-plugin"
import {setNip55Plugin} from "@welshman/signer"

setNip55Plugin(NostrSignerPlugin)
```

| Export | Description |
|---|---|
| `setNip55Plugin(plugin)` | Registers the Capacitor plugin. Until called, `Nip55Signer` operations throw `"Nip55 is not enabled"` |
| `getNip55Plugin()` | Returns the registered plugin, or `undefined` |
| `getNip55()` | Returns `Promise<Nip55AppInfo[]>` — installed signing apps, or `[]` when no plugin is registered |
| `new Nip55Signer(packageName, pubkey?)` | Communicates with the specified native app; pass saved pubkey to resume a session |

### Nip59 (Gift Wrap)

| Export | Description |
|---|---|
| `Nip59.fromSigner(signer)` | Create a Gift Wrap helper from any ISigner |
| `Nip59.fromSecret(secret)` | Create directly from a hex private key |
| `new Nip59(signer, wrapper?)` | Explicit constructor; `wrapper` defaults to an ephemeral signer |
| `nip59.wrap(pubkey, template, tags?)` | Encrypt an event for a recipient; returns `Promise<SignedEvent>` — the kind-1059 gift wrap event |
| `nip59.unwrap(event)` | Decrypt a received wrapped event |
| `nip59.withWrapper(wrapper)` | Return a new `Nip59` instance with a different wrapper signer |

## Common Patterns

### Local keypair login

```typescript
import { makeSecret } from '@welshman/util'
import { Nip01Signer } from '@welshman/signer'
import type { ISigner } from '@welshman/signer'

// New random key
const signer: ISigner = Nip01Signer.ephemeral()

// From a stored key
const signer: ISigner = new Nip01Signer(localStorage.getItem('nsec')!)

// With a timeout
const event = makeEvent(1, { content: 'hello' })
const signed = await signer.sign(event, { signal: AbortSignal.timeout(5_000) })
```

### Browser extension login

```typescript
import { getNip07, Nip07Signer } from '@welshman/signer'

function loginWithExtension(): ISigner {
  if (!getNip07()) {
    throw new Error('No NIP-07 extension found. Install nos2x or Alby.')
  }
  return new Nip07Signer()
}

const signer = loginWithExtension()
const pubkey = await signer.getPubkey()
```

### Remote signer (bunker) — first connect

```typescript
import { makeSecret } from '@welshman/util'
import { Nip46Broker, Nip46Signer } from '@welshman/signer'

const broker = new Nip46Broker({
  relays: ['wss://relay.nsec.app'],
  clientSecret: makeSecret(),
})
const signer = new Nip46Signer(broker)

// Show this URL as a QR code or link
const ncUrl = await broker.makeNostrconnectUrl({
  name: 'My App',
  description: 'Connect your nostr key',
})

// Block until the user approves in their bunker app
const abortController = new AbortController()
await broker.waitForNostrconnect(ncUrl, abortController.signal)

// Persist for future sessions
localStorage.setItem('bunkerUrl', broker.getBunkerUrl())

const pubkey = await signer.getPubkey()
```

### Remote signer — reconnect from saved session

```typescript
import { makeSecret } from '@welshman/util'
import { Nip46Broker, Nip46Signer } from '@welshman/signer'

const raw = localStorage.getItem('bunkerUrl')
if (raw) {
  const { signerPubkey, connectSecret, relays } = Nip46Broker.parseBunkerUrl(raw)
  const broker = new Nip46Broker({
    relays,
    clientSecret: makeSecret(),
    signerPubkey,
    connectSecret,
  })
  const signer = new Nip46Signer(broker)
  // Ready to use immediately — no user approval needed
}
```

### Gift Wrap (NIP-59) — send and receive

```typescript
import { Nip01Signer, Nip59 } from '@welshman/signer'
import { makeEvent } from '@welshman/util'

const signer = new Nip01Signer(mySecret)
const nip59 = Nip59.fromSigner(signer)

// Wrap a DM for a recipient
const wrappedEvent = await nip59.wrap(
  recipientPubkey,
  makeEvent(14, { content: 'Secret message', tags: [['p', recipientPubkey]] }),
)
// Publish the kind-1059 gift wrap event to relays
await publishToRelays(wrappedEvent)

// Receive and unwrap
const unwrapped = await nip59.unwrap(receivedKind1059Event)
console.log(unwrapped.content) // 'Secret message'
```

### NIP-44 encryption between two parties

```typescript
import { Nip01Signer } from '@welshman/signer'

const signer = new Nip01Signer(mySecret)
const ciphertext = await signer.nip44.encrypt(theirPubkey, 'hello')
const plaintext = await signer.nip44.decrypt(theirPubkey, ciphertext)
```

## Integration Notes

- **`@welshman/util`** supplies `makeEvent`, `makeSecret`, `StampedEvent`, `SignedEvent`, and nostr kind constants (`NOTE`, `DIRECT_MESSAGE`, etc.) used in all examples above.
- **`@welshman/net`** and **`@welshman/app`** accept an `ISigner` wherever signing is needed (e.g. publishing events). Pass any concrete signer — they are interchangeable.
- **`@welshman/app`** has no `signer` store. An identity is a `User` (`{pubkey, signer}`) hanging off the app: `User.fromSigner(signer)` / `User.fromSession(session)`, then `createApp({user})`. Reach it as `app.user?.signer`, and require it with `User.require(app)`.
- `Nip59` wraps events with an ephemeral `Nip01Signer` by default (per the NIP-59 spec), so callers do not need to supply a wrapper unless they want a custom one.

## Gotchas & Tips

- **`Nip07Signer` is browser-only.** Do not instantiate it in SSR or Node environments; always guard with `getNip07()` first.
- **`Nip55Signer` requires Capacitor.** It will not work in a plain browser build. Only use it in a Capacitor-wrapped mobile app, after calling `setNip55Plugin(NostrSignerPlugin)` and confirming `getNip55()` returns apps. Without the plugin, `getNip55()` returns `[]` rather than throwing, so it doubles as the feature check.
- **`waitForNostrconnect` holds an open subscription.** Always pass an `AbortSignal` (e.g., from `new AbortController().signal`) so you can cancel if the user navigates away.
- **`makeSecret()`** (from `@welshman/util`) generates a cryptographically secure random hex private key. Use it for the `clientSecret` in NIP-46 — never reuse the user's actual private key as the client secret.
- **`nip59.wrap()` returns the gift-wrap `SignedEvent` directly** — the return value itself is the kind-1059 event to publish. There is no `.wrap` sub-property on the return value.
- **Both `nip04` and `nip44` are supported** on all signers. Prefer `nip44` for new code; `nip04` is provided for backwards compatibility with older clients.
- **`sign()` options accept `signal: AbortSignal`** — always set a timeout when signing in a UI flow to avoid hanging indefinitely if the user ignores the extension prompt.
