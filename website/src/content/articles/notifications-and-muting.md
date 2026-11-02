---
title: "Notifications and Muting"
author: "Jon Staab"
pubDate: 2026-07-14
description: "Control what pings you: per-room and per-space notifications, alert types, and muting accounts or rooms."
order: 16
category: basics
---

# Notifications and Muting

*Part of our guide to [running an online community you actually own](/articles/how-to-run-an-online-community).*

By default, Flotilla notifies you about activity in every [space](/articles/spaces-and-rooms-explained) and room you belong to. You can tune that in three places: which rooms and spaces can ping you, which kinds of activity count as a notification, and who you'd rather not hear from at all.

## Per-room and per-space notifications

Every space has a header menu — tap the space name at the top of its room list — with a "Turn on/off notifications" option that flips alerts for the whole space at once. Individual rooms keep whatever setting they already had, so with a space off you can still have a room or two notifying you, and with a space on you can silence the one noisy room.

For a single room, open it and click the info icon at the top of the screen to see its details. Under "Room Settings" you'll find a **Notifications** toggle for that room specifically. It's the same per-room control that [joining a space](/articles/joining-a-space) points you to right after you first join.

Flotilla saves this preference as an encrypted event published to your own relays, tied to your [Nostr identity](/articles/understanding-your-nostr-identity). Log in on another device with the same key, and your per-space and per-room notification choices come with you.

## Choosing what counts as a notification

**Settings → Alerts** holds the broader controls. Here you can turn on:

- A **badge** showing your unread count on the app icon
- A **notification sound** for new activity (this option only appears in the web app — the native Android and iOS apps use your phone's own sound settings)
- **Push notifications**, delivered to your device even when Flotilla isn't open

Below that, "Alert Types" lets you choose *what* triggers a notification: general activity in a space, being directly mentioned, or new [direct messages](/articles/direct-messages). These alert settings are stored on the device you set them on, so check them on each device you use.

## Favoriting a room

That same room info panel has a **Favorite** toggle next to the notification one. Favoriting a room bookmarks it, keeping it near the top of your room list instead of buried under everything else in the space.

## Muting accounts

If the problem is a specific person rather than a specific room, go to **Settings → Content** and add them under **Muted Accounts**. Once someone is muted, their messages collapse wherever you'd otherwise see them, replaced by a note that you've muted this person and a "Show anyway" link in case you change your mind for a particular message. Muting doesn't remove you from a room or space, and it doesn't notify the other person.

For a room that's too noisy, turn off that room's notifications from its info panel, or leave its member list from the room menu if you want out entirely.

## Where these controls live

- **Room info panel** (info icon inside a room) — per-room notifications, favoriting
- **Space menu** (tap the space name) — notifications for the whole space
- **Settings → Alerts** — badges, sound, push, and which activity types notify you
- **Settings → Content** — muted accounts
