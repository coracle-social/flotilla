import {existsSync} from "node:fs"
import {readFile, readdir} from "node:fs/promises"
import {join} from "node:path"
import {apkMetadata} from "../lib/android.mjs"
import {
  apk,
  followUps,
  missingEnv,
  name,
  notes,
  repository,
  root,
  version,
} from "../lib/context.mjs"
import {gitea} from "../lib/gitea.mjs"
import {dim} from "../lib/shell.mjs"

const desktopDist = join(root, "electron/dist")

// Gitea's latest release is the desktop update feed, so it only goes public once every platform's
// manifest is on it
const desktopManifests = ["latest.yml", "latest-linux.yml", "latest-mac.yml"]

const packagedDesktop = async () => {
  const files = existsSync(desktopDist) ? await readdir(desktopDist) : []
  const manifests = []

  // Manifest names carry no version, so a leftover from an older build is told apart by its contents
  for (const file of files.filter(file => desktopManifests.includes(file))) {
    const text = await readFile(join(desktopDist, file), "utf-8")

    if (text.match(/^version: '?([^'\s]+)'?$/m)?.[1] === version) {
      manifests.push({
        file,
        urls: [...text.matchAll(/^\s*- url: '?(.+?)'?$/gm)].map(match => match[1]),
      })
    }
  }

  return {
    artifacts: files.filter(
      file => file.includes(version) && /\.(dmg|zip|AppImage|exe|blockmap)$/.test(file),
    ),
    manifests,
  }
}

export default {
  name: "gitea",
  title: "Publish the gitea release and attach the artifacts",
  missing: () => missingEnv("GITEA_TOKEN"),
  setup: [
    `Generate an access token at ${repository.origin}/user/settings/applications with the`,
    "write:repository scope, and set GITEA_TOKEN in .env.local.",
  ],
  run: async () => {
    const api = gitea({repository, token: process.env.GITEA_TOKEN})

    if (!(await api.hasTag(version))) {
      throw new Error(`${repository} has no ${version} tag; push it before publishing`)
    }

    if (existsSync(apk)) {
      await apkMetadata()
    }

    const apkName = `${name}-${version}.apk`
    const {artifacts, manifests} = await packagedDesktop()
    const files = [
      ...(existsSync(apk) ? [[apk, apkName]] : []),
      ...artifacts.map(file => [join(desktopDist, file), file]),
    ]

    if (files.length + manifests.length === 0) {
      throw new Error("Nothing to attach; build the apk or the desktop packages first")
    }

    const release = await api.upsertRelease(version, notes)
    const attach = async (path, filename) =>
      console.log(dim(`  ${await api.attach(release.id, filename, await readFile(path))}`))

    for (const [path, filename] of files) {
      await attach(path, filename)
    }

    // An updater acts on a manifest the moment it can read one, so what it points to goes up first
    const attached = await api.assetNames(release.id)

    for (const {file, urls} of manifests) {
      const absent = urls.filter(url => !attached.includes(url))

      if (absent.length > 0) {
        throw new Error(`${file} points to ${absent.join(", ")}, which the release doesn't have`)
      }

      await attach(join(desktopDist, file), file)
    }

    if (release.draft) {
      const names = await api.assetNames(release.id)
      const missing = [apkName, ...desktopManifests].filter(file => !names.includes(file))

      if (missing.length > 0) {
        followUps.push(
          `Gitea: ${version} stays a draft until it has ${missing.join(", ")}, and whichever release run attaches the last of them publishes it`,
        )
      } else {
        await api.publish(release.id)
      }
    }
  },
}
