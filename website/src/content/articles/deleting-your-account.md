---
title: "Can I Delete My Account or Data?"
author: "Jon Staab"
pubDate: 2026-07-14
description: "What deleting a message or clearing your profile actually does, and why anything you publish is best treated as permanent."
order: 21
category: basics
---

# Can I Delete My Account or Data?

*Part of our guide to [running an online community you actually own](/articles/how-to-run-an-online-community).*

Flotilla doesn't own the infrastructure your spaces run on. Instead, each space lives on a server its community controls, and your identity is a key you hold rather than an account Flotilla issues. That cuts both ways - nobody can shut down your community or lock you out of your identity, but there's also no single company that can close your account and erase everything you've posted.

Because content on Flotilla is [digitally signed](/articles/understanding-your-nostr-identity), anyone can prove you said it, regardless of who holds the data. Again, this is great because it allows you to switch providers effortlessly, but it also means you lose what's known as "deniability" - that is, the ability to deny you said something.

What you can do is ask spaces to delete your data. You can ask for a single message to go away, or you can ask for your account to be completely deleted. In most cases, space owners will honor these requests.

## Deleting a single message

Open the menu on one of your own messages in a space's room and choose **Delete Message**. Flotilla shows a confirmation, then sends a deletion request to that room's space. A space that ignores deletion requests, or anyone who already saved a copy, can still keep the message though.

Space admins can also hard-delete *any* message from their own space (see [Managing a Space](/articles/managing-a-space)). That removes it from that one space only.

## Deleting your whole profile

Go to **Settings > Profile**, expand **Advanced**, and tap **Delete your profile**. The button opens a confirmation screen titled "Delete your account," and it does more than clear your profile fields. To proceed, you type the exact phrase "permanently delete my nostr account." Once you confirm, Flotilla:

1. Publishes a blanked profile, with your name replaced by "[deleted]", for relays that don't support the deletion methods below.
2. Sends a "right to vanish" request, asking relays to remove everything tied to your key.
3. Sends individual deletion requests, in batches, for every event of yours it knows about, including messages and reactions.

Flotilla logs you out when it finishes. As the confirmation screen warns, not all relays may honor the request. If your content keeps showing up somewhere, you may have to contact that relay directly.

## Treat anything you publish as permanent

Nostr events are signed, so their authenticity can be proven even after you've asked to delete them. See [Is Flotilla Private?](/articles/is-flotilla-private) for what that means for deniability.

To walk away from an identity, delete what you can and then stop using the key. You can't guarantee removal everywhere.
