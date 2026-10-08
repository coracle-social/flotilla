---
title: "Billing and Payments for Your Hosted Space"
author: "Jon Staab"
pubDate: 2026-07-14
description: "How billing works for a paid hosted space — how you pay, the grace period, and proration — at a glance."
order: 26
category: advanced
---

# Billing and Payments for Your Hosted Space

*Part of our guide to [running an online community you actually own](/articles/how-to-run-an-online-community).*

If you pay for a relay Flotilla hosts, billing lives in the app, under **Settings → Hosting**. If you haven't set up a hosted space yet, start with [Hosting Your Space with Flotilla](/articles/hosting-with-flotilla).

## How you pay

Flotilla accepts two payment methods, and you can use either or both with autopay:

- **Lightning** — connect a wallet with a Nostr Wallet Connect (NWC) URL, and new invoices are paid automatically from it.
- **Card** — add a card through Stripe, which handles the card details.

When an invoice comes due, Flotilla charges your Lightning wallet first, then a saved card. If both are missing or fail, you get a manual pay link as an encrypted direct message.

## Billing cycle and proration

Billing runs in monthly cycles anchored to your first billable activity, not the calendar month. Within a cycle, charges are prorated: creating a paid relay mid-month charges only for the remaining days, changing plans charges or credits the difference, and deactivating a relay credits the unused remainder. Credits net against charges, so a small balance can roll forward to offset a future invoice.

## If you don't pay

An open invoice has a **7-day grace period**. If it's still unpaid when that window closes, your relays are paused, the same as deactivating them yourself, with your data, settings, and members preserved. The unpaid invoice is voided and forgiven rather than carried forward as debt, so there are no old invoices to settle when you reactivate.
