---
title: "Flotilla as a Slack Alternative"
author: "Jon Staab"
pubDate: 2026-07-14
slug: slack-alternative
description: "Flotilla is an alternative to Slack for communities that want to own their space and data instead of paying per seat."
order: 40
---

# Flotilla as a Slack Alternative

*Part of our guide to [running an online community you actually own](/articles/how-to-run-an-online-community).*

If you are looking for an alternative to Slack, the first question is what you are running. Slack is workplace software, built for the employees of one company chatting with each other, wired into the rest of their corporate tools. If that is you, Slack is probably the right tool. But a lot of people reach for Slack to run something it was never designed for: an open community, a club, a congregation, a volunteer network, a group that spans several organizations. Flotilla is the Slack alternative for that second group, organizers who want to own the community they build rather than rent it per seat.

## What Slack is, and what it's good at

Slack is a workplace messaging platform — channels, direct messages, huddles for audio and video, canvases, and deep integrations — owned by Salesforce since its 2021 acquisition. It is a closed, cloud-only product with no open-source edition and no self-hosting, so every workspace runs on Salesforce-operated infrastructure, organized around internal, invite-only teams.

Within that scope it is excellent, and probably a better fit than Flotilla for an internal company team:

- **Best-in-class enterprise integrations.** Slack connects to more than 2,600 apps and adds Workflow Builder automation, with native ties to Salesforce, Google Workspace, GitHub, Jira, Zoom, and the rest of a typical business stack.
- **Mature administration and compliance.** On its higher tiers Slack offers SSO/SAML, SCIM provisioning, DLP, eDiscovery, audit logs, and data-residency options — the controls an IT department needs to manage a single organization.
- **Polished, reliable UX.** Strong search, threads, huddles, and canvases, all well built and dependable.
- **No advertising.** Slack is not ad-supported. There is no feed built to keep people scrolling, and its incentive is subscription revenue. Flotilla shares that.

For an internal, IT-managed team that lives inside an enterprise toolchain, Slack is the stronger choice.

## Where Slack falls short if you want to own your community

Slack's design assumptions — invite-only org, every member on the payroll, IT in control — work against open or member-owned communities.

**Per-seat billing grows with your community.** Slack is priced strictly per user. There is a Free tier, then Pro at about $7.25 per user per month billed annually (roughly $8.75 month-to-month), Business+ at about $12.50 per user per month billed annually (roughly $15 month-to-month), and Enterprise Grid or Enterprise+ by custom quote through Salesforce sales. Paid AI features are an add-on. For a company with a fixed headcount that is fine. For an open or volunteer community, every person who shows up raises your bill.

**The free plan hides and then deletes your history.** On Slack's Free plan, only the most recent 90 days of messages and files are visible. And since August 26, 2024, free-workspace data older than one year is permanently deleted. It does not come back even if you upgrade later, which used to restore everything. The Free plan is also capped at 10 app integrations, limited to one-on-one huddles, and strips out Slack Connect channels.

**Getting your full history out has gotten harder.** Admins can still use Slack's own export tools, but on the Free and Pro plans those only cover public-channel content, with private channels and DMs gated behind higher tiers and an approval process. Programmatic access changed too. Effective May 29, 2025, Salesforce updated the Slack API Terms to prohibit bulk exporting of data via the Slack APIs and the creation of persistent copies, archives, indexes, or long-term data stores. The same change bans using Slack-API data to train large language models and steers third parties toward Slack's own Real-Time Search API.

**There is no self-host fallback.** Because Slack is cloud-only and closed-source, your community lives entirely on Salesforce infrastructure and is subject to Slack's Acceptable Use Policy, which can suspend or terminate accounts. In May 2024 Slack was criticized for opting workspaces in by default to training its non-generative "global" machine-learning models on customer data, with opt-out requiring an email rather than a settings toggle.

## How Flotilla is different

Flotilla is a platform for building and running online communities — chat, voice, video, threads, events, a calendar, polls, and a library — with moderation tools built in. It is built on the open Nostr protocol, which changes who controls the community.

