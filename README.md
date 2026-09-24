<p align="center">
  <img src="static/banner.png" alt="Flotilla" width="640">
</p>

A discord-like nostr client based on the idea of "relays as groups". Supports NIP 29 groups, chat, DMs, threads, calendars, classifieds, zap goals, articles, microblogging, and cross-posting between different contexts.

## Install

- **Web** — [app.flotilla.social](https://app.flotilla.social), installable as a PWA
- **Android** — [Google Play](https://play.google.com/store/apps/details?id=social.flotilla)
- **Android APK** — [releases](https://gitea.coracle.social/coracle/flotilla/releases), see [Releasing](#releasing)
- **iOS** — [App Store](https://apps.apple.com/us/app/flotilla-chat/id6741344107)
- **Your own server** — see [Deployment](#deployment)

Hosted spaces are available at [flotilla.social](https://flotilla.social).

## Features

- Spaces and rooms, threads, direct and group messages
- Voice and video calls
- Calendar events, long-form articles, and polls
- Reactions, custom emoji, zaps, link previews, and media sharing
- Invite codes, member management, bans, roles, and reports
- Push notifications, unread indicators, and per-room mute

If you would like to be interoperable with Flotilla, please check out
[this guide](https://habla.news/u/hodlbod@coracle.social/1741286140797).

## Environment

Create an `.env.local` file to override any of the values in `.env`:

**Platform branding**
- `VITE_PLATFORM_URL` - The url where the app will be hosted
- `VITE_PLATFORM_NAME` - The name of the app
- `VITE_PLATFORM_LOGO` - A logo url for the app. Can be a local path or https link. Must be a PNG file.
- `VITE_PLATFORM_ACCENT` - A hex color for the app's accent color (used only for generated manifest, for more control create a custom theme file)
- `VITE_PLATFORM_DESCRIPTION` - A description of the app
- `VITE_PLATFORM_ABOUT` - URL to your marketing or about page
- `VITE_PLATFORM_TERMS` - URL to your terms of service page
- `VITE_PLATFORM_PRIVACY` - URL to your privacy policy page
- `VITE_PLATFORM_LOGEE` - A hex pubkey which will receive logs users send from their privacy settings
- `VITE_THEME` - The visual preset components are styled with: `clay`, `flat`, or `navy`

**Platform mode**
- `VITE_PLATFORM_RELAYS` - A comma-separated list of relay urls that will make flotilla operate in "platform mode". Disables all space browse/add/select functionality and makes the first platform relay the home page.

**Defaults**
- `VITE_DEFAULT_PUBKEYS` - A comma-separated list of hex pubkeys for bootstrapping web of trust
- `VITE_DEFAULT_SPACES` - A comma-separated list of relay urls that new users will be automatically joined to on signup. Each one may optionally include an invite code, delimited by `|`, e.g. `my.space.com|CODE`.
- `VITE_DEFAULT_RELAYS` - A comma-separated list of relay urls used as default outbox/inbox relays
- `VITE_DEFAULT_MESSAGING_RELAYS` - A comma-separated list of relay urls used for encrypted direct messages
- `VITE_DEFAULT_SEARCH_RELAYS` - A comma-separated list of relay urls used for search
- `VITE_DEFAULT_BLOSSOM_SERVERS` - A comma-separated list of blossom server urls used for file uploads

**Infrastructure**
- `VITE_INDEXER_RELAYS` - A comma-separated list of relay urls used for user profile/key lookup
- `VITE_SIGNER_RELAYS` - A comma-separated list of relay urls used for NIP-55 remote signers
- `VITE_BLOCKED_RELAYS` - A comma-separated list of relay urls that will be blocked
- `VITE_PUSH_SERVER` - URL of the push notification server
- `VITE_PUSH_BRIDGE` - WebSocket URL of the push notification relay bridge
- `VITE_POMADE_SIGNERS` - A comma-separated list of Pomade signer server URLs (3+ required to enable email signup)
- `VITE_THUMBNAIL_URL` - URL of the image thumbnail service

These values **won't** be used for a built version. Instead, env variables should be provided to `scripts/build/app.sh` directly or to the built container.

If you're deploying a custom version of flotilla, be sure to remove the `plausible.coracle.social` script from `app.html`. This sends analytics to a server hosted by the developer.

## Development

```sh
pnpm install
pnpm run dev
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for conventions and workflow.

### Desktop development (Linux)

Desktop secrets are encrypted with the OS keyring or keychain. If protected storage is unavailable
or unreadable, the app warns, keeps secrets in memory until it closes, and leaves the saved file
untouched. Unlocking or configuring the keyring and restarting restores persistence. The app never
uses Linux's insecure `basic_text` backend.

**Use only disposable accounts with unsigned development packages.**

The Electron subproject installs separately, so ordinary web and mobile installs don't download
Electron:

```sh
pnpm install --frozen-lockfile
npm ci --prefix electron
pnpm run dev:desktop
```

`dev:desktop` starts Vite on `127.0.0.1` and runs the Capawesome Electron platform against it, with
the Capacitor plugin bridge and frontend HMR. No previous frontend build is needed. It uses the
existing Vite port (1847 by default) and fails if that port is occupied. The platform allows one
instance at a time, so quit any other desktop instance before switching modes. Restart the command
after editing Electron TypeScript, and quit Electron or press Ctrl+C to stop.

To build and run local production assets instead:

```sh
pnpm run build:desktop
pnpm run start:desktop
```

`build:desktop` builds the frontend without PWA/service-worker registration, synchronizes the
Electron platform, and compiles its TypeScript entrypoint. It uses the same branding environment as
the web build, and does not synchronize Android or iOS. `start:desktop` opens the last build without
Vite, so rerun `build:desktop` after frontend changes.

Run `pnpm run test:desktop` after building to check the Linux desktop window. On a headless Linux
runner, use `xvfb-run -a pnpm run test:desktop`, and install `libgtk-3-0t64`, which Playwright's
Chromium dependencies leave out. The test drops Chromium's sandbox when it runs as root. It does not
start a web dev server, does not run in CI, and verifies nothing about Windows or macOS.

### Desktop packaging

```sh
pnpm run package:desktop:linux
pnpm run package:desktop:windows
pnpm run package:desktop:macos
```

Each command rebuilds production assets, copies and updates Capacitor, compiles Electron, vendors
its runtime and plugins, and runs electron-builder without publishing. Packages land in
`electron/dist/`: a Linux x64 AppImage, a Windows x64 NSIS installer, and macOS x64 and arm64 DMGs
and ZIPs. The version comes from the root `package.json`, the product name from
`VITE_PLATFORM_NAME`, and the Capacitor app ID stays fixed. Vite's `.env.local` overrides apply and
explicit `VITE_*` environment values take precedence, so use production branding when building for
others. `VITE_PLATFORM_LOGO` can be a local or HTTPS image, and packaging resizes it to 1024×1024.

macOS packages are signed and notarized when `CSC_NAME` names a Developer ID Application certificate
in the keychain and `APPLE_API_KEY`, `APPLE_API_KEY_ID` and `APPLE_API_ISSUER` are set. All other
packages are unsigned.

Window and Dock icons use the branding image, including in local runs. On Linux, a packaged app
registers a hidden desktop entry and an icon under `XDG_DATA_HOME` (normally `~/.local/share`) so
Wayland docks can identify it. It leaves existing user and system launchers alone, never writes an
entry from a development run, and updates the entry when an update renames the AppImage. Windows
uses the executable's icon resources.

Linux packaging from macOS and Windows packaging from Linux or macOS use the pinned official
`electronuserland/builder` Wine image through Docker, copying in only a temporary copy of the prepared
Electron project. Set `DOCKER=podman` in `.env.local` to use Podman instead. Native addons need a
target-OS ABI rebuild and cannot use this cross-build path.
Native Windows preparation needs Bash on PATH, for example Git Bash. DMG creation requires macOS. On
Linux, `pnpm run package:desktop:macos --dir` prepares unsigned bundles for inspection only, and
verifies nothing about the macOS runtime, Gatekeeper, or signing.

To smoke-test a package, run as a non-root user with the sandbox enabled:

```sh
FLOTILLA_DESKTOP_EXECUTABLE="/absolute/path/to/application" pnpm run test:desktop
```

Use the AppImage or installed executable rather than the installer. This checks packaged metadata,
local assets, navigation, workers, and CSP using a disposable profile. Installation, reboot, and
uninstall need testing on the target OS.

### Desktop updates

Packaged apps check for an update once at startup, download it, and install it on a normal quit.
There is no update notification or updater UI, and development runs never check. Update errors are
logged and leave the app usable. The feed is Gitea's latest release, set in
`electron/electron-builder.config.mjs`. [Releasing](#releasing) covers how a release fills it.
electron-builder writes `app-update.yml` and the `latest*.yml` manifests beside the installers, even
with `--publish never`. macOS only installs updates to a signed app. Windows and Linux packages
update unsigned.

For local updater QA, use disposable copies with temporary A/B versions and an isolated user-data
directory. In those copies only, point the builder's generic feed at a local HTTP server. Package
both versions and serve B's generated metadata and artifacts. Run AppImage A, wait for B to
download, quit normally, and relaunch the installed AppImage to verify its version and saved state.
Check that preferences, protected secrets, tray controls, and notification activation survive.
Also exercise missing files, interrupted downloads, invalid checksums and versions, and an
already-current version. A failed update must not install. Never bypass integrity checks.
On macOS, build both architectures together and verify the single generated manifest references
both ZIPs with matching hashes. Do not hand-create or merge updater manifests.

## Releasing

A release is two runs against one tag. `pnpm release:local` does everything that needs a signing
key, so those keys never leave your machine: the web bundle and native projects, the signed APK on
gitea and zapstore, the AAB on Google Play, the iOS build on App Store Connect, and the signed and
notarized macOS packages. Pushing the tag starts the release workflow in
`.gitea/workflows/release.yml`, which needs nothing but its own gitea token and the registry's: it
builds the container image as `latest` and the version, checks the F-Droid build, and runs
`pnpm release:ci` to package the Linux and Windows apps.

Both runs check the tag, the changelog section, every credential and every tool up front, and
refuse to start if any is missing. Each finishes with a list of what's left to do by hand, such as
rolling out on Play and submitting for review.

```sh
pnpm bump minor            # or patch, major, or an explicit x.y.z
# write the CHANGELOG.md section for the new version
git commit -am "Bump version"
git tag 1.12.0 && git push origin dev 1.12.0
pnpm release:local
```

`pnpm release:local --check` runs those checks and reports the plan without building anything.
Naming steps runs a subset, such as `pnpm release:local ios` or `pnpm release:local apk gitea`. A
step that fails stops the run and prints the command to pick up from there.

| step | run by | what it does |
| --- | --- | --- |
| `web` | local | `scripts/build/app.sh`: web bundle, `cap sync`, generated icons and splash screens |
| `apk` | local | `assembleRelease` signed with the distribution key, renamed to the path in `zapstore.yaml` |
| `play` | local | `bundleRelease` signed with the upload key, uploaded to a Play track as a draft |
| `ios` | local | `cap build ios` to an archive and IPA, uploaded with `altool` |
| `fdroid` | ci | reruns F-Droid's own preparation and build against the tag in a throwaway worktree |
| `desktop` | both | `package:desktop:*` for this OS: signed and notarized macOS from a Mac, Linux and Windows from Linux |
| `gitea` | both | creates a draft release from the changelog, attaches what this run built, and publishes it once every platform is there |
| `zapstore` | local | `zsp publish zapstore.yaml` |

Gitea's latest release is the desktop update feed, so the release stays a draft, hidden from
updaters and Obtainium, until it has the APK and all three `latest*.yml` manifests. Whichever run
attaches the last of them publishes it. Each manifest is uploaded after the files it lists. A
mobile-only release can't be published, so package the desktop apps for every release.

Release notes come from the `CHANGELOG.md` section matching `package.json`'s version, so every
store shows the same text. The APK and zapstore share one artifact, whose path lives in
`zapstore.yaml`.

F-Droid builds from the tag on its own servers, so the `fdroid` step uploads nothing. It runs
[their preparation and build](fdroid/README.md) against the tag in a throwaway git worktree, and if
that build breaks, the workflow stops before attaching the Linux and Windows packages, which keeps
the release a draft. Preparation patches source
with exact-match replacements, so it breaks quietly when the files it rewrites change. The step is
slow because it installs and builds from scratch.

### Credentials

These go in `.env.local`, which is gitignored. `pnpm release:local --check` lists whichever are missing
along with how to get them.

| variable | what it is |
| --- | --- |
| `GITEA_TOKEN` | gitea access token with `write:repository`, from Settings → Applications |
| `ANDROID_KEYSTORE_PATH`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEYSTORE_ALIAS` | the key APKs outside the app stores are signed with; it can never change without breaking updates |
| `PLAY_KEYSTORE_PATH`, `PLAY_KEYSTORE_PASSWORD`, `PLAY_KEYSTORE_ALIAS` | the Play upload key |
| `PLAY_SERVICE_ACCOUNT` | path to a service account json with the Release manager role, from Play Console → Setup → API access |
| `ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_KEY_PATH` | App Store Connect API key with the App Manager role, from Users and Access → Integrations; also notarizes the macOS app |
| `CSC_NAME` | the Developer ID Application certificate in the keychain that signs the macOS app, without its prefix |
| `SIGN_WITH` | nostr key for zapstore: an nsec, a `bunker://` url, or `browser` |

Add `_ALIAS_PASSWORD` to either keystore prefix when the alias has its own password. `PLAY_TRACK`
(default `production`) and `PLAY_STATUS` (default `draft`) choose where a Play upload lands.
Keystores and API keys belong outside the repository; only their paths go in `.env.local`.

Without the keystore variables, Android Studio still builds the project and produces an unsigned
release build.

### Obtainium

[Obtainium](https://obtainium.imranr.dev/) installs and updates Android apps from their release
pages. Gitea and Forgejo share a release API, so it works against this repository:

- App source URL: `https://gitea.coracle.social/coracle/flotilla`
- Override source: `Forgejo (Codeberg)`

Obtainium reports the git tag as the version.

## Deployment

To run your own Flotilla:

```sh
pnpm install
pnpm run build
pnpm run start
```

Or, if you prefer to use a container:

```sh
docker run -d -p 3000:3000 gitea.coracle.social/coracle/flotilla:latest
```

Alternatively, you can copy the build files into a directory of your choice and serve it yourself:

```sh
mkdir ./mount
docker run -v ./mount:/app/mount gitea.coracle.social/coracle/flotilla:latest bash -c 'cp -r build/* mount'
```

## License

[MIT](LICENSE)
