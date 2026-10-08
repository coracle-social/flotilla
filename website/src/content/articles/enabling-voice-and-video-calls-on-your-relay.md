---
title: "Enabling Voice and Video Calls on Your Relay (LiveKit)"
author: "Jon Staab"
pubDate: 2026-07-14
description: "Operator-side setup for voice rooms and video calls: running LiveKit and wiring it into zooid."
order: 30
category: advanced
---

# Enabling Voice and Video Calls on Your Relay (LiveKit)

*Part of our guide to [running an online community you actually own](/articles/how-to-run-an-online-community).*

Flotilla supports voice rooms and video calls with screen sharing, but you have to configure the relay before members see the option. This article is for relay operators [self-hosting zooid](/articles/self-hosting-a-space). To use voice and video as a member, see [Spaces and Rooms Explained](/articles/spaces-and-rooms-explained) instead.

## The LiveKit server

zooid doesn't run its own media server. Audio and video calls are handled by [LiveKit](https://livekit.io/), a separate open-source WebRTC toolkit. zooid wires your relay into it, creating rooms, tracking who's in a call, and publishing presence so Flotilla knows a call is live. Before calls work, you need a LiveKit server, either a self-hosted instance or a LiveKit Cloud project. From it you'll collect three values to hand to zooid: the server's `server_url`, an `api_key`, and an `api_secret`.

## Add the `[livekit]` block

Add a `[livekit]` section to the relay's TOML config file, alongside its other sections like `[policy]` and `[groups]`:

```toml
[livekit]
server_url = "wss://my-project.livekit.cloud"
api_key = "<key from your LiveKit server>"
api_secret = "<secret from your LiveKit server>"
```

If `api_key` is left blank, zooid starts without logging a warning, and the call-related endpoints return 404 to every request. If members report that voice rooms exist but calls never connect, check this block first.

## Point a webhook back at your relay

LiveKit tells your relay when someone joins or leaves a call, so the relay can publish presence and Flotilla can show who's in a room. On the LiveKit side, configure a webhook pointing at:

```
https://yourrelay.com/.well-known/nip29/livekit/webhook
```

This endpoint is authenticated by LiveKit's own request signature rather than a login, so it must be signed with the exact same `api_key`/`api_secret` pair you put in the relay's config. If they don't match, zooid rejects the webhook and presence silently stops updating.

LiveKit supports only a single webhook URL. If you run several relays that share one LiveKit project, point it at the management API's shared webhook endpoint instead of any one relay's own URL. That endpoint requires `API_HOST` to be configured. For a single relay, use the per-relay URL above.

## Opt a room in

Configuring `[livekit]` makes calling available to the relay, but it doesn't turn every room into a call. Each room that should support calls needs a `livekit` tag in its NIP-29 group metadata, which Flotilla adds when an admin creates or edits a room and chooses the "Voice" room type. That option only appears in the room-creation form once the relay advertises LiveKit support. One LiveKit room maps to exactly one room in your space, and calls don't span rooms or spaces.

## If your space is hosted, not self-hosted

If Flotilla [hosts your space](/articles/hosting-with-flotilla) rather than a relay you manage yourself, you don't touch any of the above directly. Video calling is one of the feature toggles in your space's hosting settings, available on the Basic and Growth plans but not on Free. We run and configure the LiveKit server for you, so flipping the toggle is the entire setup.

## Verifying it works

Once `[livekit]` is configured and the webhook points at your relay, create or edit a room in Flotilla and confirm that "Voice" appears as a room type. If it doesn't, check that `api_key` isn't empty and that the config file reloaded cleanly. zooid hot-reloads config changes, but a typo in the file leaves that relay unreachable until it's fixed. If the room type appears but calls fail to connect once you join, the cause is usually a webhook signature mismatch rather than the `[livekit]` block itself.

If you get stuck, [reach out to the community](/articles/community-and-support) for help.
