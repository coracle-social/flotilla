import {existsSync, readFileSync, readdirSync} from "node:fs"
import {mkdtemp, readFile, rm, writeFile} from "node:fs/promises"
import {tmpdir} from "node:os"
import {join} from "node:path"
import {HOUR, MINUTE, ago, ms, now, sleep} from "@welshman/lib"
import {keystoreEnv} from "../lib/android.mjs"
import {missingEnv, root} from "../lib/context.mjs"
import {fdroidPackage, packageToken, signedApk, unsignedApk} from "../lib/fdroid.mjs"
import {output, run} from "../lib/shell.mjs"

const sdk =
  process.env.ANDROID_HOME ??
  readFileSync(join(root, "android/local.properties"), "utf-8").match(/^sdk\.dir=(.+)$/m)?.[1]

const apksigner = () => {
  const tools = join(sdk, "build-tools")
  const [latest] = readdirSync(tools).sort((a, b) => b.localeCompare(a, "en", {numeric: true}))

  return join(tools, latest, "apksigner")
}

export default {
  name: "fdroid-sign",
  title: "Sign the release workflow's F-Droid build with the distribution key",
  missing: () => [
    ...missingEnv("ANDROID_KEYSTORE_PATH", "ANDROID_KEYSTORE_PASSWORD", "ANDROID_KEYSTORE_ALIAS"),
    ...(packageToken ? [] : ["GITEA_TOKEN"]),
    ...(sdk && existsSync(join(sdk, "build-tools")) ? [] : ["the Android SDK's build-tools"]),
  ],
  setup: [
    "Signs with the same ANDROID_KEYSTORE_* key as the apk step. GITEA_TOKEN needs the",
    "write:package scope. apksigner comes from the Android SDK in ANDROID_HOME, or the sdk.dir",
    "Android Studio writes to android/local.properties.",
  ],
  run: async () => {
    const api = fdroidPackage(packageToken)
    const started = now()
    let unsigned = await api.download(unsignedApk)

    while (!unsigned) {
      if (started < ago(2 * HOUR)) {
        throw new Error(
          `The release workflow hasn't uploaded ${api.url(unsignedApk)} after two hours`,
        )
      }

      console.log(`Waiting for the release workflow to upload ${unsignedApk}`)
      await sleep(ms(MINUTE))
      unsigned = await api.download(unsignedApk)
    }

    const work = await mkdtemp(join(tmpdir(), "flotilla-fdroid-sign-"))

    try {
      const signing = keystoreEnv("ANDROID")

      await writeFile(join(work, unsignedApk), unsigned)

      // F-Droid copies this signature onto its own build, so nothing but the signature may change
      await run(
        apksigner(),
        [
          "sign",
          "--ks",
          signing.ANDROID_KEYSTORE_PATH,
          "--ks-key-alias",
          signing.ANDROID_KEYSTORE_ALIAS,
          "--ks-pass",
          "env:ANDROID_KEYSTORE_PASSWORD",
          "--key-pass",
          "env:ANDROID_KEYSTORE_ALIAS_PASSWORD",
          "--alignment-preserved",
          "--out",
          join(work, signedApk),
          join(work, unsignedApk),
        ],
        {env: {...process.env, ...signing}},
      )

      const recipe = readFileSync(join(root, "fdroid/metadata/social.flotilla.fdroid.yml"), "utf-8")
      const allowed = recipe.match(/^AllowedAPKSigningKeys: (\w+)$/m)[1]
      const certificates = output(apksigner(), ["verify", "--print-certs", join(work, signedApk)])

      if (!certificates.includes(`certificate SHA-256 digest: ${allowed}`)) {
        throw new Error(`${signedApk} isn't signed with the key the recipe allows, ${allowed}`)
      }

      console.log(await api.upload(signedApk, await readFile(join(work, signedApk))))
    } finally {
      await rm(work, {recursive: true, force: true})
    }
  },
}
