import {spawn, spawnSync} from "node:child_process"
import {createRequire} from "node:module"
import {dirname, resolve} from "node:path"
import {fileURLToPath} from "node:url"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..")
const require = createRequire(import.meta.url)
const windows = process.platform === "win32"
let server
let child
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
  process.exitCode = signal === "SIGINT" ? 130 : 143
  terminate()
  forceShutdown ??= setTimeout(() => terminate("SIGKILL"), 5000)
  forceShutdown.unref()
}

// Vite also exits on SIGTERM; clean up descendants even if its handler exits first.
const onExit = () => terminate("SIGKILL")

try {
  process.chdir(root)
  process.env.NODE_ENV = "development"
  process.env.FLOTILLA_DESKTOP = "1"
  const {createServer} = await import("vite")

  server = await createServer({
    mode: "development",
    server: {host: "127.0.0.1", strictPort: true},
  })

  await server.listen()
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
      env: {...process.env, FLOTILLA_DESKTOP_DEV_URL: server.resolvedUrls.local[0]},
    },
  )
  process.on("SIGINT", onSignal)
  process.on("SIGTERM", onSignal)
  process.on("exit", onExit)
  const code = await new Promise((resolve, reject) => {
    child.once("error", reject)
    child.once("close", (code, signal) => resolve(signal ? 1 : code))
  })
  process.exitCode ||= code ?? 1
} catch (error) {
  console.error(error)
  process.exitCode = 1
} finally {
  terminate("SIGKILL")
  await server?.close()
  clearTimeout(forceShutdown)
  process.removeListener("SIGINT", onSignal)
  process.removeListener("SIGTERM", onSignal)
  process.removeListener("exit", onExit)
}
