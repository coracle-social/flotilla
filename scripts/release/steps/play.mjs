import {readFile} from "node:fs/promises"
import {join, resolve} from "node:path"
import {gradle, keystoreEnv} from "../lib/android.mjs"
import {followUps, missingEnv, notes, root, version} from "../lib/context.mjs"
import {uploadToPlay} from "../lib/play.mjs"

export default {
  name: "play",
  title: "Build the AAB and upload it to Google Play",
  missing: () =>
    missingEnv(
      "PLAY_KEYSTORE_PATH",
      "PLAY_KEYSTORE_PASSWORD",
      "PLAY_KEYSTORE_ALIAS",
      "PLAY_SERVICE_ACCOUNT",
    ),
  setup: [
    "PLAY_KEYSTORE_PATH, PLAY_KEYSTORE_PASSWORD, PLAY_KEYSTORE_ALIAS (and",
    "PLAY_KEYSTORE_ALIAS_PASSWORD) are the upload key Android Studio has been signing with.",
    "PLAY_SERVICE_ACCOUNT is the path to a service account json:",
    "  1. Play Console -> Setup -> API access, link or create a Google Cloud project",
    "  2. Create a service account there, then grant it the Release manager role on this app",
    "  3. Google Cloud -> that service account -> Keys -> Add key -> JSON, save it outside the repo",
    "PLAY_TRACK (default production) and PLAY_STATUS (default draft) are optional.",
  ],
  run: async () => {
    await gradle("bundleRelease", keystoreEnv("PLAY"))

    const gradleConfig = await readFile(join(root, "android/app/build.gradle"), "utf-8")
    const track = process.env.PLAY_TRACK ?? "production"
    const status = process.env.PLAY_STATUS ?? "draft"
    const versionCode = await uploadToPlay({
      credentials: JSON.parse(
        await readFile(resolve(root, process.env.PLAY_SERVICE_ACCOUNT), "utf-8"),
      ),
      packageName: gradleConfig.match(/applicationId "(.+)"/)[1],
      bundle: await readFile(
        join(root, "android/app/build/outputs/bundle/release/app-release.aab"),
      ),
      track,
      status,
      // Play rejects release notes over 500 characters
      notes: notes.slice(0, 500),
    })

    followUps.push(
      `Play Console: ${version} (${versionCode}) is a ${status} release on the ${track} track, review and roll it out at https://play.google.com/console`,
    )
  },
}
