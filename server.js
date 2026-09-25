import path from "node:path"
import {promises as fs} from "node:fs"
import {fileURLToPath} from "node:url"

import "dotenv/config"
import {serve} from "@hono/node-server"
import {serveStatic} from "@hono/node-server/serve-static"
import {Hono} from "hono"

import {createPreview} from "./server/preview.js"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const BUILD_DIR = path.join(__dirname, "build")
const INDEX_PATH = path.join(BUILD_DIR, "index.html")

const PORT = parseInt(process.env.PORT || "", 10) || 3000
const HOST = process.env.HOST || "0.0.0.0"

let TEMPLATE_HTML = ""
try {
  TEMPLATE_HTML = await fs.readFile(INDEX_PATH, "utf8")
} catch (error) {
  console.error(`Unable to read ${INDEX_PATH}. Run "pnpm run build" first.`)
  process.exit(1)
}

const app = new Hono()

// Only allow GET and HEAD requests
app.use("*", async (context, next) => {
  const method = context.req.method
  if (method !== "GET" && method !== "HEAD") {
    return context.text("Method Not Allowed", 405, {Allow: "GET, HEAD"})
  }
  await next()
})

// Serve static assets with appropriate caching
app.use(
  "*",
  serveStatic({
    root: BUILD_DIR,
    onFound: (filePath, context) => {
      const isImmutable = filePath.split(path.sep).join("/").includes("/_app/immutable/")
      const cacheControl =
        path.basename(filePath) === "index.html"
          ? "no-cache"
          : isImmutable
            ? "public, max-age=31536000, immutable"
            : "public, max-age=3600"

      context.header("Cache-Control", cacheControl)

      // Immutable assets are content-hashed by Vite, so the filename is itself a
      // stable content identifier. Exposing it as an ETag lets clients that
      // revalidate explicitly (e.g. emoji-picker-element checks its data source
      // on every load) skip re-downloading large files when nothing changed.
      if (isImmutable) {
        context.header("ETag", `"${path.basename(filePath)}"`)
      }
    },
  }),
)

// A tld looks like a file extension, so a client route can arrive looking like a missing asset.
app.route("/", createPreview(TEMPLATE_HTML))

serve(
  {
    fetch: app.fetch,
    hostname: HOST,
    port: PORT,
  },
  () => {
    console.log(`Flotilla server running on http://${HOST}:${PORT}`)
  },
)
