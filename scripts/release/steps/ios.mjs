import {readdir} from "node:fs/promises"
import {join, resolve} from "node:path"
import {uploadToAppStore} from "../lib/appstore.mjs"
import {followUps, missingEnv, root} from "../lib/context.mjs"
import {run} from "../lib/shell.mjs"

export default {
  name: "ios",
  title: "Archive the iOS app and upload it to App Store Connect",
  missing: () => [
    ...(process.platform === "darwin" ? [] : ["macOS with Xcode"]),
    ...missingEnv("ASC_KEY_ID", "ASC_ISSUER_ID", "ASC_KEY_PATH"),
  ],
  setup: [
    "App Store Connect -> Users and Access -> Integrations -> App Store Connect API, generate a",
    "team key with the App Manager role. Download the .p8 (only offered once), keep it outside",
    "the repo, and set ASC_KEY_ID, ASC_ISSUER_ID and ASC_KEY_PATH in .env.local.",
  ],
  run: async () => {
    await run("npx", ["cap", "build", "ios"], {cwd: root})

    const directory = join(root, "ios/App/output")
    const ipa = (await readdir(directory)).find(file => file.endsWith(".ipa"))

    if (!ipa) {
      throw new Error(`No ipa was exported to ${directory}`)
    }

    await uploadToAppStore({
      ipa: join(directory, ipa),
      keyId: process.env.ASC_KEY_ID,
      issuerId: process.env.ASC_ISSUER_ID,
      keyPath: resolve(root, process.env.ASC_KEY_PATH),
    })

    followUps.push(
      "App Store Connect: once the build finishes processing, add it to a version and submit for review at https://appstoreconnect.apple.com",
    )
  },
}
