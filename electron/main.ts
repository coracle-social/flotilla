import {copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync} from "node:fs"
import {join} from "node:path"
import {app, Menu, Tray} from "electron"
import {autoUpdater} from "electron-updater"
import {createCapacitorElectronApp} from "@capawesome/capacitor-electron"

const {appId, appName} = JSON.parse(
  readFileSync(join(app.getAppPath(), "generated/capacitor.config.json"), "utf8"),
)
const iconPath = join(
  app.getAppPath(),
  app.isPackaged ? "generated/icon.png" : "app/pwa-192x192.png",
)
let tray: Tray | undefined
let quitting = false

app.whenReady().then(() => {
  if (app.isPackaged) {
    void autoUpdater
      .checkForUpdates()
      .then(result => result?.downloadPromise)
      .catch(error => console.error("Update check failed", error))
  }
})

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
      } else if (process.platform === "linux" && app.isPackaged) {
        app.setDesktopName(`${appId}.desktop`)
        try {
          const data = process.env.XDG_DATA_HOME || join(app.getPath("home"), ".local/share")
          const applications = join(data, "applications")
          const entry = join(applications, `${appId}.desktop`)
          const marker = "X-Electron-Generated=true"
          const installed = (process.env.XDG_DATA_DIRS || "/usr/local/share:/usr/share")
            .split(":")
            .some(directory => existsSync(join(directory, "applications", `${appId}.desktop`)))
          if (!installed && (!existsSync(entry) || readFileSync(entry, "utf8").includes(marker))) {
            const icons = join(data, "icons")
            const icon = join(icons, `${appId}.png`)
            mkdirSync(applications, {recursive: true})
            mkdirSync(icons, {recursive: true})
            copyFileSync(iconPath, icon)
            const escape = (value: string) =>
              value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/\r/g, "\\r")
            const writeEntry = (executable: string) => {
              const command = `"${executable.replace(/[\\"`$]/g, "\\$&").replace(/%/g, "%%")}"`
              // Wayland shells resolve icons through desktop entries, not BrowserWindow.setIcon.
              writeFileSync(
                entry,
                [
                  "[Desktop Entry]",
                  "Type=Application",
                  `Name=${escape(appName)}`,
                  `Exec=${escape(command)}`,
                  `Icon=${escape(icon)}`,
                  `StartupWMClass=${appId}`,
                  "NoDisplay=true",
                  marker,
                  "",
                ].join("\n"),
              )
            }
            writeEntry(process.env.APPIMAGE || process.execPath)
            autoUpdater.on("appimage-filename-updated", (destination: string) => {
              try {
                writeEntry(destination)
              } catch (error) {
                console.error("Could not update the desktop launcher", error)
              }
            })
          }
        } catch (error) {
          console.error("Could not register the desktop icon", error)
        }
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
      tray = new Tray(app.isPackaged ? join(app.getAppPath(), "generated", icon) : iconPath)
      tray.setToolTip(appName)
      tray.setContextMenu(
        Menu.buildFromTemplate([
          {label: "Show", click: show},
          {label: "Quit", click: () => app.quit()},
        ]),
      )
      tray.on("click", show)
      window.on("closed", destroyTray)
      if (process.platform === "darwin") {
        app.dock?.setIcon(iconPath)
      } else if (process.platform === "linux") {
        window.setIcon(iconPath)
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
