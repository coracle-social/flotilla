---
title: "Privacy Settings: Limiting What You Leak"
author: "Jon Staab"
pubDate: 2026-07-14
description: "Walk through Flotilla's privacy controls: relay auto-authentication, error/usage reporting opt-out, your media server choice, and why link previews and remote media can expose your IP."
order: 20
category: basics
---

# Privacy Settings: Limiting What You Leak

*Part of our guide to [running an online community you actually own](/articles/how-to-run-an-online-community).*

[Is Flotilla Private?](/articles/is-flotilla-private) covers what "private" means for your published content and messages. This article covers the controls in Flotilla that keep you from leaking to relays and third parties without meaning to.

## Where to find them

Most of these live under **Settings → Privacy**. A few related controls that affect the same kind of leakage sit under **Settings → Content** instead; those are noted below.

## Relay auto-authentication

Some relays challenge clients to prove who they are before serving certain content, which is how a relay tells your key apart from an anonymous reader. Flotilla always does this for the relays in your own relay lists, since it has to identify itself there anyway. That leaves the relays you haven't added: an unknown relay you happen to read from because a link or a space pointed you at it.

The **"Authenticate with unknown relays?"** toggle controls that. By default it's **Conservative** (off): Flotilla withholds your identity from relays that aren't in your configured lists, so browsing an unfamiliar relay doesn't tell its operator who you are. Turn it on and it switches to **Aggressive**, authenticating freely with any relay that asks.

Turn it on only if you keep hitting relays that refuse to serve content until you authenticate, and you're comfortable with them knowing your key.

## What loading a preview reveals

Showing a link preview, or an image or video embedded in a message, means Flotilla makes an HTTP request to whatever server hosts that content. That server, which could be anyone's, sees the request and the IP address it came from.

The Privacy page has no setting for this. The control is the **"Show media?"** toggle under **Settings → Content**, which turns off link previews and inline image/video rendering entirely. Opening a chat and scrolling past a shared link is the everyday habit most likely to hand your IP to a server you never chose to talk to. See [Customizing How Flotilla Looks and Feels](/articles/customizing-how-flotilla-looks) for the full rundown of that toggle and the other display settings.

## Choosing your media server

Also under **Settings → Content**, the **"Media Server"** field lists the Blossom-compatible server (or servers) your own uploads go to when you attach a file or image to a message. This is about where content *you* upload ends up, separate from the preview question above. You can list more than one server for redundancy.

## Opting out of error and usage reporting

The Privacy page has two more toggles: **"Report errors?"** and **"Report usage?"**. Both let Flotilla send data back to help diagnose problems and understand how the app is used. Neither is needed for Flotilla to work, so if you'd rather send nothing, switch them off.

## What's covered elsewhere

Muting someone stops their messages from showing up for you without changing what you expose — see [Notifications and Muting](/articles/notifications-and-muting) for how that works. The chat send delay, also under Settings → Content, gives you a moment to catch a mistake before it sends rather than limiting what's exposed; it's covered with the rest of the display settings in Customizing How Flotilla Looks and Feels.

These controls won't make Flotilla anonymous. Your published content and relay memberships still work the way [Is Flotilla Private?](/articles/is-flotilla-private) describes.
