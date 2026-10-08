---
title: "Backing Up and Upgrading Your Self-Hosted Relay"
author: "Jon Staab"
pubDate: 2026-07-14
description: "What to back up on a self-hosted zooid relay, how to do it safely, and how to upgrade without losing data."
order: 31
category: advanced
---

# Backing Up and Upgrading Your Self-Hosted Relay

*Part of our guide to [running an online community you actually own](/articles/how-to-run-an-online-community).*

If you followed [Self Hosting a Space](/articles/self-hosting-a-space) to stand up your own zooid relay, keeping it running is now your job. Running a relay isn't a lot of work, but occasional maintenance is necessary to keep things functioning smoothly.

## What to back up

Your zooid deployment writes to three places: `config`, `data`, and `media`. If you're using docker, make sure to mount these locations as volumes, and when backing up make sure to keep all three.

Every virtual relay in your deployment is defined by a file in `config`. This file contains the relay's secret key, identifying events published by the relay itself. When backing these files up, be sure to encrypt them to prevent spoofing the relay's identity.

The data for your zooid instance is contained in `data`. Each virtual relay is backed by a separate set of SQLite tables which are shared by the entire deployment.

Finally, unless you've configured a S3-compatible backend for your relays, images and other files will be stored in `media`.

## Backing up safely

The simplest approach is to stop the relay briefly before copying:

```bash
docker compose stop zooid
tar czf zooid-backup-$(date +%F).tar.gz volumes/zooid/config volumes/zooid/data volumes/zooid/media
docker compose start zooid
```

If you'd rather not take the relay offline, and you have the `sqlite3` CLI available, checkpoint the database first so the `-wal` file merges into `db`, then copy all three files (plus `config/` and `media/`) as a unit:

```bash
sqlite3 volumes/zooid/data/db "PRAGMA wal_checkpoint(TRUNCATE);"
tar czf zooid-backup-$(date +%F).tar.gz volumes/zooid/config volumes/zooid/data volumes/zooid/media
```

Either way, store the archive somewhere other than the server itself, for example on a second machine or in encrypted cloud storage.

## Upgrading zooid

Zooid migrations run automatically when the server is started, so nothing is required to update other than bumping the version of zooid you're running. Pull the new image and restart:

```bash
docker compose pull zooid
docker compose up -d zooid
```

You should still take a backup first when upgrading, especially when moving from a very old version.

## Config hot-reload

zooid watches `config/` continuously and reloads a relay the moment its file changes, so config edits need no restart. Reload tears the relay down *before* rebuilding it from the new file. To avoid downtime due to editing mistakes, edit a copy of your config file, validate it, then move it into place rather than hand-editing the live file.

## If you need import/export tools

zooid's source includes `bin/import` and `bin/export` for dumping or restoring events as JSONL, but neither ships in the published Docker image, which contains only `bin/zooid`. If your backup and restore needs go beyond copying the `data/` files directly, build zooid from source to get these tools.

If you have questions about your setup, [join our space](/articles/community-and-support) and ask.
