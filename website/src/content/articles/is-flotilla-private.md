---
title: "Is Flotilla Private?"
author: "Jon Staab"
pubDate: 2026-07-14
slug: is-flotilla-private
source: https://flotilla.social/articles/is-flotilla-private
description: "What \"private\" actually means in Flotilla, and the different guarantees that apply to community spaces versus direct messages."
order: 19
category: basics
---

# Is Flotilla Private?

*Part of our guide to [running an online community you actually own](/articles/how-to-run-an-online-community).*

Calling something "private" can mean different things to different people, anything from "trust me bro" to full end-to-end encrypted communication. Flotilla covers two main areas where the requirements and guarantees differ: community spaces and direct messages.

### Space Privacy

Flotilla protects spaces through self-hosted community infrastructure rather than encryption. That gives organizers more control over exactly what stays private and who has access.

So a space is as private as the policies of the relays that host it. If an administrator wants the space to be invite-only and private, they can enforce that. If they want community content to be read-only for non-members, that's an option too. Either way, make the expectation clear to members.

A group is only as private as its least trusted member. Every time someone new joins, the guarantee that messages won't be shared out of context gets weaker. Encrypting a 50-member group would be overkill, given how weak that social guarantee already is.

Flotilla is also built on the Nostr protocol, which uses digital signatures to verify messages. That gives it weak *deniability*. If content leaks out of a group, it can be proven authentic, because the author signed it.

For this reason we describe Flotilla's groups — particularly those [hosted by Flotilla](/articles/hosting-with-flotilla) or using the [Zooid relay implementation](https://github.com/coracle-social/zooid) — as "non-public" rather than "private". Flotilla is built for small communities, not for journalists or activists.

### What Is Public About You

Some things about *you* are public on any space you join, no matter how tightly its policies are set.

Your public key — your [npub](/articles/understanding-your-nostr-identity) — is public. It isn't a secret, and was never meant to be one. Anyone can see it, and it's how other people and other apps recognize you as the same person across Nostr. Every public message you send, along with your [profile](/articles/setting-up-your-profile) (display name, bio, avatar, and the rest), is signed by that key and readable by anyone who can read the relay hosting it. Your membership in a space and the reactions you leave on other people's posts work the same way: they're visible to anyone who can read that relay, not hidden from other readers just because they weren't posted in the main chat.

This doesn't mean every relay is open to outsiders. Relays are closed by default, and non-members only see what an operator chooses to expose. But whatever an operator *does* expose, your own activity within it gets no extra protection.

Treat anything you publish as effectively permanent, even where a delete option exists. Flotilla can delete a message you posted, and a self-hosted relay running zooid can be set to expire events automatically or let an admin hard-delete something. None of that is a guarantee. Deletion on Nostr is a request, not a command, and neither Flotilla nor a relay operator can force every other relay, or anyone who already copied your content, to honor it. See [Can I Delete My Account or Data?](/articles/deleting-your-account) for exactly what Flotilla's delete tools do and don't accomplish.

Some relays also ask Flotilla to prove who you are before serving certain content. Answering tells the operator your identity, and a setting decides whether Flotilla answers for relays you haven't added yourself. See [Privacy Settings: Limiting What You Leak](/articles/privacy-settings) for that toggle and the rest of Flotilla's privacy controls.

### Direct Messages

Direct messages get a different approach. A DM rarely involves more than a handful of people (Flotilla supports small group chats as well as one-on-one conversations), and they're often stored on public infrastructure, so it makes sense to protect them with encryption.

Flotilla uses the [NIP 17](https://github.com/nostr-protocol/nips/blob/master/17.md) standard for end-to-end encrypted direct messages. As a result, service providers can't see your conversations, and you also get deniability and metadata protection.

What Flotilla DMs *don't* have is [forward secrecy](https://en.wikipedia.org/wiki/Forward_secrecy) or [post-compromise security](https://crypto.stackexchange.com/questions/80095/what-is-post-compromise-security-exactly). In plain terms, if your Nostr identity is ever compromised, an attacker could gain access to old messages. That's a trade-off between user experience and security. Those stronger guarantees would also mean your messages weren't available when you signed in on a new device.

### The Future of Messaging

Flotilla may eventually support [Marmot](https://github.com/marmot-protocol/marmot/), an emerging standard pioneered by the team at [WhiteNoise](https://www.whitenoise.chat/), which has the encryption features Flotilla's DMs lack plus the ability to host larger groups. The standard is very new, and porting Flotilla's more sophisticated group-management features to it would take a long time, so we aren't adopting it yet. If you're looking for stronger privacy guarantees, try [WhiteNoise](https://www.whitenoise.chat/).
