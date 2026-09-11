# Flotilla

A discord-like nostr client based on the idea of "relays as groups".

If you would like to be interoperable with Flotilla, please check out this guide: https://habla.news/u/hodlbod@coracle.social/1741286140797

## Environment

You can also optionally create an `.env.local` file and populate it with the following environment variables (see `.env.template` for examples):

**Platform branding**
- `VITE_PLATFORM_URL` - The url where the app will be hosted
- `VITE_PLATFORM_NAME` - The name of the app
- `VITE_PLATFORM_LOGO` - A logo url for the app. Can be a local path or https link. Must be a PNG file.
- `VITE_PLATFORM_ACCENT` - A hex color for the app's accent color (used only for generated manifest, for more control create a custom theme file)
- `VITE_PLATFORM_DESCRIPTION` - A description of the app
- `VITE_PLATFORM_TERMS` - URL to your terms of service page
- `VITE_PLATFORM_PRIVACY` - URL to your privacy policy page
- `VITE_PLATFORM_LOGEE` - A hex pubkey which will receive logs users send from their privacy settings

**Platform mode**
- `VITE_PLATFORM_RELAYS` - A comma-separated list of relay urls that will make flotilla operate in "platform mode". Disables all space browse/add/select functionality and makes the first platform relay the home page.

**Defaults**
- `VITE_DEFAULT_PUBKEYS` - A comma-separated list of hex pubkeys for bootstrapping web of trust
- `VITE_DEFAULT_SPACES` - A comma-separated list of relay urls that new users will be automatically joined to on signup. Each one may optionally include an invite code, delimited by `|`, e.g. `my.space.com|CODE`.
- `VITE_DEFAULT_RELAYS` - A comma-separated list of relay urls used as default outbox/inbox relays
- `VITE_DEFAULT_MESSAGING_RELAYS` - A comma-separated list of relay urls used for encrypted direct messages
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

See [CONTRIBUTING.md](CONTRIBUTING.md).

### Desktop development (Linux)

The Electron target is a development baseline. It has no supported installers,
release pipeline, packaging configuration, or auto-update setup.

**Use disposable accounts only.** The current secure-storage plugin falls back to
unencrypted `localStorage` on desktop. This is not secure desktop credential or
private-key storage. OS-protected secret storage is required before distribution.

Install the root dependencies with pnpm and the Electron subproject with npm,
following the platform's documented setup. Installing that subproject separately avoids
downloading Electron for ordinary web/mobile installs:

```sh
pnpm install --frozen-lockfile
npm ci --prefix electron
pnpm run dev:desktop
```

`dev:desktop` starts Vite in development mode on `127.0.0.1`, then runs the
Capawesome Electron platform against that server with the Capacitor plugin bridge
and frontend HMR. No previous frontend build is needed. It uses the existing Vite
port (1847 by default) and fails if the port is occupied. Quit another desktop
instance before switching modes; the platform allows one instance at a time.
Restart the command after editing Electron TypeScript. Quit Electron or press
Ctrl+C to stop the development environment.

To build and run local production assets instead:

```sh
pnpm run build:desktop
pnpm run start:desktop
```

`build:desktop` builds the frontend without PWA/service-worker registration,
synchronizes the Electron platform, and compiles its TypeScript entrypoint. It uses
the same branding environment as the web build and does not synchronize Android
or iOS. The existing build scripts require Bash, Perl, and their usual asset tools.
`start:desktop` opens the last build without Vite; rerun `build:desktop` after
frontend changes. The development URL is supplied only to the desktop run process.
Capawesome records it in ignored generated configuration during development;
production synchronization removes it, and local startup ignores inherited dev URLs.

Run `pnpm run test:desktop` after building to check the Linux desktop window. On a
headless Linux runner, use `xvfb-run -a pnpm run test:desktop`; Electron links
against GTK, which Playwright's chromium dependencies do not cover, so such a box
also needs `libgtk-3-0t64`. The test drops Chromium's sandbox when it runs as
root, because Chromium refuses to start that way. The separate smoke
suite does not start a web dev server or test installers. Windows and macOS desktop
behavior is not verified by the Linux test. CI does not run it.

When changing the desktop workflow, also verify `dev:desktop` in a disposable
checkout: change existing Svelte source and confirm HMR preserves a marker set on
`window` in DevTools, then restore the file. Check navigation, reload, blob workers,
and recovery after reloading while Vite restarts. Verify that Ctrl+C and quitting
Electron release the server port and leave no child processes, including on startup
failure or a TypeScript error. Finally stop development, rebuild, and confirm
`start:desktop` loads local assets with no Vite connection. These runtime checks
are separate from CI's lint and Electron TypeScript checks.

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
