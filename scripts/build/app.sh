#!/usr/bin/env bash

source ./scripts/build/web.sh

npx cap sync
npx @capacitor/assets generate \
  --iconBackgroundColor '#eeeeee' \
  --iconBackgroundColorDark '#222222' \
  --splashBackgroundColor '#ffffff' \
  --splashBackgroundColorDark '#191E24'

# @capacitor/assets doesn't generate Android notification icons
node scripts/build/notification-icon.mjs
