#!/usr/bin/env node
import {readFile} from "node:fs/promises"

const read = path => readFile(new URL(path, import.meta.url), "utf-8")

const token = process.env.GITEA_TOKEN
const {name, version} = JSON.parse(await read("../package.json"))
const changelog = await read("../CHANGELOG.md")
const zapstore = await read("../zapstore.yaml")

const zapstoreField = key => {
  const match = zapstore.match(new RegExp(`^${key}:\\s*(\\S+)\\s*$`, "m"))

  if (!match) {
    throw new Error(`zapstore.yaml is missing ${key}`)
  }

  return match[1]
}

const repository = new URL(zapstoreField("repository"))
const base = `${repository.origin}/api/v1/repos${repository.pathname}`

const api = async (method, path, {body, allow404} = {}) => {
  const multipart = body instanceof FormData
  const response = await fetch(base + path, {
    method,
    headers: {
      Authorization: `token ${token}`,
      ...(body && !multipart ? {"Content-Type": "application/json"} : {}),
    },
    body: multipart ? body : body && JSON.stringify(body),
  })

  if (response.status === 404 && allow404) {
    return undefined
  }

  if (!response.ok) {
    throw new Error(`${method} ${path} responded ${response.status}: ${await response.text()}`)
  }

  return response.status === 204 ? undefined : response.json()
}

if (!token) {
  throw new Error("Set GITEA_TOKEN to a token with write access to the repository")
}

const lines = changelog.split("\n")
const heading = lines.indexOf(`# ${version}`)

if (heading < 0) {
  throw new Error(`CHANGELOG.md has no "# ${version}" section`)
}

const remainder = lines.slice(heading + 1)
const nextHeading = remainder.findIndex(line => line.startsWith("# "))
const notes = (nextHeading < 0 ? remainder : remainder.slice(0, nextHeading)).join("\n").trim()
const apk = await readFile(new URL(`../${zapstoreField("release_source")}`, import.meta.url))

if (!(await api("GET", `/tags/${version}`, {allow404: true}))) {
  throw new Error(`${repository} has no ${version} tag; push it before publishing`)
}

const release =
  (await api("GET", `/releases/tags/${version}`, {allow404: true})) ??
  (await api("POST", "/releases", {body: {tag_name: version, name: version, body: notes}}))

const filename = `${name}-${version}.apk`
const existing = release.assets?.find(asset => asset.name === filename)

if (existing) {
  await api("DELETE", `/releases/${release.id}/assets/${existing.id}`)
}

const form = new FormData()

form.append("attachment", new Blob([apk]), filename)

const asset = await api(
  "POST",
  `/releases/${release.id}/assets?name=${encodeURIComponent(filename)}`,
  {body: form},
)

console.log(asset.browser_download_url)
