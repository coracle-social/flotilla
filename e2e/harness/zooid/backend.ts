import {chmod, cp, readdir, rm} from "node:fs/promises"
import {tmpdir} from "node:os"
import {join} from "node:path"
import {fileURLToPath} from "node:url"
import {composeLogs, hasImage, makeCompose, pullImage} from "../relay/docker"
import type {Backend} from "../relay/types"

// Pinned by digest so a spec runs against one zooid. ZOOID_IMAGE is how an unreleased build is tried.
const image =
  process.env.ZOOID_IMAGE ??
  "gitea.coracle.social/coracle/zooid:latest@sha256:7950843900cbb1c7c1f17de5524f6999badd1002cde94476855e90e67e0f2248"

const configSource = fileURLToPath(new URL("docker/config", import.meta.url))

// zooid saves a relay's toml back on a nip-86 edit, so it is handed a copy rather than the repo's.
const configDir = join(tmpdir(), "flotilla-e2e-zooid-config")

const compose = makeCompose(fileURLToPath(new URL("docker/compose.yaml", import.meta.url)), {
  ZOOID_CONFIG: configDir,
  ZOOID_IMAGE: image,
})

/** zooid serves a relay per toml in docker/config, bound to the Host header that toml names. */
export const zooid: Backend = {
  name: "zooid",
  prepare: async () => {
    if (!(await hasImage(image))) {
      await pullImage(image, "ZOOID_IMAGE")
    }
  },
  // Storage is tmpfs with no volume mounted for it, so a new container is a new database.
  up: async () => {
    // A fresh copy restores metadata a test edited through nip-86, and the container runs as uid 65532.
    await rm(configDir, {recursive: true, force: true})
    await cp(configSource, configDir, {recursive: true})
    await chmod(configDir, 0o777)

    for (const name of await readdir(configDir)) {
      await chmod(join(configDir, name), 0o666)
    }

    await compose("up", "-d", "--force-recreate", "--wait")
  },
  down: async () => {
    await compose("down")
  },
  logs: () => composeLogs(compose),
}
