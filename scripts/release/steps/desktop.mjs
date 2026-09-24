import {existsSync} from "node:fs"
import {join, resolve} from "node:path"
import {followUps, missingEnv, root} from "../lib/context.mjs"
import {installed, run} from "../lib/shell.mjs"

const targets = {darwin: ["macos"], linux: ["linux", "windows"]}[process.platform] ?? []
const docker = process.env.DOCKER || "docker"

export default {
  name: "desktop",
  title: "Package the desktop app",
  missing: () => [
    ...(targets.length > 0 ? [] : [`desktop packaging on ${process.platform}`]),
    ...(existsSync(join(root, "electron/node_modules")) ? [] : ["electron dependencies"]),
    ...(targets.includes("windows") && !installed(docker) ? [docker] : []),
    ...(targets.includes("macos")
      ? missingEnv("CSC_NAME", "ASC_KEY_ID", "ASC_ISSUER_ID", "ASC_KEY_PATH")
      : []),
  ],
  setup: [
    "Run npm ci --prefix electron. A Mac packages the macOS app, and Linux the Linux and Windows",
    "ones, which the release workflow does for every tag. Linux builds the Windows installer in a",
    "container, which needs docker, or set DOCKER=podman in .env.local.",
    "macOS only installs updates to a signed app, so macOS packages are signed and notarized:",
    "set CSC_NAME to the name of the Developer ID Application certificate in your keychain,",
    "without its prefix, and the ASC_* key the ios step uses notarizes them.",
  ],
  run: async () => {
    for (const target of targets) {
      await run("pnpm", ["run", `package:desktop:${target}`], {
        cwd: root,
        env: {
          ...process.env,
          ...(target === "macos" && {
            APPLE_API_KEY: resolve(root, process.env.ASC_KEY_PATH),
            APPLE_API_KEY_ID: process.env.ASC_KEY_ID,
            APPLE_API_ISSUER: process.env.ASC_ISSUER_ID,
          }),
        },
      })
    }

    followUps.push(
      targets.includes("macos")
        ? "Desktop: the release workflow packages Linux and Windows for this tag and attaches them"
        : "Desktop: macOS packages have to be built on a Mac with pnpm release:local desktop gitea",
    )
  },
}
