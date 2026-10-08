---
title: "What Is Nostr? A Plain-English Guide"
author: "Jon Staab"
pubDate: 2026-07-14
description: "A jargon-free introduction to Nostr: what it is, why it matters, and how it lets you own your identity and community online."
order: 0.5
category: basics
---

# What Is Nostr? A Plain-English Guide

You've probably run into the word "Nostr" and bounced straight off a wall of jargon. Here's what Nostr is in plain English, why people care about it, and how it lets you own your identity and your community online.

## What is Nostr, really?

Nostr is a set of shared rules for sending messages across the internet, a bit like email. With email, it doesn't matter that you use Gmail and a friend uses a different provider; you can still write to each other because everyone agrees on how mail moves around. Nostr works the same way, but for social apps and community chat. It's a common standard that lots of different apps can speak, rather than a single website or company you sign up with.

The problem it solves is ownership. On most platforms, your account belongs to the company running it, and they can suspend it, change the rules, or shut down and take your posts and contacts with them. On Nostr, your identity is a **key**. Your key has a public half you can share freely, like a username, and a secret half you keep to yourself. Because you hold it, no single app or server can lock you out or erase you.

The messages themselves live on **relays** — servers that store and pass along posts, the way a post office receives and forwards mail. Different communities can use different relays, and since your key is yours, you can move between apps or communities without losing your identity, your posts, or the people you know. Flotilla is one app built on Nostr, designed so you can use it without knowing any of this.

**Learn more:**
- [Nostr Terms Explained](/articles/nostr-terms-explained)
- [What is Flotilla?](/articles/what-is-flotilla)

## Your identity is yours to keep

Your key comes in two halves. The first is your **npub**, which works like a username: it's the public half, so you can share it with anyone who wants to find or follow you. The second is your **nsec**, which works like a password — except no one can reset it for you. Because your key isn't tied to any single app, the same identity carries your profile, your follows, and your posts across every Nostr app you use. Flotilla doesn't own your identity; you bring your own, so neither Flotilla nor any community you join can deplatform you off it.

There's no "forgot password" link, so keeping your key safe is up to you. When you sign up, save your key somewhere durable and private, like a password manager rather than a downloads folder or a note to yourself. Anyone who gets your nsec can act as you, and if you lose it with no backup, that identity is gone for good.

**Learn more:**
- [Understanding Your Nostr Identity](/articles/understanding-your-nostr-identity)

## How communities and apps work on it

A community on Nostr lives on a **relay**. Someone runs each relay, often the community's own organizer. In Flotilla, a community is called a **Space**, and is hosted on a relay that someone chose to run, whether that's a machine they set up themselves or a managed hosting plan.

The community and the app are two separate things, which is where this differs from Discord or Slack. Flotilla is just the app you use to open a window into a Space; the Space itself exists on its relay whether or not you use Flotilla to look at it. Inside a Space, conversation happens in **Rooms**, which are channels like `#general` or `#support`.

Because the network is open, many different apps can read from and write to the same relays, and your key works in all of them. If you opened the same community in a different Nostr app, or an organizer moved a Space to a different relay, the community itself wouldn't change — only your view of it would. You never have to make a separate account for each community you join.

If you're thinking about starting a community of your own, our companion guide on [how to run an online community](/articles/how-to-run-an-online-community) picks up from here.

**Learn more:**
- [Spaces and Rooms Explained](/articles/spaces-and-rooms-explained)
- [What is Flotilla?](/articles/what-is-flotilla)

## What you can do with it

You can send private messages to one person or a small group, without needing to share a community with them first. All you need is their npub, which works a bit like a phone number for reaching someone directly. These conversations are end-to-end encrypted, meaning the words are scrambled in transit so only you and the people in the chat can read them — not the servers passing them along.

You can also send money as easily as a reaction. A "zap" is a small tip paid in **sats** — satoshis, which are tiny fractions of a bitcoin. Instead of just liking something, you can attach a bit of real value to a message, a post, an event, or a community fundraising goal. You can connect a wallet to make it one tap, or just scan a code to pay from whatever wallet app you already use.

Some Rooms are live voice rooms, with video and screen sharing once you're in, which is closer to hopping on a call than typing back and forth. You pick your microphone, mute and unmute, turn your camera on, and share your screen. A small call widget stays with you so you can keep browsing while you talk.

**Learn more:**
- [Direct Messages](/articles/direct-messages)
- [Zaps and Your Wallet](/articles/zaps-and-wallet)
- [Using Voice and Video Calls](/articles/using-voice-and-video-calls)

## Try it in five minutes

The fastest way to understand Nostr is to use something built on it. Flotilla is a group chat app that runs on the Nostr network. There's nothing to install to get started: open [app.flotilla.social](https://app.flotilla.social) in any web browser, on your phone or your computer, and you're already there.

When you arrive, you can either log in or sign up. If you already have a Nostr key from another app, log in with that. If you're new, choose sign up and Flotilla will create a key for you, store it in your browser, and then offer you a copy to save somewhere safe, like a password manager.

Once you have your key, you can explore one of the [hundreds of Nostr applications](https://nostrapps.com/) and log in with the **same identity**! For a shorter, hand-picked list, see the [tools and apps we recommend](/ecosystem).

If keys sound like more than you want to deal with today, you don't have to touch them. Flotilla also offers "Log in with Email," which works the way you'd expect: an email address and a password, or a one-time code sent to your inbox if you forget it. There's still a real Nostr identity behind the scenes — you're just not the one holding the key file, and you can switch to holding it yourself later.

If you're more advanced, you can use a Nostr app that supports "remote signing", like [Primal](https://play.google.com/store/search?q=primal%20nostr&c=apps&hl=en_US), to log in to other apps on the same device.

**Learn more:**
- [Getting Started](/articles/getting-started)
- [Installing Flotilla on Web and Mobile](/articles/installing-flotilla)
- [Ways to Log In to Flotilla](/articles/logging-in-to-flotilla)
- [Setting Up Your Profile](/articles/setting-up-your-profile)

## Ready to start?

Nostr can sound complicated from the outside, but you don't have to think about it to benefit from it. You own your identity, and no single company sits between you and the people you talk to.

Open [app.flotilla.social](https://app.flotilla.social) to try it for yourself, or take a look at [our plans](/pricing) if you're ready to host a community of your own.
