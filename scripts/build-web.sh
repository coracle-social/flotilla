#!/usr/bin/env bash

temp_env=$(declare -p -x)

if [ -f .env ]; then
  source .env
fi

# Avoid overwriting env vars provided directly
# https://stackoverflow.com/a/69127685/1467342
eval "$temp_env"

if [[ -z $VITE_BUILD_HASH ]]; then
  export VITE_BUILD_HASH=$(git rev-parse --short HEAD)
fi

if [[ $VITE_PLATFORM_LOGO =~ ^https:// ]]; then
  curl -fSL "$VITE_PLATFORM_LOGO" -o static/logo.png
  export VITE_PLATFORM_LOGO=static/logo.png

  # @capacitor/assets reads its source logo from assets/, not static/, so
  # propagate a custom platform logo there too for the native app icon/splash
  cp "$VITE_PLATFORM_LOGO" assets/logo.png
  cp "$VITE_PLATFORM_LOGO" assets/logo-dark.png
fi

# Ensure generator uses local path (dotenv may have loaded URL from .env)
VITE_PLATFORM_LOGO="${VITE_PLATFORM_LOGO}" npx pwa-assets-generator
npx vite build

# Replace index.html variables with stuff from our env
perl -i -pe"s|{DESCRIPTION}|$VITE_PLATFORM_DESCRIPTION|g" build/index.html
perl -i -pe"s|{ACCENT}|$VITE_PLATFORM_ACCENT|g" build/index.html
perl -i -pe"s|{NAME}|$VITE_PLATFORM_NAME|g" build/index.html
perl -i -pe"s|{URL}|$VITE_PLATFORM_URL|g" build/index.html