**You own the community.** In Flotilla your community lives on a relay you control, either through managed hosting or a server you run yourself. Your identity is a cryptographic key that belongs to you, not an account a company issues and can revoke. That same identity works across Nostr apps, so you and your members are never locked to Flotilla. If we ever stop serving you well, you can leave and bring your people and history with you. The reasoning behind this is in [What is Flotilla?](/articles/what-is-flotilla).

**No per-seat billing.** Using Flotilla and joining a community is free. There is no subscription and nothing in the app behind a paywall. The only cost falls on whoever runs the space, and it is a flat hosting cost rather than a charge per member. [Hosting with Flotilla](/articles/hosting-with-flotilla) is free for up to 10 members, then $5/month for up to 100 members with media, and $25/month for unlimited members. Or you can self-host on a plain virtual server for around $11/month regardless of how many people join. The full breakdown is in [Is Flotilla Free?](/articles/is-flotilla-free) and on the [pricing page](/pricing).

**Your history is yours to keep.** There is no free-plan limit that hides older messages or deletes them after a year. Your messages live on a relay you control, and you decide how long to retain them.

**Harder to deplatform.** Because your identity is a cryptographic key and your space can run on infrastructure you control, you reduce your exposure to being switched off by a single provider's decision. Keep a backup of your events and you are also protected against losing your content and social graph. [Self-hosting a space](/articles/self-hosting-a-space) explains how that works.

**No ads, no surveillance.** Like Slack, Flotilla does not run advertising. Unlike Slack, it also does not run on infrastructure owned by a data company. There is no feed built to keep people scrolling and no business built on watching your members.

## Slack vs Flotilla at a glance

| Dimension | Slack | Flotilla |
| --- | --- | --- |
| Built for | Internal, invite-only company teams | Member-owned communities, including cross-organization ones |
| Pricing model | Per seat: Free, Pro ~$7.25/user/mo, Business+ ~$12.50/user/mo, Enterprise by quote | Free to use and join; owner pays flat hosting (free tier, $5, $25/mo, or ~$11/mo self-hosted) |
| Message history | Free plan shows last 90 days; data over 1 year is permanently deleted | You control the relay and set retention; no platform-imposed cap |
| Data ownership & portability | Customer is controller, but data lives on Salesforce infra; May 2025 API terms restrict bulk export and persistent copies | You own the relay and your identity; export, move, and carry members across apps |
| Hosting & deplatforming | Cloud-only, closed-source, no self-host; AUP suspension risk | Self-host or managed; open source; cryptographic identity resists deplatforming |
| Enterprise integrations & compliance | 2,600+ apps, Workflow Builder, SSO/SAML, SCIM, DLP, eDiscovery, audit logs | Not an enterprise-admin product; far fewer integrations and no built-in compliance suite |

## When Slack might be the better choice

There are real cases where Slack is the right answer:

- **You are an internal company team wired into an enterprise stack.** If your group needs deep, native ties to Salesforce, Google Workspace, GitHub, Jira, Zoom, and a long tail of business apps, plus Workflow Builder automation, Slack's 2,600+ integrations are best-in-class.
- **You have formal compliance requirements.** If you need SSO/SAML, SCIM provisioning, DLP, eDiscovery, audit logs, or data-residency guarantees managed by IT, Slack's higher tiers are built for exactly that. Flotilla is not an enterprise-administration product.
- **Everyone is on one payroll and headcount is fixed.** Per-seat pricing is only a problem when your community is open or growing. For a bounded internal team, it is predictable and reasonable.

If that describes you, use Slack. Flotilla fits when the group is a community rather than a company, and you want to own the space, keep your history, and avoid paying per participant.

## Getting started

If you want a platform your community owns, Flotilla is free to use and takes a few minutes to set up. Compare the hosting options side by side on the [pricing page](/pricing). If you want a fully branded app and site we build and run for you, see [the Platform plan](/articles/platform-plan).

Start your community at [app.flotilla.social](https://app.flotilla.social).
