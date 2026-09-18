import assert from "node:assert/strict"
import {appendFile, cp, readFile, rm, writeFile} from "node:fs/promises"

const replace = async (file, pattern, replacement) => {
  const source = await readFile(file, "utf8")
  assert.equal([...source.matchAll(pattern)].length, 1, `Expected one match in ${file}`)
  await writeFile(file, source.replace(pattern, replacement))
}

// Drop prebuilt native accelerators with JS fallbacks, including gradle-parse via @capacitor/assets.
await replace(
  "pnpm-workspace.yaml",
  /^overrides:$/gm,
  `overrides:
  nostr-wasm: link:./fdroid/crypto/nostr
  hash-wasm: link:./fdroid/crypto/argon
  cbor-extract: '-'
  '@trapezedev/gradle-parse': '-'`,
)

await cp("fdroid/overlay/analytics.ts", "src/app/analytics.ts")
await cp("fdroid/overlay/capacitor.ts", "src/app/push/adapters/capacitor.ts")
await cp(
  "fdroid/overlay/FallbackSecp256k1Provider.kt",
  "android/app/src/main/java/social/flotilla/notifications/FallbackSecp256k1Provider.kt",
)
for (const target of [
  "android/app/google-services.json",
  "android/app/src/main/assets",
  "android/capacitor-cordova-android-plugins",
  "android/app/build",
  "android/build",
  "android/.gradle",
  "build",
  ".svelte-kit",
  "node_modules",
  "ios",
]) {
  await rm(target, {recursive: true, force: true})
}
await replace(
  "android/build.gradle",
  / {8}classpath 'com\.google\.gms:google-services:[^']+'\n/g,
  "",
)
await replace(
  "android/app/build.gradle",
  / {4}implementation "fr\.acinq\.secp256k1:secp256k1-kmp-jni-android:[^"]+"\n/g,
  "",
)
await replace(
  "android/app/build.gradle",
  /\ntry \{\n {4}def servicesJSON = file\('google-services\.json'\)\n {4}if \(servicesJSON\.text\) \{\n {8}apply plugin: 'com\.google\.gms\.google-services'\n {4}\}\n\} catch\(Exception e\) \{\n {4}logger\.info\("google-services\.json not found, google-services plugin not applied\. Push Notifications won't work"\)\n\}\n/g,
  "\n",
)
await appendFile("android/app/build.gradle", "\napply from: '../../fdroid/app.gradle'\n")
await replace(
  "android/app/src/main/AndroidManifest.xml",
  /\n {8}<!-- FCM uses[\s\S]*?android:value="@string\/default_notification_channel_id"\n {8}\/>/g,
  "",
)
await replace(
  "src/app.html",
  /\s*<script\s+defer\s+data-domain="[^"]*"\s+src="https:\/\/plausible\.coracle\.social\/[^"]*"><\/script>/g,
  "",
)
await replace("svelte.config.js", /"https:\/\/plausible\.coracle\.social", /g, "")
