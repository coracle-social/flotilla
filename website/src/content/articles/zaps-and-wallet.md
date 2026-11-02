---
title: "Zaps and Your Wallet"
author: "Jon Staab"
pubDate: 2026-07-14
description: "Send Lightning tips on messages, events, and community goals, and connect a wallet to Flotilla."
order: 18
category: basics
---

# Zaps and Your Wallet

*Part of our guide to [running an online community you actually own](/articles/how-to-run-an-online-community).*

A "zap" is a Lightning payment — a tip in sats (satoshis, fractions of a bitcoin) that you send straight to someone in response to something they posted. Zaps are a core way Nostr communities show appreciation. You can zap a message in a [room](/articles/chatting-in-a-space), a thread, a calendar event, or a fundraising goal.

## Sending a zap

Wherever zapping is available — a chat message, thread post, event, or goal — you'll find a zap button, usually a lightning-bolt icon. Tap it to send a preset amount with one click, or enter a custom number of sats.

If you don't have a wallet connected to Flotilla yet, zapping still works. Flotilla falls back to showing you a Lightning invoice, either as a QR code you scan with your own wallet app or as text you can copy and pay from anywhere. Connecting a wallet makes it faster, since you skip the scan-and-pay step.

## Connecting a wallet

To send and receive zaps without leaving the app, connect a wallet from your wallet settings. Flotilla supports two ways to do this:

- **Nostr Wallet Connect (NWC)** — pair a remote Lightning wallet by pasting its connection string. This works with any wallet or wallet service that speaks NWC.
- **WebLN** — connect a browser-based Lightning wallet extension.

Once a wallet is connected, your wallet settings page shows your balance, and you can send or receive sats directly.

## Wallet settings

From the same settings page, you can also set up:

- **A Lightning address** — so people can send you sats outside of Flotilla too, from any Lightning wallet.
- **Default preset zap amounts** — the quick-tap amounts on the zap button.

## Zaps are disabled on iOS

Because of App Store policy, Flotilla's iOS build ships with zaps and the wallet turned off entirely. You won't see a zap button on messages, events, or goals, and the wallet item is hidden from settings. The same account zaps fine on the web app, the installed PWA, or Android. To zap from your phone, use the web app or PWA in a mobile browser instead of the native iOS app. See [Installing Flotilla on Web and Mobile](/articles/installing-flotilla) for what's available on each platform.

## Zap-funded goals

Some spaces run **goals** — fundraising targets tied to a specific purpose, with a progress bar that fills up as people zap it. Zapping a goal works like zapping a message: pick a preset or custom amount, and your sats count toward the total. Goals are one of the content types a space can include alongside its rooms; see [Spaces and Rooms Explained](/articles/spaces-and-rooms-explained).
