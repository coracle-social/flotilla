import {readFileSync} from "node:fs"
import {join} from "node:path"
import {app, Menu, Tray} from "electron"
import {createCapacitorElectronApp} from "@capawesome/capacitor-electron"

const {appId, appName} = JSON.parse(
  readFileSync(join(app.getAppPath(), "generated/capacitor.config.json"), "utf8"),
)
let tray: Tray | undefined
let quitting = false

const destroyTray = () => {
  tray?.destroy()
  tray = undefined
}

app.on("before-quit", () => {
  quitting = true
  destroyTray()
})

createCapacitorElectronApp({
  window: {width: 1200, height: 800},
  hooks: {
    beforeReady: () => {
      if (process.platform === "win32") {
        app.setAppUserModelId(appId)
      }
    },
    onWindowCreated: window => {
      const show = () => {
        if (window.isMinimized()) {
          window.restore()
        }
        window.show()
        window.focus()
      }
      if (process.platform === "darwin") {
        window.on("close", event => {
          if (!quitting) {
            event.preventDefault()
            window.hide()
          }
        })
        app.on("activate", show)
        window.on("closed", () => app.removeListener("activate", show))
      }
      const icon =
        process.platform === "darwin"
          ? "trayTemplate.png"
          : process.platform === "win32"
            ? "icon.ico"
            : "icon.png"
      tray = new Tray(
        join(
          app.getAppPath(),
          app.isPackaged ? "generated" : "app",
          app.isPackaged ? icon : "pwa-192x192.png",
        ),
      )
      tray.setToolTip(appName)
      tray.setContextMenu(
        Menu.buildFromTemplate([
          {label: "Show", click: show},
          {label: "Quit", click: () => app.quit()},
        ]),
      )
      tray.on("click", show)
      window.on("closed", destroyTray)
      if (process.platform === "linux" && app.isPackaged) {
        window.setIcon(join(app.getAppPath(), "generated/icon.png"))
      }
    },
  },
  csp: {
    // SvelteKit's meta CSP owns scripts; the platform default would block its hashed bootstrap.
    policy: "base-uri 'self'; object-src 'none'",
    // Capawesome 0.1.1's dev policy, plus Flotilla's analytics origin and blob workers.
    devPolicy: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://plausible.coracle.social",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      "media-src 'self' blob:",
      "connect-src 'self' https: wss: ws: http:",
      "worker-src 'self' blob:",
      "object-src 'none'",
      "base-uri 'self'",
    ].join("; "),
  },
})
