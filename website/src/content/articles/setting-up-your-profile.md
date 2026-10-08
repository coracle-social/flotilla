---
title: "Setting Up Your Profile"
author: "Jon Staab"
pubDate: 2026-07-14
description: "Edit your display name, avatar, bio, and website, add an optional Nostr address (NIP-05), and share your profile QR code so others can find you and start a DM."
order: 9
category: basics
---

# Setting Up Your Profile

*Part of our guide to [running an online community you actually own](/articles/how-to-run-an-online-community).*

Once you're signed in, you can change how you appear to everyone else at any time — your name, picture, bio, and a couple of optional extras. None of this touches your underlying Nostr key; it's just the public information attached to it.

## Where to edit it

Go to **Settings > Profile**. Near the top you'll see how you currently appear, with an edit (pencil) button beside it — tap it to open the profile form. From there you can set:

- **Nickname** — what you'd like people to call you.
- **About You** — a short bio or introduction.
- **Avatar** — your profile picture.
- **Website** — a link to your site, portfolio, or wherever else you want to point people.

Every field is optional, so leave any of them blank if you like. Save your changes and they take effect immediately, everywhere you're signed in.

Your profile is stored the same way your posts are, as a signed piece of Nostr data that any relay you use can hold, so anyone able to read that relay can see it. See [Is Flotilla Private?](/articles/is-flotilla-private) for the fuller picture of what's public versus what's actually protected.

## Adding a Nostr Address (NIP-05)

The profile form also has a **Nostr Address** field, with a "What is a nostr address?" link beside it if you want the in-app explanation. A Nostr address (also called a NIP-05) is optional and looks like an email address — something like `you@example.com` — but it isn't an email account. It's a human-readable pointer to your public key, hosted on a domain, that lets people find and confirm you without matching a long string of characters.

Flotilla doesn't issue, host, or verify a Nostr address for you. It's just a field for one you've already set up through an external provider or your own domain. If you don't have one, leave it blank; it's entirely separate from your key. See [Nostr Terms Explained](/articles/nostr-terms-explained) for how it fits alongside the other Nostr-specific words you'll run into.

## Sharing your profile

Wherever Flotilla shows someone's profile — a member's card in a space's directory, for instance — it offers a small menu with two options: **Profile Info** and **Share**. It appears on your own profile card too, and your own entry in a space's Member Directory is a reliable place to find it.

Tap **Share** and Flotilla shows a QR code alongside a copyable link to your profile. Someone can scan the code, copy the link, or, if your device supports it, use a native share button to send it another way. Any of these takes them to your profile, where they can see what you've set and start a direct message with you.

## What this doesn't change

Editing your profile only changes what people see about you. It has no effect on your key or how you log in. See [Understanding Your Nostr Identity](/articles/understanding-your-nostr-identity) for that distinction, and [Getting Started](/articles/getting-started) if you're still setting up your first profile during sign-up.

Two other things live on the same Settings > Profile screen but are covered elsewhere: copying your raw key again is in [Understanding Your Nostr Identity](/articles/understanding-your-nostr-identity), and clearing or deleting your profile entirely is in [Can I Delete My Account or Data?](/articles/deleting-your-account).
