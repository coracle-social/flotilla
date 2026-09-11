import {createCapacitorElectronApp} from "@capawesome/capacitor-electron"

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
