import adapter from "@sveltejs/adapter-static"
import {vitePreprocess} from "@sveltejs/vite-plugin-svelte"

/** @type {import('@sveltejs/kit').Config} */
export default {
  preprocess: vitePreprocess(),
  kit: {
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
        "script-src": ["self", "wasm-unsafe-eval", "plausible.coracle.social", "sha256-NpqGpeZTuPniNAucgyfqzWy9iIHwOswFzPzpigwvp/c="],
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
