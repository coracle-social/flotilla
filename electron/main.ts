import {app} from "electron"
import {createCapacitorElectronApp} from "@capawesome/capacitor-electron"

const devServerUrl = process.env.FLOTILLA_DESKTOP_DEV_URL

// Capawesome 0.1.1 has no public option to force local assets over an inherited dev URL.
if (app.isPackaged || process.argv.includes("--desktop-local") || !devServerUrl) {
  delete process.env.CAPACITOR_ELECTRON_DEV_SERVER_URL
} else {
  const url = new URL(devServerUrl)
  if (
    url.protocol !== "http:" ||
    url.hostname !== "127.0.0.1" ||
    devServerUrl !== `${url.origin}/` ||
    process.env.CAPACITOR_ELECTRON_DEV_SERVER_URL !== devServerUrl
  ) {
    throw new Error("Desktop development requires the matching loopback URL from cap run.")
  }
}

createCapacitorElectronApp({
  window: {width: 1200, height: 800},
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
