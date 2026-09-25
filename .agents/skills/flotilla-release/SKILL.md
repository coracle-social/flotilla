---
name: flotilla-release
description: "Use this skill when cutting, publishing, or debugging a flotilla release, or when changing anything under scripts/release, scripts/fdroid, scripts/desktop, fastlane/, fdroid/, zapstore.yaml or .gitea/workflows. It covers the version bump, changelog, tagging, the local and CI release runs, every distribution target (container image, gitea release and desktop update feed, Obtainium, zapstore, Google Play, App Store, F-Droid with reproducible builds, the GitHub mirror), the credentials each needs, and a release checklist with the mistakes that have bitten before."
---

# Releasing flotilla

A release is one version tag and two runs against it. `pnpm release:local`, on a Mac, does everything that needs a signing key, so no key ever sits on the server. Pushing the tag starts `.gitea/workflows/release.yml`, which does everything that needs only a gitea token: the container image, the Linux and Windows desktop packages, and F-Droid's build. Both runs attach to the same draft gitea release, and whichever attaches the last required file publishes it.

## Where each target ships from

| target | built by | ships to | finished by |
| --- | --- | --- | --- |
| Web / self-hosting | `image` job in `release.yml` | `gitea.coracle.social/coracle/flotilla:<version>` and `:latest` | automatic |
| Android APK | `apk` step, distribution key | `flotilla-<version>.apk` on the gitea release | automatic |
| Obtainium | the gitea release (and its GitHub copy) | users' Obtainium, by source url | automatic |
| zapstore | `zapstore` step, `zsp` | zapstore relays | automatic |
| Google Play | `play` step, upload key | a `draft` release on the `production` track | rolling it out in Play Console |
| iOS | `ios` step | build uploaded and attached to the App Store version, with What's New | submitting for review in App Store Connect |
| macOS | `desktop` step on the Mac, signed and notarized | gitea release + `latest-mac.yml` | automatic |
| Linux, Windows | `desktop` step in CI (Windows in the `electronuserland/builder` container) | gitea release + `latest-linux.yml`, `latest.yml` | automatic |
| F-Droid | `fdroid` (CI) builds unsigned, `fdroid-sign` (local) signs | `flotilla-fdroid` generic package on gitea, which F-Droid verifies its own build against | F-Droid's bot, from the tag |
| GitHub mirror | `mirror.yml` | tags on push, the latest published release every 3 hours | automatic |

Gitea's latest release is the desktop update feed, so a release stays a draft, hidden from updaters and Obtainium, until it has the APK and all three `latest*.yml` manifests.

## Layout

- `scripts/release/local.mjs` and `ci.mjs` list their steps; each step is a module in `scripts/release/steps/` with `missing()` (preflight), `setup` (how to fix it) and `run()`.
- `scripts/release/lib/pipeline.mjs` checks everything before anything runs: the tag exists, is pushed and is HEAD; `CHANGELOG.md` has a section for the version; the fastlane changelog matches it; `node_modules` matches `pnpm-lock.yaml`; and each step's credentials and tools. `--check` stops there. A failed step prints the command to resume from it.
- `lib/context.mjs` reads the version from `package.json`, the version code from `android/app/build.gradle`, and the notes from `CHANGELOG.md`. `shortNotes` is the notes cut at the last whole line under 500 characters, for Play and F-Droid.
- `scripts/release/bump.mjs` (`pnpm bump`) sets the version in `package.json`, Android and iOS, bumping each platform's build number only when its marketing version changes.
- `scripts/release/github.mjs` copies gitea's latest release to GitHub, run by `mirror.yml`.
- `scripts/fdroid/reproduce.sh` is F-Droid's build, run in their buildserver image; `fdroid/metadata/social.flotilla.fdroid.yml` is the recipe, mirrored in fdroiddata.
- `fastlane/metadata/android/en-US/` is F-Droid's listing, read from the tag.

The steps are safe to rerun. `play` finishes a release from a bundle Play already has when the local AAB is byte-identical to it, `ios` reuses a build number App Store Connect already has and leaves an already-submitted version alone, `gitea` replaces same-named assets, and the GitHub copy skips files whose size matches.

## Credentials

Local ones go in `.env.local`; `pnpm release:check` names whatever is missing and how to get it.

