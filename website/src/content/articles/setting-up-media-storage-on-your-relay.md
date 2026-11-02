---
title: "Setting Up Media Storage on Your Relay (Blossom)"
author: "Jon Staab"
pubDate: 2026-07-14
description: "Turn on Blossom media storage for a self-hosted zooid relay, choose local or S3 storage, and avoid the default that makes uploaded files world-readable."
order: 29
category: advanced
---

# Setting Up Media Storage on Your Relay (Blossom)

*Part of our guide to [running an online community you actually own](/articles/how-to-run-an-online-community).*

An image or file uploaded in Flotilla isn't stored as a regular Nostr event. It's handled by Blossom, a protocol for hosting binary media alongside a relay. On a self-hosted [zooid](/articles/self-hosting-a-space) relay, Blossom is **off by default**, though the sample config in the self-hosting walkthrough already sets `[blossom].enabled = true`.

## Who can read uploaded files

**Uploaded files are publicly readable by default**, because the `authenticated_read` setting defaults to `false`. Anyone with a file's URL can download it, whether or not they belong to your space, and no matter how private the room it was shared in. Your room and membership settings don't reach Blossom on their own, so locking down who can join and chat does nothing to lock down who can fetch a file someone posted.

If your space isn't meant to be fully public, set `authenticated_read = true`.

## Turning it on

Add or edit the `[blossom]` block in your relay's `.toml` config file:

```toml
[blossom]
enabled = true
authenticated_read = true
```

Both keys default to `false`. Set them explicitly so the config file documents your intent.

## Choosing a backend

Blossom can store files in two places, set with `adapter`:

```toml
[blossom]
adapter = "local"
```

- `"local"` (the default) — files are written to disk, under your relay's media volume.
- `"s3"` — files go to an S3-compatible bucket: AWS S3, MinIO, Cloudflare R2, or Linode Object Storage.

The value is case-sensitive, and has to be spelled exactly `"local"` or `"s3"` in lowercase. zooid rejects an invalid config at startup rather than falling back to a default, so that relay won't load. If you run several spaces from the same server, only the mistyped relay is affected. If a space stops connecting right after you edit its config, check your container logs for a line like `invalid blossom adapter` or `Failed to make instance`.

If you choose S3, add a `[blossom.s3]` block:

```toml
[blossom.s3]
region = "us-east-1"
bucket = "my-relay-media"
access_key = "..."
secret_key = "..."
# endpoint = "https://minio.example.com"
# key_prefix = "media/"
```

`region`, `bucket`, `access_key`, and `secret_key` are required. Leave `endpoint` unset for AWS. Set it for MinIO, R2, or Linode, which also forces path-style bucket addressing, the form those providers expect. `key_prefix` is optional, and useful if several relays share one bucket. As with your relay's `secret`, these credentials sit in cleartext in the TOML file, so treat the config file itself as sensitive.

S3 loses HTTP range-request support, because each file is read fully into memory rather than streamed in byte ranges from the bucket. Large files and video can't seek or resume a partial download the way they can from local disk.

## Fixed limits

A few things aren't configurable, on either backend:

- **10 MiB per file.** No setting raises this, and anything larger is rejected.
- **Only relay members can upload, list, or delete media.** There's no per-room permission, so any member has full Blossom access across the whole relay.

## Backing it up

With the local adapter, uploaded files live in your relay's media volume and need to be backed up the same way as the rest of your data. See [Backing Up and Upgrading Your Self-Hosted Relay](/articles/backing-up-and-upgrading-a-relay). With S3, your media already lives in the bucket, so it isn't part of your local backup.

## If your space is hosted, not self-hosted

None of the above applies if Flotilla [hosts your space](/articles/hosting-with-flotilla) rather than a relay you manage yourself. Media storage is one of the feature toggles in your space's hosting settings, available on the Basic and Growth plans but not on Free. Flotilla handles storage behind that toggle, so you can't set `authenticated_read` or choose an S3 backend yourself.
