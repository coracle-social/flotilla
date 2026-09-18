#!/usr/bin/env node
import {existsSync} from "node:fs"
import {readFile, readdir, rename} from "node:fs/promises"
import {dirname, join, resolve} from "node:path"
import {fileURLToPath} from "node:url"
import {parseArgs} from "node:util"
import {config} from "dotenv"
import {uploadToAppStore} from "./release/appstore.mjs"
import {gitea} from "./release/gitea.mjs"
import {uploadToPlay} from "./release/play.mjs"
import {ask, bold, dim, green, installed, output, red, run, yellow} from "./release/shell.mjs"

const root = fileURLToPath(new URL("../", import.meta.url))

config({path: join(root, ".env.local")})

const fail = message => {
  console.error(red(message))
  process.exit(1)
}

let args

try {
  args = parseArgs({
    options: {
      check: {type: "boolean", default: false},
      yes: {type: "boolean", short: "y", default: false},
    },
    allowPositionals: true,
  })
} catch (error) {
  fail(`${error.message}\nUsage: pnpm release [--check] [--yes] [step...]`)
}

const {values: options, positionals: chosen} = args

const {name, version} = JSON.parse(await readFile(join(root, "package.json"), "utf-8"))
const changelog = await readFile(join(root, "CHANGELOG.md"), "utf-8")
const zapstore = await readFile(join(root, "zapstore.yaml"), "utf-8")
const gradleConfig = await readFile(join(root, "android/app/build.gradle"), "utf-8")

const zapstoreField = key => {
  const match = zapstore.match(new RegExp(`^${key}:\\s*(\\S+)\\s*$`, "m"))

  if (!match) {
    fail(`zapstore.yaml is missing ${key}`)
  }

  return match[1]
}

const appId = gradleConfig.match(/applicationId "(.+)"/)[1]
const repository = new URL(zapstoreField("repository"))
const apk = join(root, zapstoreField("release_source"))
const aab = join(root, "android/app/build/outputs/bundle/release/app-release.aab")
const desktopDist = join(root, "electron/dist")

const lines = changelog.split("\n")
const heading = lines.indexOf(`# ${version}`)
const remainder = heading < 0 ? [] : lines.slice(heading + 1)
const nextHeading = remainder.findIndex(line => line.startsWith("# "))
const notes = (nextHeading < 0 ? remainder : remainder.slice(0, nextHeading)).join("\n").trim()

const git = (...gitArgs) => {
  try {
    return output("git", gitArgs, {cwd: root, stdio: ["ignore", "pipe", "ignore"]})
  } catch {
    return undefined
  }
}

const missingEnv = (...keys) => keys.filter(key => !process.env[key])

const keystoreEnv = prefix => ({
  ANDROID_KEYSTORE_PATH: resolve(root, process.env[`${prefix}_KEYSTORE_PATH`]),
  ANDROID_KEYSTORE_PASSWORD: process.env[`${prefix}_KEYSTORE_PASSWORD`],
  ANDROID_KEYSTORE_ALIAS: process.env[`${prefix}_KEYSTORE_ALIAS`],
  ANDROID_KEYSTORE_ALIAS_PASSWORD:
    process.env[`${prefix}_KEYSTORE_ALIAS_PASSWORD`] ?? process.env[`${prefix}_KEYSTORE_PASSWORD`],
})

// A fresh jvm per build, so a reused daemon can't hand one gradle run the other's signing key
const gradle = (task, signing) =>
  run("./gradlew", ["--no-daemon", task], {
    cwd: join(root, "android"),
    env: {...process.env, ...signing},
  })

// Gradle records what it actually built beside the apk, the only version stamp on an artifact
// whose filename never changes
const apkMetadata = async () => {
  const path = join(dirname(apk), "output-metadata.json")

  if (!existsSync(path)) {
    throw new Error(`${path} is missing; run pnpm release apk`)
  }

  const {elements} = JSON.parse(await readFile(path, "utf-8"))
  const [element] = elements

  if (element.versionName !== version) {
    throw new Error(`the last android build was ${element.versionName}, not ${version}`)
  }

  return element
}

