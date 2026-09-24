import {root} from "../lib/context.mjs"
import {run} from "../lib/shell.mjs"

export default {
  name: "web",
  title: "Build the web bundle and sync the native projects",
  run: () => run("bash", ["scripts/build/app.sh"], {cwd: root}),
}
