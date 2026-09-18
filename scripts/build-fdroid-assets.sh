#!/usr/bin/env bash
set -euo pipefail
root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
cd "$root"
[[ -f .fdroid/prepared ]]
rm -rf build .svelte-kit
pnpm exec tsc --module esnext --moduleResolution bundler --target es2020 \
  --declaration --skipLibCheck --outDir node_modules/nostr-signer-capacitor-plugin/dist/esm \
  .fdroid/signer/src/index.ts
export VITE_BUILD_HASH=$(cat .fdroid/build-hash)
source scripts/build.sh
