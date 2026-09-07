#!/usr/bin/env bash
set -e

export FLOTILLA_DESKTOP=1
source ./scripts/build-web.sh

pnpm exec cap sync @capawesome/capacitor-electron
npm --prefix electron run build
