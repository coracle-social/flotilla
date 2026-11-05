# F-Droid distribution

F-Droid builds use the application ID `social.flotilla.fdroid`. Preparation removes
Firebase, Google Services, Plausible, and the ACINQ native secp256k1 library.
Welshman's optional `nostr-wasm` accelerator uses its pure JavaScript verifier.
The normal Play/Zapstore build is unchanged.

Background notifications use `AndroidPushFallbackWorker`: WorkManager polls the
configured relays about every 15 minutes and posts local notifications. Android
Doze and background scheduling can delay delivery further.

Pomade login, registration, and key recovery use the JavaScript Argon2 adapter.
With Pomade's parameters (t=3, m=64 MiB, p=2, 32-byte output), a benchmark on a
2-core x86 machine measured 426 ms with `hash-wasm` versus 4.0 s with the adapter,
with matching digests. Physical-device timing has not yet been measured.

## Build

Preparation changes source and dependencies, so run it in a disposable checkout
with the Node, pnpm, Java, Android SDK, and Gradle versions pinned by this repository.

```sh
corepack enable
./scripts/fdroid/prepare.sh
./scripts/fdroid/build.sh
cd android
./gradlew assembleFdroidRelease
```

After preparation and the asset build, run the BouncyCastle key-operation and
BIP-340 vector tests from `android/` with:

```sh
./gradlew :app:testFdroidDebugUnitTest --tests social.flotilla.notifications.FallbackSecp256k1Test
```

`fdroid/app.gradle` registers `fdroid/tests` only in the prepared checkout.

The unsigned APK is written to
`android/app/build/outputs/apk/fdroid/release/app-fdroid-release-unsigned.apk`.
F-Droid should run preparation before its source scan, run the asset build afterward,
and use its configured Gradle runner for `assembleFdroidRelease`.

[`metadata/social.flotilla.fdroid.yml`](metadata/social.flotilla.fdroid.yml) is the recipe to submit
to `fdroiddata`. The listing's text, icon, feature graphic and per-version changelogs come from
`fastlane/metadata/android/en-US/` at the tag F-Droid builds. Preparation installs dependencies
before F-Droid's source scan, so the recipe scan-ignores `node_modules`, which holds FLOSS build
tools such as esbuild and sharp. The recipe installs Node from Debian forky, since the lockfile
needs a pnpm that wants a newer Node than trixie ships, and pins pnpm to `package.json`'s
`packageManager`. Capacitor needs JDK 21, which trixie's `default-jdk-headless` provides, so the
recipe installs no JDK.

## Reproducible builds

F-Droid rebuilds each tag, downloads the apk at the recipe's `Binaries` url, and ships that apk
instead of its own when copying its signature onto F-Droid's build verifies. So the F-Droid app
carries the distribution key, the one `AllowedAPKSigningKeys` names, and can never switch to
F-Droid's key.

The release workflow's `fdroid` step runs `scripts/fdroid/reproduce.sh` in F-Droid's
`buildserver-trixie` image, the way fdroiddata's own CI builds a recipe, against the recipe in
`metadata/` pointed at the tag. It uploads the unsigned apk to the `flotilla-fdroid` generic
package on gitea, and `pnpm release:local fdroid-sign` signs it and uploads the result beside it.
The recipe in `metadata/` is the one both builds read, so a change to it goes to `fdroiddata` too.

## Updates

Stable releases use bare version tags such as `1.9.1`, and the recipe checks tags matching
`^[0-9]+\.[0-9]+\.[0-9]+$` against `versionCode` and `versionName` in
`android/app/build.gradle` at that tag.

## Submitting to fdroiddata

fdroiddata merges a new app's recipe with one build, the version being submitted, so the previous
one is deleted rather than kept beside it. Once the app is merged, `AutoUpdateMode` and
`UpdateCheckMode` let fdroiddata's bot add each new tag and retire old builds on its own.

The merge request's Reports tab annotates the recipe with what fdroidserver found in the built
apk: permissions, cleartext traffic, native libraries per ABI, the signing key, size, the R8
marker, and the fastlane listing. Most of it is informational. What we have had to answer:

- `APK has different libs in different ABI` is settled by `abiFilters` in
  `android/app/build.gradle`, which keeps only the ABIs whose native libraries match: livekit
  ships no 32-bit x86 uniffi library, and JNA's jar also carries armeabi, mips and mips64 copies
  of `libjnidispatch.so`.
- `Cleartext Traffic Permitted` is settled by `android:usesCleartextTraffic="false"`, which costs
  `ws://` relays and `http://` blossom servers.
- The microphone and camera permissions, and the missing JDK, are explained in the recipe's
  `MaintainerNotes`. The recipe installs no JDK because the buildserver image's
  `default-jdk-headless` is openjdk-21, which Capacitor needs. fdroiddata's CI installs JDK 21 on
  the runner before `fdroid build`, so a green pipeline never shows whether the recipe needs one.

Findings belong to the version the recipe builds, so a fix in the app clears them only once the
recipe points at a tag that contains it.

The initial `fdroiddata` submission must still review scanner exceptions for FLOSS
build tools and optional OpenRouter use for a possible `NonFreeNet` declaration.
