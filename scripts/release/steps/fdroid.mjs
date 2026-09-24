import {existsSync} from "node:fs"
import {mkdtemp, rm} from "node:fs/promises"
import {tmpdir} from "node:os"
import {join} from "node:path"
import {git, root, version} from "../lib/context.mjs"
import {run} from "../lib/shell.mjs"

export default {
  name: "fdroid",
  title: "Rebuild the tag the way F-Droid will",
  missing: () =>
    git("cat-file", "-e", `${version}:scripts/fdroid/prepare.sh`) === undefined
      ? [`F-Droid support in the ${version} tag`]
      : [],
  setup: [
    `The ${version} tag is older than scripts/fdroid/, so there is nothing for F-Droid to build`,
    "from it. Name the steps you do want, or release a tag that has it.",
  ],
  run: async () => {
    const parent = await mkdtemp(join(tmpdir(), "flotilla-fdroid-"))
    const checkout = join(parent, "flotilla")

    // Preparation rewrites source and dependencies in place, so it only runs against a checkout
    // that can be thrown away
    try {
      await run("git", ["worktree", "add", "--detach", checkout, version], {cwd: root})
      await run("./scripts/fdroid/prepare.sh", [], {cwd: checkout})
      await run("./scripts/fdroid/build.sh", [], {cwd: checkout})

      // F-Droid signs its own builds, so keep the distribution key out of gradle's environment
      const env = {...process.env}

      delete env.ANDROID_KEYSTORE_PATH

      await run("./gradlew", ["--no-daemon", "assembleFdroidRelease"], {
        cwd: join(checkout, "android"),
        env,
      })

      const built = join(
        checkout,
        "android/app/build/outputs/apk/fdroid/release/app-fdroid-release-unsigned.apk",
      )

      if (!existsSync(built)) {
        throw new Error(`the F-Droid build produced no apk at ${built}`)
      }
    } finally {
      await rm(parent, {recursive: true, force: true})
      await run("git", ["worktree", "prune"], {cwd: root})
    }
  },
}
