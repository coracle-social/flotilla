---
title: "Flotilla: A Discord Alternative You Actually Own"
author: "Jon Staab"
pubDate: 2026-07-14
slug: discord-alternative
description: "An honest look at Flotilla as an alternative to Discord: own your community, self-host, avoid deplatforming, and run without ads."
order: 41
---

# Flotilla: A Discord Alternative You Actually Own

*Part of our guide to [running an online community you actually own](/articles/how-to-run-an-online-community).*

If you're running a community on Discord and have started to wonder what happens if the rules change, the account gets suspended, or you want to move somewhere else one day, this article is for you. It compares Discord and Flotilla for organizers looking for an alternative where the community, the history, and the members are yours.

## What Discord is, and what it's good at

Discord is a free, real-time community chat platform — text, voice, and video — organized into "servers" that are split into channels. It launched in 2015 with a gaming focus and has since spread to hobby groups, creators, classrooms, startups, and AI communities. For live, synchronous communities, Discord is very good.

- **Polished voice and video for large live audiences.** Low-latency voice, video, and screen sharing built to handle big synchronous crowds.
- **A huge existing network.** More than 200 million monthly active users, with hundreds of millions of registered accounts. For many communities, members are already on Discord, so onboarding friction is low.
- **A mature bot and integration ecosystem.** Years of third-party bots for moderation, automation, games, and workflows.
- **Serious moderation infrastructure.** A top-down role hierarchy, three-layer permissions (server defaults, category, per-channel overwrites), and built-in AutoMod.
- **Built-in creator monetization.** Server Subscriptions and a Server Shop, where creators keep roughly 90% of membership revenue before processing fees.
- **Familiar, cross-platform UX.** Web, desktop, and mobile, with an interface most people already know.

If your priority is instant chat and voice with people who are already on Discord, it's a strong choice.

## Where Discord falls short if you want to own your community

Discord is proprietary and centralized, and there is no self-hosted or on-premise version. Your server and all its data live on Discord's infrastructure, under Discord's account and terms.

- **You don't own your server.** It lives entirely on Discord's infrastructure under Discord's control. There is no way to run it yourself.
- **Deplatforming exposure.** Per its Terms of Service, Discord can suspend or terminate accounts and remove content, with or without advance notice, for policy or legal reasons. Its transparency reports document this happening at scale, with large numbers of servers removed and accounts disabled for policy violations. An account-level action can also cascade. If your account is disabled, you lose access to every server you run or belong to, not just the one where something went wrong.
- **Weak data portability.** There is no community or server export tool. Discord's personal data download includes only your own messages, not other members' messages or full server history, so organizers who want to migrate rely on third-party tools like DiscordChatExporter.
- **Lock-in.** Because members, history, roles, and integrations are all Discord-native and non-portable, moving elsewhere means rebuilding from scratch and losing your history.
- **Ads and a broad content license.** Discord has introduced advertising through Quests, sponsored offers surfaced inside the app. Its terms also grant Discord a broad license to use, reproduce, modify, distribute, and display the content you post. You keep ownership, and this kind of license is common for large platforms, but it's a lot to grant.
- **Monetization on Discord's terms.** Discord takes roughly a 10% cut plus payment processing on Server Subscriptions, and iOS-initiated subscriptions also incur Apple's ~30% fee.

Discord's paid tiers don't change any of this. Nitro Basic ($2.99/month) and Nitro ($9.99/month) are personal perks rather than ownership, and no tier buys you self-hosting, a server export, or insulation from a ban.

## How Flotilla is different

Flotilla is a platform for building and running online communities — chat, voice, video, threads, and events, all in one place. It is built on the open [Nostr](/articles/what-is-nostr) protocol, which changes the ownership model.

**You own your identity, and it's portable.** Instead of an account a company issues and can revoke, you sign in with a key that's yours. It works the same across Nostr apps, so no single platform can lock you in or shut you out. If you ever leave Flotilla, you can bring your people and your history with you.

**You own the server your community lives on.** Flotilla doesn't host your community for you. The app is the software members use to get in, and the community itself lives on a server you control. You can [run it yourself](/articles/self-hosting-a-space) on a plain virtual server (around $11/month) using the free, open-source zooid relay software, or use managed hosting where a provider keeps the machine running for you.

**You can't be deplatformed the way Discord can deplatform you.** Because your identity is a cryptographic key rather than a company-issued account, your social identity can't be taken away, and keeping a backup of your events protects your content and social graph too.

**No ads, no surveillance.** Flotilla is [free to use](/articles/is-flotilla-free) and earns nothing from watching you. There is no feed built to keep people scrolling and no advertising business on top.

**Real community tools.** A space holds text rooms, voice rooms, threads, a calendar of events, a library of pinned links, and polls, and you turn on what fits. Moderation includes member management, banning and restoring, member-submitted reports you review in one place, and custom color-coded roles. Flotilla supports voice and video calls with screen sharing. Members can also send zaps, small Lightning tips, on a message or a community fundraising goal.

Flotilla is weaker in several ways: it has a much smaller network than Discord, no comparable third-party bot ecosystem, and voice and video that aren't built for the huge live audiences Discord handles. It isn't a tool for high-stakes anonymity either. We describe spaces as ["non-public" rather than "private"](/articles/is-flotilla-private), suited to small communities rather than journalists or activists. Direct messages are end-to-end encrypted, but a space is only as private as its host's policies and its least-trusted member.

## Discord vs Flotilla at a glance

| Dimension | Discord | Flotilla |
|---|---|---|
| Who owns the server | Discord Inc.; no self-hosting or on-premise option | You do — self-host on your own server or use managed hosting you control |
| Deplatforming risk | Accounts and servers can be suspended or removed; a ban can cascade across every server | Identity is a key you own and can't be taken away; reduces deplatforming exposure |
| Data & portability | No community export tool; migration relies on third-party tools; members and history are locked in | Portable identity and history; leave and bring your people with you |
| Ads & data use | Advertising via Quests; broad content license granted to Discord (common for large platforms) | No ads, no surveillance |
| Cost | Free to run; optional personal Nitro ($2.99–$9.99/mo) buys perks, not ownership | App is free and open source; hosting is free to self-host (pay ~$11/mo for a server) or managed from free / $5 / $25 per month |
| Network & live voice | 200M+ monthly users, mature bots, polished large-audience voice/video | Smaller network; voice, video, and screen sharing supported, but not built for huge live audiences |

## When Discord might be the better choice

Discord is the better pick when:

- **Your community is about live voice or gaming.** If low-latency voice and video for large synchronous crowds is the whole point, Discord's polish there is hard to beat.
- **You want to be where the network already is.** If your members are already on Discord and low onboarding friction matters more than ownership, that existing reach is a genuine advantage.
- **You depend on specific bots or integrations.** Discord's third-party ecosystem is far larger and more mature than anything in the Nostr world today.
- **Ownership, self-hosting, and portability aren't priorities.** If you're happy being a tenant and don't expect to move or worry about deplatforming, Discord's free tier is a lot of capability at no cost.

## Ready to try the alternative?

If you want a community you own rather than one you rent, Flotilla is worth a look. See the [pricing page](/pricing) for hosting options side by side, from a free tier to managed plans to fully [self-hosting a space](/articles/self-hosting-a-space). Start building at [app.flotilla.social](https://app.flotilla.social).
