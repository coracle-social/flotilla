---
title: "Ways to Log In to Flotilla"
author: "Jon Staab"
pubDate: 2026-07-14
description: "Every way to sign in to Flotilla — browser extension, mobile signer, remote bunker, email, or a raw key — and which is safest."
order: 6
category: basics
---

# Ways to Log In to Flotilla

*Part of our guide to [running an online community you actually own](/articles/how-to-run-an-online-community).*

Flotilla has no username-and-password account. Instead, you prove who you are with a Nostr key (see [Understanding Your Nostr Identity](/articles/understanding-your-nostr-identity) if you haven't already). The login screen offers several ways to bring that key in, and they aren't equally safe.

## Brand new to Nostr? Generate a key

If you don't have a key yet, click "Register instead" on the login screen to generate one. Flotilla creates the key, stores it in your browser, and lets you download a backup before you finish. It's the simplest first-time path, and it's covered step by step in [Getting Started](/articles/getting-started).

## Log in with a browser extension (NIP-07)

If you have a Nostr signer extension installed in your browser, Flotilla detects it automatically and shows a "Log in with Extension" button. Your secret key never leaves the extension. Flotilla asks it to sign things, and the extension does the signing itself. On a desktop browser, this is the most convenient safe option.

## Log in with a mobile signer app (NIP-55)

On Android, Flotilla can hand signing off to a separate signer app, such as Amber. If a compatible app is installed, it shows up as its own "Log in with [app name]" button. Like a browser extension, the signer app holds your key and approves each request one at a time, so Flotilla itself never sees it.

## Log in with a remote signer / bunker (NIP-46)

"Log in with Remote Signer" connects to a signer running somewhere else — another device, or a hosted signing service — using a Nostr Connect ("bunker") link. There are a few ways to complete the connection:

- Paste a `bunker://` link directly into the field.
- Click "Log in with a QR code instead" to have Flotilla generate a code, then scan it with your signer app on another device.
- On iOS, tap "Open in Signer" to hand off to a signer app installed on the same device via a deep link.

As with an extension or mobile signer, your key stays on the signer's side of the connection the whole time.

## Log in by pasting a key

"Log in with Key" accepts an `nsec`, a raw 64-character hex private key, or a password-protected `ncryptsec` (which prompts for the password before decrypting). It's the most direct option, and the screen warns that pasting a raw key isn't best practice and suggests a signer app instead. Treat it as a last resort, and never paste your key into a site you don't fully trust.

## Log in with email

If email login is enabled, "Log in with Email" gets you in with a familiar email-and-password flow, with no key to manage directly. If you forget your password, "Log in with a one-time access code" emails you a fresh code instead. Under the hood you still have a real Nostr identity; it's just backed by social key recovery rather than a file you hold yourself. [Understanding Your Nostr Identity](/articles/understanding-your-nostr-identity) covers how that recovery model works and what it trades away.

## Which one should you use?

An extension, a mobile signer, or a remote bunker all keep your secret key out of Flotilla entirely, since the app only ever sees a signed result, never the key. That makes any of the three meaningfully safer than pasting your key directly into the app. Email login is less cryptographically self-sovereign, and a gentler place to start if you're not ready to think about keys yet.

Whichever you choose, the identity underneath is the same. Log out and back in with a different method later, and you'll land in the same profile, the same spaces, and the same rooms.

## One login for everything

Signing in to Flotilla signs you in to everything tied to that key. If you pay to [host a space](/articles/hosting-with-flotilla), its settings and billing live in the app under the same account, with no second login to keep track of.
