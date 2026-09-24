import {existsSync} from "node:fs"
import {readFile} from "node:fs/promises"
import {dirname, join, resolve} from "node:path"
import {apk, root, version} from "./context.mjs"
import {run} from "./shell.mjs"

export const keystoreEnv = prefix => ({
  ANDROID_KEYSTORE_PATH: resolve(root, process.env[`${prefix}_KEYSTORE_PATH`]),
  ANDROID_KEYSTORE_PASSWORD: process.env[`${prefix}_KEYSTORE_PASSWORD`],
  ANDROID_KEYSTORE_ALIAS: process.env[`${prefix}_KEYSTORE_ALIAS`],
  ANDROID_KEYSTORE_ALIAS_PASSWORD:
    process.env[`${prefix}_KEYSTORE_ALIAS_PASSWORD`] ?? process.env[`${prefix}_KEYSTORE_PASSWORD`],
})

// A fresh jvm per build, so a reused daemon can't hand one gradle run the other's signing key
export const gradle = (task, signing) =>
  run("./gradlew", ["--no-daemon", task], {
    cwd: join(root, "android"),
    env: {...process.env, ...signing},
  })

// Gradle records what it actually built beside the apk, the only version stamp on an artifact
// whose filename never changes
export const apkMetadata = async () => {
  const path = join(dirname(apk), "output-metadata.json")

  if (!existsSync(path)) {
    throw new Error(`${path} is missing; run pnpm release:local apk`)
  }

  const {elements} = JSON.parse(await readFile(path, "utf-8"))
  const [element] = elements

  if (element.versionName !== version) {
    throw new Error(`the last android build was ${element.versionName}, not ${version}`)
  }

  return element
}
