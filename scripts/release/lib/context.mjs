import {readFile} from "node:fs/promises"
import {join} from "node:path"
import {fileURLToPath} from "node:url"
import {config} from "dotenv"
import {fail, output} from "./shell.mjs"

export const root = fileURLToPath(new URL("../../../", import.meta.url))

config({path: join(root, ".env.local")})

export const {name, version} = JSON.parse(await readFile(join(root, "package.json"), "utf-8"))

const changelog = await readFile(join(root, "CHANGELOG.md"), "utf-8")
const gradleConfig = await readFile(join(root, "android/app/build.gradle"), "utf-8")
const zapstore = await readFile(join(root, "zapstore.yaml"), "utf-8")

const zapstoreField = key => {
  const match = zapstore.match(new RegExp(`^${key}:\\s*(\\S+)\\s*$`, "m"))

  if (!match) {
    fail(`zapstore.yaml is missing ${key}`)
  }

  return match[1]
}

export const repository = new URL(zapstoreField("repository"))
export const apk = join(root, zapstoreField("release_source"))

const lines = changelog.split("\n")
const heading = lines.indexOf(`# ${version}`)
const remainder = heading < 0 ? [] : lines.slice(heading + 1)
const nextHeading = remainder.findIndex(line => line.startsWith("# "))

export const notes = (nextHeading < 0 ? remainder : remainder.slice(0, nextHeading))
  .join("\n")
  .trim()

export const versionCode = Number(gradleConfig.match(/versionCode (\d+)/)[1])

// Play and F-Droid both cap release notes at 500 characters, so cut at the last whole line under it
const noteLines = notes.split("\n")

while (noteLines.join("\n").length > 500) {
  noteLines.pop()
}

export const shortNotes = noteLines.join("\n")

export const fastlaneChangelog = join(
  root,
  `fastlane/metadata/android/en-US/changelogs/${versionCode}.txt`,
)

export const git = (...gitArgs) => {
  try {
    return output("git", gitArgs, {cwd: root, stdio: ["ignore", "pipe", "ignore"]})
  } catch {
    return undefined
  }
}

export const missingEnv = (...keys) => keys.filter(key => !process.env[key])

export const followUps = []
