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

These values **won't** be used for a built version. Instead, env variables should be provided to `scripts/build.sh` directly or to the built container.

If you're deploying a custom version of flotilla, be sure to remove the `plausible.coracle.social` script from `app.html`. This sends analytics to a server hosted by the developer.

## Development

```sh
pnpm install
pnpm run dev
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for conventions and workflow.

### Desktop development (Linux)

The Electron target and its unsigned packages are for development and testing. Release publishing
and auto-updates are not configured.

**Use disposable accounts only.** The secure-storage plugin falls back to unencrypted
`localStorage` on desktop, so it is not secure credential or private-key storage. Packages must
remain development-only until OS-protected secret storage and release signing are addressed.

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
Vite, so rerun `build:desktop` after frontend changes. The development URL goes only to the desktop
run process. Capawesome records it in ignored generated configuration, and production
synchronization removes it.

Run `pnpm run test:desktop` after building to check the Linux desktop window. On a headless Linux
runner, use `xvfb-run -a pnpm run test:desktop`. Such a runner also needs `libgtk-3-0t64`, since
Playwright's chromium dependencies do not cover the GTK libraries Electron links against. The test
drops Chromium's sandbox when it runs as root, because Chromium refuses to start that way. This
smoke suite does not start a web dev server, and does not run in CI. It verifies nothing about
Windows or macOS.

### Desktop packaging

```sh
pnpm run package:desktop:linux
pnpm run package:desktop:windows
pnpm run package:desktop:macos
```

Each command rebuilds production assets, copies and updates Capacitor, compiles Electron, vendors
its runtime and plugins, and invokes electron-builder without publishing or signing. Outputs land in
`electron/dist/`: a Linux x64 AppImage, a Windows x64 NSIS installer, and separate macOS x64 and
arm64 DMGs. The root package version is authoritative, the Capacitor app ID stays stable, and
`VITE_PLATFORM_NAME` supplies the product name. Vite's `.env.local` overrides apply, and explicit
`VITE_*` environment values take precedence. Use production branding values when building artifacts
for others. `VITE_PLATFORM_LOGO` can be a local or HTTPS image, which packaging resizes to 1024×1024
and stages in ignored output.

Linux packaging requires Linux. Windows packaging from Linux uses the pinned official
`electronuserland/builder` Wine image through Docker, mounting only a temporary copy of the prepared
Electron project. Native addons need a target-OS ABI rebuild and cannot use this cross-build path.
Native Windows preparation needs Bash on PATH, for example Git Bash. DMG creation requires macOS. On
Linux, `pnpm run package:desktop:macos --dir` prepares unsigned bundles for inspection only, and
verifies nothing about the macOS runtime, Gatekeeper, or signing.

To smoke-test a package, run as a non-root user with the sandbox enabled:

```sh
FLOTILLA_DESKTOP_EXECUTABLE="/absolute/path/to/application" pnpm run test:desktop
```

Use the AppImage or installed executable rather than the installer. This checks packaged metadata,
local assets, navigation, workers, and CSP using a disposable profile. Installation, reboot, and
uninstall still require target-OS testing.

## Releasing

`pnpm release` takes a tagged commit and ships it everywhere: the web bundle and native projects,
the signed APK on gitea and zapstore, the AAB on Google Play, the iOS build on App Store Connect,
and the desktop packages. It checks the tag, the changelog section, every credential and every
tool up front, and refuses to start if one of them is missing rather than getting halfway. What's
left — rolling out on Play, submitting for review — comes back as a list when it finishes.

```sh
pnpm bump minor            # or patch, major, or an explicit x.y.z
# write the CHANGELOG.md section for the new version
git commit -am "Bump version"
git tag 1.12.0 && git push origin dev 1.12.0
pnpm release
```

`pnpm release --check` runs those checks and reports the plan without building anything. Naming
steps runs a subset — `pnpm release ios`, or `pnpm release apk gitea`. A step that fails stops the
run and prints the command to pick up from there.

| step | what it does |
| --- | --- |
| `web` | `scripts/build.sh`: web bundle, `cap sync`, generated icons and splash screens |
| `apk` | `assembleRelease` signed with the distribution key, renamed to the path in `zapstore.yaml` |
| `play` | `bundleRelease` signed with the upload key, uploaded to a Play track as a draft |
| `ios` | `cap build ios` to an archive and IPA, uploaded with `altool` |
| `desktop` | `package:desktop:*` for this OS |
| `gitea` | creates the release for the tag from the changelog, attaches the APK and any desktop packages |
| `zapstore` | `zsp publish zapstore.yaml` |
| `fdroid` | nothing to upload; F-Droid builds from the tag, see [fdroid/README.md](fdroid/README.md) |

Release notes come from the `CHANGELOG.md` section matching `package.json`'s version, so every
store shows the same text. The APK and zapstore share one artifact, whose path lives in
`zapstore.yaml`.

### Credentials

These go in `.env.local`, which is gitignored. `pnpm release --check` lists whichever are missing
along with how to get them.

| variable | what it is |
| --- | --- |
| `GITEA_TOKEN` | gitea access token with `write:repository`, from Settings → Applications |
| `ANDROID_KEYSTORE_PATH`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEYSTORE_ALIAS` | the key APKs outside the app stores are signed with; it can never change without breaking updates |
| `PLAY_KEYSTORE_PATH`, `PLAY_KEYSTORE_PASSWORD`, `PLAY_KEYSTORE_ALIAS` | the Play upload key |
| `PLAY_SERVICE_ACCOUNT` | path to a service account json with the Release manager role, from Play Console → Setup → API access |
| `ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_KEY_PATH` | App Store Connect API key with the App Manager role, from Users and Access → Integrations |
| `SIGN_WITH` | nostr key for zapstore: an nsec, a `bunker://` url, or `browser` |

Add `_ALIAS_PASSWORD` to either keystore prefix when the alias has its own password. `PLAY_TRACK`
(default `production`) and `PLAY_STATUS` (default `draft`) choose where a Play upload lands.
Keystores and API keys belong outside the repository; only their paths go in `.env.local`.

Gradle signs from those variables, so Android Studio still opens and builds the project without
them — it just produces an unsigned release build.

### Obtainium

[Obtainium](https://obtainium.imranr.dev/) installs and updates Android apps from their release
pages. Gitea and Forgejo share a release API, so it works against this repository:

- App source URL: `https://gitea.coracle.social/coracle/flotilla`
- Override source: `Forgejo (Codeberg)`

Obtainium reports the git tag as the version.

## Deployment

To run your own Flotilla, it's as simple as:

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
