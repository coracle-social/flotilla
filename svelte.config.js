import adapter from "@sveltejs/adapter-static"
import {vitePreprocess} from "@sveltejs/vite-plugin-svelte"
import {createHash} from "node:crypto"
import {readFileSync} from "node:fs"

// Sveltekit hashes the scripts it injects itself, but not the ones app.html carries, so those
// have to be named in script-src by hand. Hashing them here rather than pasting a literal is
// what stops an edit to app.html silently violating the policy.
const appHtmlScripts = [
  ...readFileSync(new URL("./src/app.html", import.meta.url), "utf8").matchAll(
    /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g,
  ),
].map(([, script]) => "sha256-" + createHash("sha256").update(script).digest("base64"))

/** @type {import('@sveltejs/kit').Config} */
export default {
  preprocess: vitePreprocess(),
  kit: {
    serviceWorker: {
      register: process.env.FLOTILLA_DESKTOP !== "1",
    },
    adapter: adapter({
      fallback: "index.html",
    }),
    alias: {
      "@src": "src",
      "@app": "src/app",
      "@lib": "src/lib",
      "@assets": "src/assets",
    },
    csp: {
      directives: {
        "script-src": ["self", "wasm-unsafe-eval", "https://plausible.coracle.social", ...appHtmlScripts],
        "worker-src": ["self", "blob:"],
        "style-src": ["self", "unsafe-inline"],
        "frame-src": ["none"],
        "child-src": ["none"],
        "form-action": ["none"],
      },
    },
  },
  compilerOptions: {
    warningFilter: (warning) => {
      return !['a11y_media_has_caption', 'state_referenced_locally'].includes(warning.code)
    },
  }
}
