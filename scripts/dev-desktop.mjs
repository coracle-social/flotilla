import {spawn, spawnSync} from "node:child_process"
import {access, readFile} from "node:fs/promises"
import {createRequire} from "node:module"
import {dirname, resolve} from "node:path"
import {fileURLToPath} from "node:url"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const require = createRequire(import.meta.url)
const windows = process.platform === "win32"
let server
let child
let interrupted = false
let forceShutdown

const terminate = (signal = "SIGTERM") => {
  if (child?.pid) {
    if (windows) {
      if (typeof child.exitCode !== "number" && !child.signalCode) {
        const result = spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"])
        if (result.error || result.status !== 0) {
          console.error(result.error || result.stderr.toString().trim())
          process.exitCode = 1
        }
      }
    } else {
      try {
        // cap run owns shell/npm descendants, so stopping just its PID leaves Electron running.
        process.kill(-child.pid, signal)
      } catch (error) {
        if (error.code !== "ESRCH") {
          console.error(error)
          process.exitCode = 1
        }
      }
    }
  }
}

const onSignal = signal => {
  interrupted = true
  process.exitCode = signal === "SIGINT" ? 130 : 143
  terminate()
  forceShutdown ??= setTimeout(() => terminate("SIGKILL"), 5000)
  forceShutdown.unref()
}

try {
  try {
    // Requiring Electron 43 downloads missing binaries; inspect the installation without running it.
    const electron = resolve(root, "electron/node_modules/electron")
    const executable = (await readFile(resolve(electron, "path.txt"), "utf8")).trim()
    await access(
      resolve(process.env.ELECTRON_OVERRIDE_DIST_PATH || resolve(electron, "dist"), executable),
    )
  } catch (error) {
    throw new Error("Install the desktop dependencies first: npm ci --prefix electron", {
      cause: error,
    })
  }

  process.chdir(root)
  process.env.NODE_ENV = "development"
  process.env.FLOTILLA_DESKTOP = "1"
  const {createServer} = await import("vite")

  process.on("SIGINT", onSignal)
  process.on("SIGTERM", onSignal)
  server = await createServer({
    mode: "development",
    server: {host: "127.0.0.1", strictPort: true},
  })

  if (!interrupted) {
    await server.listen()
    const url = new URL(server.resolvedUrls.local[0])
    if (url.protocol !== "http:" || url.hostname !== "127.0.0.1" || url.href !== `${url.origin}/`) {
      throw new Error("Desktop development requires an HTTP server on 127.0.0.1.")
    }

    if (!interrupted) {
      server.printUrls()
      child = spawn(
        process.execPath,
        [
          // Capacitor 8.3.4 otherwise logs rejected platform hooks without failing the process.
          "--unhandled-rejections=strict",
          require.resolve("@capacitor/cli/bin/capacitor"),
          "run",
          "@capawesome/capacitor-electron",
        ],
        {
          cwd: root,
          stdio: "inherit",
          detached: !windows,
          env: {...process.env, FLOTILLA_DESKTOP_DEV_URL: url.href},
        },
      )
      const code = await new Promise((resolve, reject) => {
        child.once("error", reject)
        child.once("close", (code, signal) => resolve(signal ? 1 : code))
      })
      if (!interrupted) process.exitCode = code ?? 1
    }
  }
} catch (error) {
  if (!interrupted) {
    console.error(error)
    process.exitCode = 1
  }
} finally {
  terminate("SIGKILL")
  await server?.close()
  clearTimeout(forceShutdown)
  process.removeListener("SIGINT", onSignal)
  process.removeListener("SIGTERM", onSignal)
}
