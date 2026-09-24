import {spawn} from "node:child_process"
import {cp, mkdir, mkdtemp, readFile, readdir, rm} from "node:fs/promises"
import {join, resolve} from "node:path"
import {fileURLToPath} from "node:url"
import sharp from "sharp"
import {loadEnv} from "vite"

const root = fileURLToPath(new URL("../../", import.meta.url))
const [target, option, ...rest] = process.argv.slice(2)
const platforms = {linux: "--linux", windows: "--win", macos: "--mac"}
const env = {
  ...process.env,
  ...loadEnv("production", root, ["VITE_", "DOCKER"]),
  NODE_ENV: "production",
}

const run = (command, args, options = {}) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, {cwd: root, env, stdio: "inherit", ...options})
    child.on("error", reject)
    child.on("exit", (code, signal) => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`${command} failed (${signal || code})`))
      }
    })
  })

try {
  if (!Object.hasOwn(platforms, target) || rest.length || (option && option !== "--dir")) {
    throw new Error("Usage: node scripts/desktop/package.mjs linux|windows|macos [--dir]")
  }
  delete env.FLOTILLA_DESKTOP_DEV_URL
  delete env.CAPACITOR_ELECTRON_DEV_SERVER_URL
  env.CSC_IDENTITY_AUTO_DISCOVERY = "false"

  let logo
  if (env.VITE_PLATFORM_LOGO?.startsWith("https://")) {
    const response = await fetch(env.VITE_PLATFORM_LOGO, {signal: AbortSignal.timeout(30_000)})
    if (!response.ok || !response.headers.get("content-type")?.startsWith("image/")) {
      throw new Error("VITE_PLATFORM_LOGO must return a successful image response")
    }
    logo = Buffer.from(await response.arrayBuffer())
  } else {
    logo = await readFile(resolve(root, env.VITE_PLATFORM_LOGO))
  }
  env.VITE_PLATFORM_LOGO = "static/desktop-logo.png"
  await sharp(logo).resize(1024, 1024).png().toFile(join(root, env.VITE_PLATFORM_LOGO))

  await run("bash", ["scripts/desktop/build.sh"])
  await cp(join(root, env.VITE_PLATFORM_LOGO), join(root, "electron/generated/icon.png"))
  await cp(join(root, "static/favicon.ico"), join(root, "electron/generated/icon.ico"))
  for (const [size, name] of [
    [16, "trayTemplate.png"],
    [32, "trayTemplate@2x.png"],
  ]) {
    await sharp({create: {width: size, height: size, channels: 3, background: "black"}})
      .joinChannel(
        await sharp(logo).resize(size, size).ensureAlpha().extractChannel("alpha").toBuffer(),
      )
      .png()
      .toFile(join(root, "electron/generated", name))
  }
  await cp(join(root, "LICENSE"), join(root, "electron/generated/LICENSE"))
  await run(
    process.execPath,
    [join(root, "node_modules/@capawesome/capacitor-electron/dist/cli/index.js"), "vendor"],
    {cwd: join(root, "electron")},
  )

  const args = [platforms[target], ...(option ? [option] : [])]
  if (target === "macos" && option === "--dir") {
    // --dir replaces configured targets, including their architectures.
    args.push("--x64", "--arm64")
  }
  if (
    (target === "windows" && process.platform !== "win32") ||
    (target === "linux" && process.platform !== "linux")
  ) {
    const files = await readdir(join(root, "electron/vendor"), {recursive: true})
    if (files.some(file => file.endsWith(".node"))) {
      throw new Error(`Native Electron addons require a rebuild before packaging for ${target}`)
    }
    await mkdir(join(root, "electron/dist"), {recursive: true})
    const directory = await mkdtemp(join(root, "electron/dist/package-"))
    const docker = env.DOCKER || "docker"
    const container = `flotilla-package-${process.pid}`
    try {
      await cp(join(root, "package.json"), join(directory, "package.json"))
      for (const file of [
        "package.json",
        "package-lock.json",
        "electron-builder.config.mjs",
        "build",
        "app",
        "generated",
        "vendor",
      ]) {
        await cp(join(root, "electron", file), join(directory, "electron", file), {recursive: true})
      }
      // Copied in and out rather than mounted: a CI job that shares the host's docker socket
      // would mount the host's path, not its own
      await run(docker, [
        "create",
        "--name",
        container,
        "--platform",
        "linux/amd64",
        "--workdir",
        "/project/electron",
        "--env",
        "USE_SYSTEM_WINE=true",
        "--env",
        "CSC_IDENTITY_AUTO_DISCOVERY=false",
        "electronuserland/builder@sha256:41ae540902461b6cbc988987db79547fcc10cda04d2a6c6367504f59d4b37c64",
        "bash",
        "-c",
        'npm ci --ignore-scripts && npm run pack -- "$@"',
        "--",
        ...args,
      ])
      await run(docker, ["cp", `${directory}/.`, `${container}:/project`])
      await run(docker, ["start", "--attach", container])
      await run(docker, [
        "cp",
        `${container}:/project/electron/dist/.`,
        join(root, "electron/dist"),
      ])
    } finally {
      await run(docker, ["rm", "--force", container], {stdio: "ignore"}).catch(() => {})
      await rm(directory, {recursive: true, force: true})
    }
  } else {
    await run(
      process.execPath,
      [
        "node_modules/electron-builder/cli.js",
        "--config",
        "electron-builder.config.mjs",
        "--publish",
        "never",
        ...args,
      ],
      {cwd: join(root, "electron")},
    )
  }
} finally {
  await rm(join(root, "static/desktop-logo.png"), {force: true})
}
