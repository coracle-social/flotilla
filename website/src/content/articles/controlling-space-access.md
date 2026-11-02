---
title: "Controlling Who Can Join Your Space"
author: "Jon Staab"
pubDate: 2026-07-14
description: "Who can join your space — invite links, adding members by pubkey, and the open-vs-private access policy."
order: 32
category: advanced
---

# Controlling Who Can Join Your Space

*Part of our guide to [running an online community you actually own](/articles/how-to-run-an-online-community).*

## Invite-only by default

When a space's relay has no access policy set, nobody but the owner can read or write content until they're invited. That holds whether your space runs on a freshly [self-hosted zooid relay](/articles/self-hosting-a-space) or one [hosted by Flotilla](/articles/hosting-with-flotilla).

## Invite links are reusable, not single-use

The easiest way to bring someone in is an invite link. From a space's main menu, click "Create Invite" to generate a link that you can copy, share, or show as a QR code. Whoever opens it is walked through login or onboarding and then offered the chance to join your space.

**An invite link or code is reusable, not single-use.** Redeeming it doesn't consume it or invalidate it for anyone else. Anyone who receives it can join, and can pass it on to someone you never meant to invite. Only share a link with people you want in your space, and revoke it if one leaks.

If a space is invite-only and you don't have a link, contact the space's moderator directly and ask for one. Flotilla's discovery page can point you to a space, but getting in still takes an invite from someone with admin access.

## Adding members directly

Instead of invite links, an admin can add a member directly by searching for their name, or by pasting their Nostr public key (you can find this on the user's profile page). You can do this from the invite code dialog, or from the Directory page by clicking "Invite people."

## Opening your space up

Making a space fully or partially public is a setting on your Space's relay, not something you toggle from inside Flotilla's chat interface. Where you change it depends on how your space is hosted.

**If Flotilla hosts your space**, open its [hosting settings](/articles/hosting-with-flotilla) and look at the access policy toggles: **public read** (anyone can read without joining), **public write** (anyone can post without joining), and **public join** (anyone can join without an invite at all). Flip only the ones you want. For most communities, public read with everything else off is a reasonable middle ground.

For self-hosted relays, you'll want to consult the documentation for the implementation you're running.

## Removing someone

Removing someone who has already joined is a ban rather than an un-invite. It's covered along with reports and room-level permissions in [Managing a Space](/articles/managing-a-space).