| variable | used by |
| --- | --- |
| `GITEA_TOKEN` (`write:repository`, `write:package`) | `gitea`, `fdroid-sign` |
| `ANDROID_KEYSTORE_*` | `apk`, `fdroid-sign`; the distribution key, which can never change |
| `PLAY_KEYSTORE_*`, `PLAY_SERVICE_ACCOUNT` | `play` |
| `ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_KEY_PATH` | `ios`, and notarizing macOS |
| `CSC_NAME` | `desktop` on macOS (Developer ID Application certificate) |
| `SIGN_WITH` | `zapstore` |
| `DOCKER` | optional, e.g. `podman`, for container builds run from the Mac |

CI uses the job's own token for the release, and the `PACKAGE_TOKEN` and `GH_MIRROR_TOKEN` secrets for the container registry and F-Droid package, and for GitHub.

## Checklist

### Before tagging

- [ ] `git pull` on dev, then `pnpm install --frozen-lockfile` and `npm ci --prefix electron`. The release refuses stale dependencies; building against them once shipped Capacitor 8.3.4 native code with 8.5.2 Swift.
- [ ] `pnpm bump patch` (or `minor`, `major`, `x.y.z`). Always pass the argument.
- [ ] Write the `# <version>` section of `CHANGELOG.md`. The first ~500 characters are what Play and F-Droid show, so lead with what matters.
- [ ] `pnpm release:changelog` to write `fastlane/.../changelogs/<versionCode>.txt`.
- [ ] New F-Droid screenshots or listing text, if the UI changed, go in `fastlane/` now; F-Droid only reads them from the tag.
- [ ] If the F-Droid build environment changed (Node major in `.nvmrc`, the JDK, the fdroid scripts), update the recipe in `fdroid/metadata/` and open an fdroiddata merge request with the same change.
- [ ] `git add -A && git commit`, `pnpm release:check`, then `git tag <version>` and `git push origin dev <version>`.

### Releasing

- [ ] Start `pnpm release:local` once the tag is pushed. `fdroid-sign` waits for CI's F-Droid build, up to two hours.
- [ ] Watch the Release workflow run for the tag in gitea's Actions tab. Its `image` and `release` jobs must both pass.
- [ ] When a step fails, fix the cause and rerun the command the run prints, which resumes from that step.

### After both runs

- [ ] The gitea release is published, not a draft, with `flotilla-<version>.apk`, the macOS DMGs and ZIPs, the AppImage, the Windows installer, and `latest.yml`, `latest-linux.yml`, `latest-mac.yml`.
- [ ] Play Console: review the draft on the production track and roll it out.
- [ ] App Store Connect: submit the version for review once the build is attached.
- [ ] The `flotilla-fdroid` package has `flotilla-fdroid-<version>.apk` for this version.
- [ ] Within three hours, GitHub's latest release is this version, with the APK.
- [ ] Within a few days, F-Droid shows the version. A failed reproducibility check shows up in F-Droid's build logs for `social.flotilla.fdroid`.

## Mistakes that have bitten before

- **Moving a tag publishes its draft.** Force-pushing a tag when a draft release exists for it makes gitea clear the draft flag. It also restarts the Release workflow, which rebuilds the image and replaces the CI-built files. Once F-Droid has built a tag, never move it: F-Droid won't rebuild.
- **Version codes are single-use.** Play and App Store Connect never accept a version code or build number twice. When an upload of the wrong build is already there, bump `versionCode` in `android/app/build.gradle` or `CURRENT_PROJECT_VERSION` in the Xcode project, not the version.
- **The Play service account** needs its app permissions saved in Play Console, and new access can take up to a day to reach the API ("The caller does not have permission").
- **`cap sync` rewrites native files** (`ios/App/Podfile`, `AndroidManifest.xml`, `capacitor.settings.gradle`) during `web`. On stale dependencies it points them at the wrong versions; revert them rather than committing.
- **Uploading a build is not releasing it.** Play stays a draft and iOS waits for review until someone acts on the follow-ups the run prints.
- **The F-Droid recipe lives in two places.** Our CI builds from `fdroid/metadata/`, F-Droid builds from fdroiddata. If they drift, our apk stops matching theirs and F-Droid won't ship it.
