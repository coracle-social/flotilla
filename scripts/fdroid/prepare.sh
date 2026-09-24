#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.."
if [[ -f .fdroid/prepared ]]; then
  exit 0
fi

store=$(mktemp -d)
trap 'rm -rf "$store"' EXIT

node fdroid/prepare.mjs
# Let pnpm update its own lockfile; suppress package lifecycle scripts during preparation.
pnpm --config.store-dir="$store/store" --config.cache-dir="$store/cache" remove --lockfile-only --config.ignore-scripts=true @capacitor/push-notifications capacitor-set-version
pnpm --config.store-dir="$store/store" --config.cache-dir="$store/cache" install --frozen-lockfile --ignore-scripts --config.side-effects-cache=false
# Git package lifecycle scripts normally build the signer and discard its TS source.
# Acquire that source at pnpm's resolved revision, without a second pin or nested npm install.
signer_url=$(pnpm --config.store-dir="$store/store" list nostr-signer-capacitor-plugin --json | node --input-type=module -e '
import {readFileSync} from "node:fs"
const [project] = JSON.parse(readFileSync(0, "utf8"))
const {resolved} = project.dependencies["nostr-signer-capacitor-plugin"]
if (!resolved.startsWith("https://")) throw new Error("Expected a resolved HTTPS signer source archive")
console.log(resolved)
')
curl --fail --location "$signer_url" -o "$store/signer.tar.gz"
mkdir -p .fdroid/signer android/app/src/main/assets/public
tar -xzf "$store/signer.tar.gz" --strip-components=1 -C .fdroid/signer --wildcards '*/src/*' '*/LICENSE'
printf '%s\n' "${VITE_BUILD_HASH:-$(git rev-parse --short HEAD)}" > .fdroid/build-hash
pnpm exec cap update android
touch .fdroid/prepared
