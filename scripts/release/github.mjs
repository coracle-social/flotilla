#!/usr/bin/env node
// Copies gitea's latest published release to the GitHub mirror, whose releases are what Obtainium
// sees for anyone who added the app by its GitHub url. Run by .gitea/workflows/mirror.yml.
import {gitea} from "./lib/gitea.mjs"
import {fail} from "./lib/shell.mjs"

const mirror = "coracle-social/flotilla"
const repository = new URL(`${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}`)
const token = process.env.GH_MIRROR_TOKEN

if (!token || !process.env.GITEA_TOKEN) {
  fail("Set GITEA_TOKEN and GH_MIRROR_TOKEN")
}

const github = async (method, url, {body, allow404} = {}) => {
  const binary = body instanceof Uint8Array
  const response = await fetch(url.startsWith("https://") ? url : `https://api.github.com${url}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      ...(body ? {"Content-Type": binary ? "application/octet-stream" : "application/json"} : {}),
    },
    body: binary ? body : body && JSON.stringify(body),
  })

  if (response.status === 404 && allow404) {
    return undefined
  }

  if (!response.ok) {
    throw new Error(`${method} ${url} responded ${response.status}: ${await response.text()}`)
  }

  return response.status === 204 ? undefined : response.json()
}

const source = await gitea({repository, token: process.env.GITEA_TOKEN}).latestRelease()

if (!source) {
  console.log("gitea has no published release")
  process.exit(0)
}

const tag = source.tag_name

// Creating a release for a tag GitHub doesn't have yet would tag its default branch instead
if (!(await github("GET", `/repos/${mirror}/git/ref/tags/${tag}`, {allow404: true}))) {
  fail(`${mirror} has no ${tag} tag yet; the mirror job pushes it`)
}

const release =
  (await github("GET", `/repos/${mirror}/releases/tags/${tag}`, {allow404: true})) ??
  (await github("POST", `/repos/${mirror}/releases`, {
    body: {tag_name: tag, name: source.name, body: source.body, make_latest: "true"},
  }))

for (const asset of source.assets) {
  const existing = release.assets.find(({name}) => name === asset.name)

  // A moved tag rebuilds its assets under the same names, which only the size gives away
  if (existing?.size === asset.size) {
    continue
  }

  if (existing) {
    await github("DELETE", `/repos/${mirror}/releases/assets/${existing.id}`)
  }

  const response = await fetch(asset.browser_download_url)

  if (!response.ok) {
    throw new Error(`Downloading ${asset.name} responded ${response.status}`)
  }

  await github(
    "POST",
    `https://uploads.github.com/repos/${mirror}/releases/${release.id}/assets?name=${encodeURIComponent(asset.name)}`,
    {body: new Uint8Array(await response.arrayBuffer())},
  )

  console.log(`${tag}: ${asset.name}`)
}
