---
title: "Finding Messages and Recent Activity"
author: "Jon Staab"
pubDate: 2026-07-14
description: "Use a space's Recent Activity feed to catch up and the Search Content dialog to find old messages, and understand why search results depend on the space's own relay."
order: 15
category: basics
---

# Finding Messages and Recent Activity

*Part of our guide to [running an online community you actually own](/articles/how-to-run-an-online-community).*

Flotilla gives you two tools for keeping up with a busy [space](/articles/spaces-and-rooms-explained) and digging back through it: **Recent Activity**, a feed that gathers everything new in one place, and **Search Content**, a dialog for finding something specific you remember seeing.

## Catching up with Recent Activity

Every space has a Recent Activity page, reachable from its sidebar. It gathers what's new across every room and content type into a single scrollable feed: the latest message in each room you haven't seen, plus new thread posts and comments, classified listings, fundraising goals, calendar events, and polls. Each item shows where it happened and how recently, so you can decide what's worth opening and what to skip.

The feed is sorted freshest first and covers roughly the last few months.

## Finding something specific with Search Content

When you already have a rough idea of what you're after, search instead. From the Recent Activity page, tap the magnifier icon in the top bar to open the **Search Content** dialog. Type into the "Search this space..." box and Flotilla searches messages and other content across the whole space, grouping matches by how recent they are (last 24 hours, last 7 days, older).

If you already know which room the message was in, open that room and use its own search. It works the same way, narrowed to that one room's messages.

## Search depends on the space's relay

Search results only include what the space's own relay holds and is willing to return. Flotilla queries that one relay for events matching your term, rather than a global Nostr index. If the relay doesn't store a message — because it expired, was deleted, or was never on that relay to begin with — search can't find it. And if the relay doesn't support full-text search at all, the box may come back empty even when the content is sitting in the relay's normal chat history.

Messages you've seen recently are almost certainly still on the relay and searchable. When a search comes up empty and you're sure you saw the message, the gap is usually in what the relay stored or supports.

## Related tools

Two other parts of a space have their own search:

- The [Library](/articles/featured-content-and-library) — a space's curated collection of pinned links and events — searches just those pinned items.
- The [member directory](/articles/spaces-and-rooms-explained) searches people rather than messages.
