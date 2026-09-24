#!/usr/bin/env node
// Everything that needs a signing key, so those keys never leave this machine
import {release} from "./lib/pipeline.mjs"
import apk from "./steps/apk.mjs"
import desktop from "./steps/desktop.mjs"
import fdroidSign from "./steps/fdroid-sign.mjs"
import gitea from "./steps/gitea.mjs"
import ios from "./steps/ios.mjs"
import play from "./steps/play.mjs"
import web from "./steps/web.mjs"
import zapstore from "./steps/zapstore.mjs"

await release("pnpm release:local", [web, apk, play, ios, desktop, fdroidSign, gitea, zapstore])
