import {config} from "dotenv"
import {defineConfig} from "vite"
import {SvelteKitPWA} from "@vite-pwa/sveltekit"
import {sveltekit} from "@sveltejs/kit/vite"
import svg from "@poppanator/sveltekit-svg"

config({path: ".env.local"})
config({path: ".env"})

export default defineConfig({
  // @welshman/editor takes tiptap as peer dependencies, so an installed copy resolves them from
  // here and there is one prosemirror. link-deps.mjs symlinks its source instead, and that directory
  // carries node_modules from welshman's own install — a second prosemirror, whose Plugin and
  // PluginKey classes tiptap refuses to mix with ours ("Adding different instances of a keyed
  // plugin"). Deduping resolves these to this project's copy wherever they are imported from, and
  // does nothing when only one copy exists. Vite resolves a deduped package from the project root
  // and nowhere else, so every name listed here has to be a direct dependency — under pnpm a
  // transitive one isn't reachable from the root and the build fails to resolve it.
  resolve: {
    dedupe: [
      "@tiptap/core",
      "@tiptap/pm",
      "@tiptap/suggestion",
      "prosemirror-model",
      "prosemirror-state",
      "prosemirror-transform",
      "prosemirror-view",
    ],
  },
  server: {
    port: 1847,
    // host: "0.0.0.0",
    // strictPort: true,
    // allowedHosts: ["coracle-client.ngrok.io"],
    // hmr: {
    //   protocol: "wss",
    //   host: "coracle-client.ngrok.io",
    //   clientPort: 443,
    // },
    // cors: true,
  },
  build: {
    sourcemap: true,
  },
  plugins: [
    sveltekit(),
    SvelteKitPWA({
      registerType: "autoUpdate",
      injectRegister: "auto",
      // adapter-static writes the fallback shell after the service worker is generated, so the
      // plugin can't glob it — this precaches "/" explicitly, giving workbox's navigation
      // fallback something to bind to.
      kit: {
        spa: true,
        adapterFallback: "/",
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 5 * 1024 ** 2, // 5 MB or set to something else
        // The service worker is generated before SvelteKit prerenders anything, so the
        // "prerendered/**" glob @vite-pwa/sveltekit forces in never matches. It only forces it
        // when modifyURLPrefix is unset, and an empty one is a no-op.
        modifyURLPrefix: {},
        globPatterns: ["client/**/*.{js,css,ico,png,svg,webp,webmanifest}"],
      },
      manifest: {
        name: process.env.VITE_PLATFORM_NAME,
        short_name: process.env.VITE_PLATFORM_NAME,
        theme_color: process.env.VITE_PLATFORM_ACCENT,
        description: process.env.VITE_PLATFORM_DESCRIPTION,
        // @ts-ignore
        permissions: ["clipboardRead", "clipboardWrite", "unlimitedStorage"],
        icons: [
          {src: "pwa-64x64.png", sizes: "64x64", type: "image/png"},
          {src: "pwa-192x192.png", sizes: "192x192", type: "image/png"},
          {src: "pwa-512x512.png", sizes: "512x512", type: "image/png", purpose: "any"},
          {
            src: "maskable-icon-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
    }),
    svg({
      svgoOptions: {
        multipass: true,
        plugins: ["preset-default", "removeDimensions"],
      },
    }),
  ],
})
