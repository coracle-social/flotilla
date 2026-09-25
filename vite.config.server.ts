import {builtinModules} from "module"
import {fileURLToPath} from "url"
import {config} from "dotenv"
import {defineConfig} from "vite"

config({path: ".env.local"})
config({path: ".env"})

export default defineConfig({
  // The production image has no .env beside the bundle, so branding travels inside the bundle.
  define: Object.fromEntries(
    Object.keys(process.env)
      .filter(key => key.startsWith("VITE_"))
      .map(key => [`process.env.${key}`, JSON.stringify(process.env[key])]),
  ),
  resolve: {
    alias: {
      "isomorphic-ws": fileURLToPath(new URL("server/websocket.js", import.meta.url)),
    },
  },
  ssr: {
    noExternal: true, // bundle every dependency
  },
  build: {
    target: "node24", // match your Node.js version
    outDir: "build-server",
    emptyOutDir: false, // don't wipe the frontend build output
    ssr: true, // tells Vite this is a server-side build
    minify: "esbuild", // minify the output
    lib: {
      entry: "server.js", // your server entry point
      formats: ["es"],
      fileName: () => "server.js",
    },
    rollupOptions: {
      // Externalize only Node.js built-ins, bundle everything else
      external: [...builtinModules, ...builtinModules.map(m => `node:${m}`)],
    },
  },
})