const desktopTargets = {darwin: ["macos"], linux: ["linux", "windows"], win32: []}
const desktopTarget = desktopTargets[process.platform]?.[0]

const packagedDesktop = async () =>
  existsSync(desktopDist)
    ? (await readdir(desktopDist)).filter(
        file => file.includes(version) && /\.(dmg|AppImage|exe)$/.test(file),
      )
    : []

const followUps = []

const steps = [
  {
    name: "web",
    title: "Build the web bundle and sync the native projects",
    run: () => run("bash", ["scripts/build.sh"], {cwd: root}),
  },
  {
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
  },
  {
    name: "play",
    title: "Build the AAB and upload it to Google Play",
    missing: () =>
      missingEnv(
        "PLAY_KEYSTORE_PATH",
        "PLAY_KEYSTORE_PASSWORD",
        "PLAY_KEYSTORE_ALIAS",
        "PLAY_SERVICE_ACCOUNT",
      ),
    setup: [
      "PLAY_KEYSTORE_PATH, PLAY_KEYSTORE_PASSWORD, PLAY_KEYSTORE_ALIAS (and",
      "PLAY_KEYSTORE_ALIAS_PASSWORD) are the upload key Android Studio has been signing with.",
      "PLAY_SERVICE_ACCOUNT is the path to a service account json:",
      "  1. Play Console -> Setup -> API access, link or create a Google Cloud project",
      "  2. Create a service account there, then grant it the Release manager role on this app",
      "  3. Google Cloud -> that service account -> Keys -> Add key -> JSON, save it outside the repo",
      "PLAY_TRACK (default production) and PLAY_STATUS (default draft) are optional.",
    ],
    run: async () => {
      await gradle("bundleRelease", keystoreEnv("PLAY"))

      const track = process.env.PLAY_TRACK ?? "production"
      const status = process.env.PLAY_STATUS ?? "draft"
      const versionCode = await uploadToPlay({
        credentials: JSON.parse(
          await readFile(resolve(root, process.env.PLAY_SERVICE_ACCOUNT), "utf-8"),
        ),
        packageName: appId,
        bundle: await readFile(aab),
        track,
        status,
        // Play rejects release notes over 500 characters
        notes: notes.slice(0, 500),
      })

      followUps.push(
        `Play Console: ${version} (${versionCode}) is a ${status} release on the ${track} track, review and roll it out at https://play.google.com/console`,
      )
    },
  },
  {
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
  },
  {
    name: "desktop",
    title: "Package the desktop app",
    missing: () => [
      ...(desktopTarget ? [] : [`desktop packaging on ${process.platform}`]),
      ...(existsSync(join(root, "electron/node_modules")) ? [] : ["electron dependencies"]),
    ],
    setup: [
      "Run npm ci --prefix electron. Each platform's packages have to be built on that platform,",
      "so run pnpm release desktop gitea on the others to add theirs to the same release.",
    ],
    run: async () => {
      await run("pnpm", ["run", `package:desktop:${desktopTarget}`], {cwd: root})

      const elsewhere = Object.values(desktopTargets)
        .flat()
        .filter(target => !desktopTargets[process.platform].includes(target))

      followUps.push(
        `Desktop: ${elsewhere.join(" and ")} packages have to be built on those platforms, then attached with pnpm release gitea`,
      )
    },
  },
  {
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

      const files = [
        ...(existsSync(apk) ? [[apk, `${name}-${version}.apk`]] : []),
        ...(await packagedDesktop()).map(file => [join(desktopDist, file), file]),
      ]

      if (files.length === 0) {
        throw new Error("Nothing to attach; build the apk or the desktop packages first")
      }

      const release = await api.upsertRelease(version, notes)

      for (const [path, filename] of files) {
        console.log(dim(`  ${await api.attach(release.id, filename, await readFile(path))}`))
      }
    },
  },
  {
    name: "zapstore",
    title: "Publish the APK to zapstore",
    missing: () => [
      ...(installed("zsp") ? [] : ["zsp (not installed)"]),
      ...missingEnv("SIGN_WITH"),
    ],
    setup: [
      "Install zsp from https://github.com/zapstore/zsp, then set SIGN_WITH in .env.local to an",
      "nsec, a bunker:// url, or `browser` to sign with a nostr extension.",
    ],
    run: () => run("zsp", ["publish", "zapstore.yaml"], {cwd: root}),
  },
  {
    name: "fdroid",
    title: "F-Droid",
    optional: true,
    manual: [
      "F-Droid builds from source on their own servers, so a release has nothing to upload: the",
      "metadata tracks version tags, which makes pushing the tag the whole story. The fdroiddata",
      "submission is still open — see fdroid/README.md.",
    ],
  },
]

