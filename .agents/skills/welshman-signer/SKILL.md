---
name: welshman-signer
description: "Use this skill when working with @welshman/signer: nostr signing, login methods (NIP-07, NIP-46, NIP-55, NIP-59, NIP-01), ISigner interface, or encrypted events."
---

# welshman/signer — Signing & Login

## Overview

`@welshman/signer` provides a unified `ISigner` interface and concrete implementations for every major nostr signing method: local keypair (NIP-01), browser extension (NIP-07), remote bunker/Nostr Connect (NIP-46), native mobile app via Capacitor (NIP-55), and Gift Wrap encryption (NIP-59). All signers share the same API, so callers can swap signing methods freely. This package depends on `@welshman/util`, `@welshman/lib`, and (for NIP-46) `@welshman/net`. It has no dependency on `@welshman/app`.

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
import type {ISigner, SignerOptions, EncryptionImplementation} from '@welshman/signer'

interface ISigner {
  sign: SignWithOptions
  nip04: EncryptionImplementation
  nip44: EncryptionImplementation
  getPubkey: (options?: SignerOptions) => Promise<string>
  cleanup?: () => Promise<void>
}

type SignerOptions = {signal?: AbortSignal; priority?: number}
type Sign = (event: StampedEvent) => Promise<SignedEvent>
type SignWithOptions = (event: StampedEvent, options?: SignerOptions) => Promise<SignedEvent>
type Encrypt = (pubkey: string, message: string, options?: SignerOptions) => Promise<string>
type Decrypt = (pubkey: string, message: string, options?: SignerOptions) => Promise<string>
type EncryptionImplementation = {encrypt: Encrypt; decrypt: Decrypt}
```

Every method takes the same options, since every one of them is a request to the same signer. `priority` orders the requests that are waiting, highest first and 0 by default, so bulk work behind the user asks for a negative one. `signal` gives up waiting. Neither recalls a request the signer has already started.

### Helpers & wrappers

| Export | Description |
|---|---|
| `decrypt(signer, pubkey, message)` | Picks nip04 or nip44 by sniffing the ciphertext for `?iv=` |
| `nip04` / `nip44` | The raw primitives (`encrypt`/`decrypt` taking an explicit secret; `nip04.detect(m)`; `nip44.getSharedSecret`, LRU-cached) |
| `WrappedSigner` | An `ISigner` that routes every method through a `SignerMethodWrapper`, and an `Emitter`. `@welshman/app` layers decrypt-caching and signer logging onto the user's signer this way, via `User.wrapSigner(wrap)` |
| `SignerMethodWrapper` | `<T>(method: string, thunk: () => Promise<T>, args: unknown[]) => Promise<T>` — `method` is `"sign"`, `"getPubkey"`, `"nip44.decrypt"`, …; `args` lets a wrapper key a cache off the call's arguments |
| `SignerQueue` | One signer's lane: `push(thunk, options)` runs requests one at a time in descending priority order. `Nip07Signer` and `Nip55Signer` each hold one |
| `signerCall(request, options)` | Starts `request` (a thunk) and bounds it by `SIGNER_TIMEOUT` (30 s) and the caller's `AbortSignal`. What `Nip46Signer` uses in place of a queue |

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
| `new Nip46Broker(params)` | Create a broker from `Nip46BrokerParams`: `{relays, clientSecret, connectSecret?, signerPubkey?, algorithm?, context?}` |
| `Nip46Broker.parseBunkerUrl(url)` | Parses a `bunker://` URL into `{ signerPubkey, connectSecret, relays }` |
| `Nip46Broker.fromBunkerUrl(url)` | Create a broker directly from a `bunker://` URL |
| `broker.makeNostrconnectUrl(metadata)` | Generates a `nostrconnect://` URL for QR display |
| `broker.waitForNostrconnect(url, signal)` | Resolves when the remote signer approves the connection; `signal` is a required `AbortSignal` |
| `broker.getBunkerUrl()` | Returns a `bunker://` URL for persisting the session |

### Nip55Signer (native mobile)

This package never imports `nostr-signer-capacitor-plugin`. It types the plugin structurally as `Nip55`, and the app registers it. Install it (`npm install nostr-signer-capacitor-plugin`) and register it once at startup:

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
| `nip59.unwrap(event, options?)` | Decrypt a received wrapped event; `options` go to each of its two decryptions |
| `nip59.withWrapper(wrapper)` | Return a new `Nip59` instance with a different wrapper signer |
| `InvalidWrapError` | Thrown by `unwrap` for a wrap that does not check out, as opposed to a signer that did not answer |

## Common Patterns

### Local keypair login

```typescript
import { makeEvent } from '@welshman/util'
import { Nip01Signer } from '@welshman/signer'
import type { ISigner } from '@welshman/signer'

// New random key
const ephemeralSigner: ISigner = Nip01Signer.ephemeral()

// From a stored hex key
const signer: ISigner = new Nip01Signer(localStorage.getItem('secret')!)

const signed = await signer.sign(makeEvent(1, { content: 'hello' }))
```

### Browser extension login

```typescript
import { getNip07, Nip07Signer } from '@welshman/signer'
import type { ISigner } from '@welshman/signer'

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
- **`@welshman/net`** takes a plain `sign` function for NIP-42 auth (`makeSocketPolicyAuth({sign: e => signer.sign(e)})`).
- **`@welshman/app`** holds the signer on a `User` (`{pubkey, signer}`) attached to the app: `User.fromSigner(signer)` / `User.fromSession(session)`, then `createApp({user})`. Reach it as `app.user?.signer`, and require it with `User.require(app)`.

## Gotchas & Tips

- **`Nip07Signer` is browser-only.** Do not instantiate it in SSR or Node environments; always guard with `getNip07()` first.
- **`Nip55Signer` requires Capacitor.** Use it only in a Capacitor app, after calling `setNip55Plugin(NostrSignerPlugin)`. Without the plugin `getNip55()` returns `[]` rather than throwing, so it doubles as the feature check.
- **`waitForNostrconnect` holds an open subscription** until the signer answers or its required `AbortSignal` fires. Abort it if the user navigates away.
- **A wrap that needs proof of work is mined by its wrapper.** `Nip59` knows nothing about NIP-13; pass your own wrapper with `withWrapper`, then `wrapper.sign(await minePow(wrap, difficulty))` on what comes back. Mining changes the id, so only the key that signed the wrap can sign it again, and the ephemeral wrapper `Nip59` creates by default is not kept.
- **`makeSecret()`** (from `@welshman/util`) generates a random hex private key. Use it for the NIP-46 `clientSecret`, and never reuse the user's own private key there.
- **Both `nip04` and `nip44` are supported** on all signers. Prefer `nip44` for new code; `nip04` is provided for backwards compatibility with older clients.
- **Every request gives up after `SIGNER_TIMEOUT`**, 30 seconds, except on `Nip01Signer`, which holds the key and cannot hang. Pass a `signal` for a shorter limit or to cancel from the UI, and a negative `priority` for work the user is not waiting on.
- **A signer answers one request at a time**, so a priority reorders what is still waiting rather than what the signer is already working on — a signature still waits out one decryption in front of it.
- **`Nip59.unwrap` remembers a verdict, not a signer failure.** An `InvalidWrapError` is cached under the wrap's id and rethrown forever; anything the signer threw reaches the signer again on the next call.
