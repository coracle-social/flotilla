#!/usr/bin/env bash
set -e

export FLOTILLA_DESKTOP=1
export NODE_ENV=production
unset FLOTILLA_DESKTOP_DEV_URL CAPACITOR_ELECTRON_DEV_SERVER_URL
source ./scripts/build-web.sh

export VITE_PLATFORM_NAME
# Capacitor sync swallows copy failures; its rejection handler also leaves exit 0.
node --unhandled-rejections=strict node_modules/@capacitor/cli/bin/capacitor copy @capawesome/capacitor-electron
node --unhandled-rejections=strict node_modules/@capacitor/cli/bin/capacitor update @capawesome/capacitor-electron
rm -rf electron/build
npm --prefix electron run build
