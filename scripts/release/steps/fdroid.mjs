import {cp, mkdtemp, readFile, rm} from "node:fs/promises"
import {tmpdir} from "node:os"
import {join} from "node:path"
import {git, root, version, versionCode} from "../lib/context.mjs"
import {fdroidPackage, packageToken, unsignedApk} from "../lib/fdroid.mjs"
import {installed, run} from "../lib/shell.mjs"

const docker = process.env.DOCKER || "docker"

export default {
  name: "fdroid",
  title: "Build the tag the way F-Droid will, and upload the unsigned apk",
  missing: () => [
    ...(git("cat-file", "-e", `${version}:scripts/fdroid/reproduce.sh`) === undefined
      ? [`F-Droid support in the ${version} tag`]
      : []),
    ...(installed(docker) ? [] : [docker]),
    ...(packageToken ? [] : ["GITEA_PACKAGE_TOKEN or GITEA_TOKEN"]),
  ],
  setup: [
    `The ${version} tag is older than scripts/fdroid/reproduce.sh, so it can't be built the way`,
    "F-Droid builds it. The build runs in F-Droid's buildserver image, which needs docker. The",
    "token needs the write:package scope.",
  ],
  run: async () => {
    const work = await mkdtemp(join(tmpdir(), "flotilla-fdroid-"))
    const container = `flotilla-fdroid-${process.pid}`

    // Copied in and out rather than mounted, like the desktop packages, for runners that share
    // the host's docker socket
    try {
      await cp(join(root, "scripts/fdroid/reproduce.sh"), join(work, "reproduce.sh"))
      await cp(join(root, "fdroid/metadata/social.flotilla.fdroid.yml"), join(work, "recipe.yml"))
      await run(docker, [
        "create",
        "--name",
        container,
        "--platform",
        "linux/amd64",
        "--env",
        `VERSION=${version}`,
        "--env",
        `VERSION_CODE=${versionCode}`,
        "--env",
        `COMMIT=${git("rev-parse", `${version}^{commit}`)}`,
        "registry.gitlab.com/fdroid/fdroidserver:buildserver-trixie",
        "bash",
        "/work/reproduce.sh",
      ])
      await run(docker, ["cp", `${work}/.`, `${container}:/work`])
      await run(docker, ["start", "--attach", container])
      await run(docker, ["cp", `${container}:/work/unsigned.apk`, join(work, unsignedApk)])

      const url = await fdroidPackage(packageToken).upload(
        unsignedApk,
        await readFile(join(work, unsignedApk)),
      )

      console.log(url)
    } finally {
      await run(docker, ["rm", "--force", container], {stdio: "ignore"}).catch(() => {})
      await rm(work, {recursive: true, force: true})
    }
  },
}
