import assert from "node:assert/strict"
import {describe, test} from "node:test"
import {load} from "cheerio"

process.env.VITE_PLATFORM_NAME = "Flotilla"
process.env.VITE_DEFAULT_RELAYS = ""
process.env.VITE_INDEXER_RELAYS = ""

const {createPreview} = await import("../preview.js")

const template = `<!doctype html>
<html><head>
  <title>Flotilla</title>
  <meta name="description" content="Digital communities for free people." />
  <meta property="og:title" content="Flotilla" />
  <meta property="og:description" content="Digital communities for free people." />
  <meta property="og:image" content="" />
  <link rel="canonical" href="https://app.flotilla.social" />
</head><body></body></html>`

// Nothing resolves this host, so every route falls back to what its url alone says.
const space = "nowhere.invalid"

const preview = createPreview(template)

const request = async path => {
  const $ = load(await (await preview.request("https://app.flotilla.social" + path)).text())

  return {
    title: $("title").text(),
    description: $('meta[property="og:description"]').attr("content"),
    image: $('meta[property="og:image"]').attr("content"),
    canonical: $('link[rel="canonical"]').attr("href"),
  }
}

describe("preview metadata", () => {
  test("names the space in an invite", async () => {
    const {title, description} = await request(`/join?r=${space}`)

    assert.equal(title, `Join ${space} on Flotilla`)
    assert.equal(description, `You are invited to join ${space} on Flotilla.`)
  })

  test("describes a space", async () => {
    const {title, description, canonical} = await request(`/spaces/${space}`)

    assert.equal(title, `${space} on Flotilla`)
    assert.equal(description, `${space} is a community on Flotilla.`)
    assert.equal(canonical, `https://app.flotilla.social/spaces/${space}`)
  })

  test("describes each section of a space differently", async () => {
    assert.equal((await request(`/spaces/${space}/threads`)).title, `Threads in ${space}`)
    assert.equal((await request(`/spaces/${space}/calendar`)).title, `Calendar of ${space}`)
    assert.equal((await request(`/spaces/${space}/directory`)).title, `Members of ${space}`)
  })

  test("falls back to the noun a route is about", async () => {
    assert.equal((await request(`/spaces/${space}/threads/abc`)).title, `A thread in ${space}`)
    assert.equal((await request(`/spaces/${space}/calendar/abc`)).title, `An event in ${space}`)
    assert.equal((await request(`/spaces/${space}/whatever`)).title, `A room in ${space}`)
  })

  test("falls back to the platform image", async () => {
    const {image} = await request(`/spaces/${space}`)

    assert.equal(image, "https://app.flotilla.social/maskable-icon-512x512.png")
  })

  test("won't reach a relay on a private or local host", async () => {
    for (const path of ["/join?r=localhost:8080", "/spaces/127.0.0.1", "/spaces/printer.local"]) {
      assert.equal((await request(path)).title, "Flotilla")
    }
  })

  test("leaves the platform's own pages alone", async () => {
    for (const path of ["/", "/settings/profile", "/spaces/create", "/people/not-an-npub"]) {
      assert.equal((await request(path)).title, "Flotilla")
    }
  })
})