const unknownStep = chosen.find(step => !steps.some(({name}) => name === step))

if (unknownStep) {
  fail(`Unknown step ${unknownStep}. Steps: ${steps.map(step => step.name).join(", ")}`)
}

const selected = steps.filter(step =>
  chosen.length > 0 ? chosen.includes(step.name) : !step.optional,
)

const width = Math.max(...selected.map(step => step.name.length))
const problems = selected.map(step => ({step, missing: step.missing?.() ?? []}))
const warnings = []

if (!notes) {
  problems.push({missing: [`CHANGELOG.md has no "# ${version}" section`]})
}

if (git("rev-parse", `refs/tags/${version}`)) {
  const pushed = git("ls-remote", "--tags", "origin", `refs/tags/${version}`)

  if (pushed === undefined) {
    warnings.push("couldn't reach origin to check whether the tag is pushed")
  } else if (!pushed) {
    problems.push({missing: [`the ${version} tag is not on origin: git push origin ${version}`]})
  }

  if (git("rev-parse", "HEAD") !== git("rev-parse", `refs/tags/${version}^{commit}`)) {
    warnings.push(`HEAD is not the ${version} tag, so the build won't match what you tagged`)
  }
} else {
  problems.push({
    missing: [`there is no ${version} tag: git tag ${version} && git push origin ${version}`],
  })
}

if (git("status", "--porcelain")) {
  warnings.push("the working tree has uncommitted changes")
}

console.log(bold(`\n${name} ${version} -> ${repository.host}${repository.pathname}\n`))

for (const step of selected) {
  console.log(`  ${step.name.padEnd(width)}  ${step.manual ? dim(step.title) : step.title}`)
}

if (warnings.length > 0) {
  console.log("")

  for (const warning of warnings) {
    console.log(yellow(`  ! ${warning}`))
  }
}

const blocked = problems.filter(({missing}) => missing.length > 0)

if (blocked.length > 0) {
  console.log("")

  for (const {step, missing} of blocked) {
    console.log(red(`  x ${step ? `${step.name}: missing ${missing.join(", ")}` : missing[0]}`))

    for (const line of step?.setup ?? []) {
      console.log(dim(`      ${line}`))
    }
  }

  fail("\nNothing ran.")
}

if (options.check) {
  console.log(green("\nReady to go."))
  process.exit(0)
}

if (!options.yes) {
  if (!process.stdin.isTTY) {
    fail("Not a terminal; pass --yes to run unattended")
  }

  const answer = await ask(`\nRelease ${version}? [y/N] `)

  if (!["y", "yes"].includes(answer.trim().toLowerCase())) {
    fail("Aborted.")
  }
}

const done = []

for (const [index, step] of selected.entries()) {
  if (step.manual) {
    followUps.push(step.manual.join(" "))
    continue
  }

  console.log(bold(`\n> ${step.title}`))

  const started = Date.now()

  try {
    await step.run()
  } catch (error) {
    console.error(red(`\n${step.name} failed: ${error.message}`))

    const remaining = selected.slice(index).map(remainingStep => remainingStep.name)

    fail(`Pick up where this left off with: pnpm release ${remaining.join(" ")}`)
  }

  done.push(`${step.name.padEnd(width)}  ${Math.round((Date.now() - started) / 1000)}s`)
}

console.log(bold(`\n${name} ${version}\n`))

for (const line of done) {
  console.log(`  ${green("done")}  ${line}`)
}

if (followUps.length > 0) {
  console.log(bold("\nLeft to do by hand"))

  for (const followUp of followUps) {
    console.log(`  - ${followUp}`)
  }
}
