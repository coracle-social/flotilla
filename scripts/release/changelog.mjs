#!/usr/bin/env node
import {mkdir, writeFile} from "node:fs/promises"
import {dirname, relative} from "node:path"
import {fastlaneChangelog, notes, root, shortNotes, version} from "./lib/context.mjs"
import {fail} from "./lib/shell.mjs"

if (!notes) {
  fail(`CHANGELOG.md has no "# ${version}" section`)
}

await mkdir(dirname(fastlaneChangelog), {recursive: true})
await writeFile(fastlaneChangelog, `${shortNotes}\n`)

console.log(`Wrote ${relative(root, fastlaneChangelog)}`)
