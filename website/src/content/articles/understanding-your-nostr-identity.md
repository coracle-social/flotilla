---
title: "Understanding Your Nostr Identity"
author: "Jon Staab"
pubDate: 2026-07-14
description: "What a Nostr key actually is, why it means you own your identity instead of renting an account, how to back it up, and how to get back in on a new device."
order: 4
category: basics
---

# Understanding Your Nostr Identity

*Part of our guide to [understanding Nostr](/articles/what-is-nostr).*

If you signed up for Flotilla using [Getting Started](/articles/getting-started), you already have a Nostr key. This article covers what that key is, how to back it up, and how to get back into your account later.

## An identity you own, not an account you rent

Most apps work the same way: you sign up, the platform creates an account, and that account exists at the platform's discretion. If the platform suspends you, deletes the account, or shuts down, your identity — your posts, your follows, your reputation — goes with it.

Nostr flips this around. Instead of an account, you have a **key pair**: a cryptographic identity you generate yourself, one that no platform controls. Flotilla doesn't issue your identity; it just lets you use one. That's why neither Flotilla nor any space you join can deplatform you off your own identity. You can always take your key and go elsewhere.

## Public key vs. secret key

Your key pair has two halves, and mixing them up is the most dangerous mistake a newcomer can make:

- **npub** is your *public* key. It works like a username or handle, so share it freely: put it in a bio, hand it to someone starting a direct message, post it anywhere. Other people and apps use your npub to find you and to confirm a message came from you.
- **nsec** is your *secret* key. It works like a password, except no one can reset it for you. Anyone who has your nsec can post as you and read everything you can read. Never send it to anyone, store it in plain text somewhere public, or paste it into a site you don't trust. Treat a site that asks you to "log in" by pasting your nsec as a red flag.

## One identity, every app

Your key isn't tied to Flotilla, or to any other app. The same npub and nsec work across every Nostr client, and if you already had a key from another app, you could have logged into Flotilla with it instead of creating a new one. Your profile, your follows, and your content travel with your key wherever you go. See [Ways to Log In to Flotilla](/articles/logging-in-to-flotilla) for the different ways to bring an existing key in, or to use a signer instead of pasting the raw key at all.

## Keeping your key safe

There's no "forgot password" link for a Nostr key, so backing it up properly matters more than it would for a normal account. When you create a key in Flotilla, you can download it as:

- An **encrypted backup (ncryptsec)**, protected by a password you choose — the safer option, since the file alone isn't enough to compromise your key.
- A **plaintext nsec** — usable right away, but sensitive: anyone who gets the file gets your identity.

Either way, store the download somewhere durable and private, like a password manager, rather than leaving it in a downloads folder or sending it to yourself over chat.

No support team can reset your key for you. If you lose it, because the device it lived on breaks or you never backed it up, you lose that identity for good, along with every space, follow, and message tied to it. If someone else gets your nsec, they can act as you until you notice and switch to a new key.

## Getting back in on a new device

Your key doesn't sync between devices the way a browser bookmark might. To sign in somewhere new, either bring your backed-up key with you or use the extension, mobile signer, or bunker you already have set up elsewhere — see [Ways to Log In to Flotilla](/articles/logging-in-to-flotilla) for how each one works.

A new device isn't a blank slate, though. Your spaces, rooms, and messages live on the relays that host them rather than on any one device, so they're there the moment you sign in. Flotilla also syncs some read state across devices, like which messages you've already seen.

## Finding your key again in Settings

If you signed up by generating or pasting a raw key, Settings > Profile shows a masked **Private Key** field with a copy button, so you can grab your nsec again without digging up your original backup. It's copy-only, with no re-download button, so paste it straight into a password manager rather than leaving it on your clipboard.

That field only appears if Flotilla holds your raw key. If you log in with a browser extension, a mobile signer, a remote bunker, or an email account, your key never touches Flotilla, so there's nothing to show.

## An easier on-ramp: email login

If managing a raw key doesn't feel right yet, Flotilla also lets you sign up with just an email address, through a service called Pomade. Under the hood you still get a Nostr identity, but your key is split across multiple servers for social recovery rather than resting entirely on a file only you hold.

Email accounts also recover differently. No single party holds the whole key, so there's no file to lose. Settings > Profile offers an **Update your password** option and a **Start holding your own keys** option that moves you to a self-custodied key when you're ready. That move is a recovery flow rather than a straight download: it reassembles your key from its pieces, emails you confirmation codes, and has you paste them back before it completes. The same screen lists your active device sessions and lets you end any you don't recognize. You can read more about the tradeoffs of each login method in [Ways to Log In to Flotilla](/articles/logging-in-to-flotilla).

## Your profile isn't your key

Your key is your identity. Your profile — display name, bio, avatar, website, and an optional NIP-05 Nostr address that makes your npub easier to read — is data attached to that identity, and you can change it at any time from Flotilla's settings without touching your key.
