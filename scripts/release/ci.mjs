#!/usr/bin/env node
// Everything that needs no key but the job's own gitea token, run by .gitea/workflows/release.yml
import {release} from "./lib/pipeline.mjs"
import desktop from "./steps/desktop.mjs"
import fdroid from "./steps/fdroid.mjs"
import gitea from "./steps/gitea.mjs"

await release("pnpm release:ci", [fdroid, desktop, gitea])
