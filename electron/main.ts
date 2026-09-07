import {createCapacitorElectronApp} from "@capawesome/capacitor-electron"

createCapacitorElectronApp({
  window: {width: 1200, height: 800},
  // SvelteKit's meta CSP owns scripts; the platform default would block its hashed bootstrap.
  csp: {policy: "base-uri 'self'; object-src 'none'"},
})
