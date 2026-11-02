---
title: "Nostr Terms Explained"
author: "Jon Staab"
pubDate: 2026-07-14
description: "A plain-language glossary of the Nostr words you'll meet in Flotilla, each explained in a sentence or two with a link to the article that covers it fully."
order: 5
category: basics
---

# Nostr Terms Explained

*Part of our guide to [understanding Nostr](/articles/what-is-nostr).*

Flotilla is built to be usable without knowing anything about Nostr relays or cryptographic keys. Even so, a handful of Nostr-specific words show up in the app and across this knowledge base. Each entry below gives the short answer, then links to the article that explains it in full.

## Space vs. Room

A **Space** is a community — the people and conversation you came for. A **Room** is a channel inside a Space, text or voice, much like a channel in Discord or Slack. See [Spaces and Rooms Explained](/articles/spaces-and-rooms-explained) for the full mental model, including everything a Space can hold beyond chat.

## Relay

A **relay** is the server that stores and serves a Space's messages — think of it as the community's backend. A Space isn't a relay itself; it's a community that's *hosted* on one, whether that relay is self-run with [zooid](/articles/self-hosting-a-space) or [hosted by Flotilla](/articles/hosting-with-flotilla). Flotilla is neither — it's just the app you use to reach whichever relay a Space lives on. See [Spaces and Rooms Explained](/articles/spaces-and-rooms-explained) for how the three fit together.

## Key, npub, and nsec

Your **key** is your Nostr identity — not an account any app can suspend or delete. It comes in two halves: **npub**, your public key, which is safe to share like a username; and **nsec**, your secret key, which you never share with anyone or paste into a site you don't trust. See [Understanding Your Nostr Identity](/articles/understanding-your-nostr-identity) for what that ownership means and how to back your key up safely.

## Signer

A **signer** holds your key and approves sign-in requests on your behalf, so you never have to paste your raw nsec into Flotilla. It can be a browser extension, a mobile app like Amber, or a remote "bunker" signer running elsewhere. See [Ways to Log In to Flotilla](/articles/logging-in-to-flotilla) for every login method Flotilla supports and which ones are safest.

## NIP

A **NIP** — short for *Nostr Implementation Possibility* — is one of the shared specifications that define how Nostr works. Each NIP is a numbered agreement covering a single feature, so independent apps can build the same capability and still work together. You'll see them referenced by number: NIP-05 for a Nostr address, NIP-07 for signing in with a browser extension, and so on. You never need to know any of them to use Flotilla.

## NIP-05 / Nostr Address

A **Nostr address** (also called a NIP-05) is an optional, human-readable identifier for your key. It looks like an email address, e.g. `you@example.com`, and points back to your npub so people can find and verify you more easily. It's separate from the key itself and isn't required to use Flotilla. See [Setting Up Your Profile](/articles/setting-up-your-profile) for where to add one.

## Zap

A **zap** is a Lightning payment — a tip in sats you can send on a message, thread, event, or fundraising goal, instead of a reaction or alongside one. Zaps are optional wherever they appear, and they're turned off entirely in the iOS app because of App Store policy. See [Zaps and Your Wallet](/articles/zaps-and-wallet) for how to send one and how to connect a wallet.

---

If a word you've seen in Flotilla isn't listed here, it's probably specific to one feature rather than the protocol itself. Check the article for that feature directly, or start from [What is Flotilla?](/articles/what-is-flotilla) for the bigger picture.
