import {missingEnv, root} from "../lib/context.mjs"
import {installed, run} from "../lib/shell.mjs"

export default {
  name: "zapstore",
  title: "Publish the APK to zapstore",
  missing: () => [...(installed("zsp") ? [] : ["zsp (not installed)"]), ...missingEnv("SIGN_WITH")],
  setup: [
    "Install zsp from https://github.com/zapstore/zsp, then set SIGN_WITH in .env.local to an",
    "nsec, a bunker:// url, or `browser` to sign with a nostr extension.",
  ],
  run: () => run("zsp", ["publish", "--skip-preview", "--quiet", "zapstore.yaml"], {cwd: root}),
}
