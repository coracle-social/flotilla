import {createHash} from "node:crypto"
import {existsSync} from "node:fs"
import {readFile} from "node:fs/promises"
import {join, resolve} from "node:path"
import {spec} from "@welshman/lib"
import {gradle, keystoreEnv} from "../lib/android.mjs"
import {followUps, missingEnv, root, shortNotes, version, versionCode} from "../lib/context.mjs"
import {play} from "../lib/play.mjs"

const aab = join(root, "android/app/build/outputs/bundle/release/app-release.aab")

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
    const gradleConfig = await readFile(join(root, "android/app/build.gradle"), "utf-8")
    const track = process.env.PLAY_TRACK ?? "production"
    const status = process.env.PLAY_STATUS ?? "draft"
    const api = await play({
      credentials: JSON.parse(
        await readFile(resolve(root, process.env.PLAY_SERVICE_ACCOUNT), "utf-8"),
      ),
      packageName: gradleConfig.match(/applicationId "(.+)"/)[1],
    })

    // Play never takes a version code twice, so a rerun after an upload goes on to finish the
    // release with that bundle. Rebuilding would change its bytes, so it only counts as this
    // build while the aab on disk is the one that went up.
    const uploaded = (await api.bundles()).find(spec({versionCode}))

    if (uploaded) {
      const local =
        existsSync(aab) &&
        createHash("sha256")
          .update(await readFile(aab))
          .digest("hex")

      if (local !== uploaded.sha256) {
        throw new Error(
          `Play already has version code ${versionCode} from a build that isn't ${aab}; bump versionCode in android/app/build.gradle`,
        )
      }

      console.log(`Play already has version code ${versionCode} from this build, releasing it`)
    } else {
      await gradle("bundleRelease", keystoreEnv("PLAY"))
    }

    await api.release({
      bundle: uploaded ? undefined : await readFile(aab),
      versionCode,
      track,
      status,
      notes: shortNotes,
    })

    followUps.push(
      `Play Console: ${version} (${versionCode}) is a ${status} release on the ${track} track, review and roll it out at https://play.google.com/console`,
    )
  },
}
