import {rename} from "node:fs/promises"
import {dirname, join} from "node:path"
import {apkMetadata, gradle, keystoreEnv} from "../lib/android.mjs"
import {apk, missingEnv} from "../lib/context.mjs"

export default {
  name: "apk",
  title: "Build the APK, signed with the distribution key",
  missing: () =>
    missingEnv("ANDROID_KEYSTORE_PATH", "ANDROID_KEYSTORE_PASSWORD", "ANDROID_KEYSTORE_ALIAS"),
  setup: [
    "Set ANDROID_KEYSTORE_PATH, ANDROID_KEYSTORE_PASSWORD and ANDROID_KEYSTORE_ALIAS in",
    ".env.local (plus ANDROID_KEYSTORE_ALIAS_PASSWORD if the alias has its own password).",
    "This is the key gitea, zapstore and Obtainium updates are signed with, so it has to stay",
    "the same one forever.",
  ],
  run: async () => {
    await gradle("assembleRelease", keystoreEnv("ANDROID"))

    const {outputFile} = await apkMetadata()

    await rename(join(dirname(apk), outputFile), apk)
  },
}
