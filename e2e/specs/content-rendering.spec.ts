import {npubEncode} from "nostr-tools/nip19"
import {HOUR, MINUTE} from "@welshman/lib"
import {MESSAGE, makeEvent} from "@welshman/util"
import {Article, Thread} from "@welshman/domain"
import {expect, roomPath, spacePath, test, users} from "../harness"

// A handle to a seeded event, which only reads once seed() has drained its queue.
type Seeded = {readonly id: string}

// @welshman/content takes an invoice only behind a `lightning:` scheme, and renders what follows.
const INVOICE =
  "lnbc2500u1pvjluezpp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfq" +
  "ypqdq5xysxxatsyp3k7enxv4jsxqzpuaztrnwngzn3kdzw5hydlzf03qdgm2hdq27cqv3" +
  "agm2awhz5se903vruatfhq77w3ls4evs3ch9zw97j25emudupq63nyw24cg27h2rspfj9"

test("US-060 reveal a flagged sensitive message", async ({seed, as}) => {
  let flagged!: Seeded

  const scenario = await seed(({relay, user, at}) => {
    const space = relay("space")

    space.room("general", {name: "General"})
    space.join(user.alice, "general")
    space.join(user.bob, "general")

    flagged = space.event(
      user.bob,
      makeEvent(MESSAGE, {
        content: "the butler did it",
        tags: [
          ["h", "general"],
          ["content-warning", "spoilers"],
        ],
        created_at: at(30, MINUTE),
      }),
    )
  })

  const {url} = scenario.space("space")
  const page = await as(users.alice, roomPath(url, "general"))

  const message = page.locator(`[data-event="${flagged.id}"]`)
  const warning = message.getByText('flagged by the author as "spoilers"')

  await expect(warning).toBeVisible()
  await expect(message.getByText("the butler did it")).toHaveCount(0)

  await message.getByRole("button", {name: "Show anyway"}).click()

  await expect(message.getByText("the butler did it")).toBeVisible()
  await expect(warning).toHaveCount(0)
})

test("US-061 expand a long post", async ({seed, as}) => {
  // Twelve of these is several times the three hundred characters an article card shows.
  const paragraphs = Array.from(
    {length: 12},
    (_, i) => `Paragraph ${i} works through another part of the plan in some detail`,
  )

  const scenario = await seed(({relay, user, at}) => {
    const space = relay("space")

    space.room("general", {name: "General"})
    space.join(user.alice, "general")
    space.join(user.carol, "general")
    space.profile(user.carol, {name: "Carol Chen"})

    // No summary, so the card shows the body itself and truncating it is what the story is about.
    space.event(
      user.carol,
      () =>
        space
          .kind(Article)
          .writer()
          .setIdentifier("the-long-road")
          .setTitle("The Long Road")
          .setPublishedAt(at(3, HOUR))
          .setContent(paragraphs.join("\n\n"))
          .renderTemplate(),
      at(3, HOUR),
    )
  })

  const {url} = scenario.space("space")
  const page = await as(users.alice, `${spacePath(url)}/articles`)

  await expect(page.getByText("The Long Road")).toBeVisible()
  await expect(page.getByText(paragraphs[0])).toBeVisible()
  await expect(page.getByText(paragraphs[11])).toHaveCount(0)

  const before = page.url()

  await page.getByRole("button", {name: "Read more"}).click()

  await expect(page.getByText(paragraphs[11])).toBeVisible()

  // The whole card is a link into the article, so expanding in place means the click never reached.
  expect(page.url()).toBe(before)
})

test("US-062 see images and video inline", async ({seed, as}) => {
  let picture!: Seeded
  let clip!: Seeded

  const scenario = await seed(({relay, user, at}) => {
    const space = relay("space")

    space.room("general", {name: "General"})
    space.join(user.alice, "general")
    space.join(user.bob, "general")

    picture = space.message(user.bob, "general", "https://images.test/sunset.png", at(40, MINUTE))
    clip = space.message(user.bob, "general", "https://media.test/clip.mp4", at(35, MINUTE))
  })

  const {url} = scenario.space("space")
  const page = await as(users.alice, roomPath(url, "general"))

  const pictureMessage = page.locator(`[data-event="${picture.id}"]`)
  const clipMessage = page.locator(`[data-event="${clip.id}"]`)
  const inlineImage = pictureMessage.locator('img[src="https://images.test/sunset.png"]')

  await inlineImage.click()

  const preview = page.getByRole("dialog", {name: "Content preview"})

  await expect(preview.locator("img")).toBeVisible()

  await page.keyboard.press("Escape")

  await expect(preview).toHaveCount(0)
  await expect(clipMessage.locator("video")).toBeVisible()
})

test("US-063 preview a shared link", async ({seed, as}) => {
  const announcement = "https://example.test/announcement"
  const unreadable = "https://example.test/unreadable"

  let standalone!: Seeded
  let broken!: Seeded
  let sentence!: Seeded

  const scenario = await seed(({relay, user, at}) => {
    const space = relay("space")

    space.room("general", {name: "General"})
    space.join(user.alice, "general")
    space.join(user.bob, "general")

    standalone = space.message(user.bob, "general", announcement, at(40, MINUTE))
    broken = space.message(user.bob, "general", unreadable, at(35, MINUTE))
    sentence = space.message(
      user.bob,
      "general",
      `Have a look at ${announcement} before the call.`,
      at(30, MINUTE),
    )
  })

  const {url} = scenario.space("space")

  // A preview is fetched once per url and memoized for the life of the page.
  const page = await as(users.alice, "/")

  // Registered after as(), so it answers ahead of the harness's own dufflepud.
  await page.context().route(
    requestUrl => requestUrl.pathname === "/link/preview",
    async route => {
      const {url: target}: {url: string} = route.request().postDataJSON()

      if (target === announcement) {
        return route.fulfill({
          json: {
            title: "Flotilla ships v1",
            description: "Everything new in this release.",
            image: "https://images.test/preview.png",
          },
        })
      }

      // What dufflepud answers with for a url it could make nothing of.
      return route.fulfill({json: {}})
    },
  )

  await page.goto(roomPath(url, "general"))

  const card = page.locator(`[data-event="${standalone.id}"]`)
  const failed = page.locator(`[data-event="${broken.id}"]`)
  const inline = page.locator(`[data-event="${sentence.id}"]`)

  await expect(card.getByText("Flotilla ships v1")).toBeVisible()
  await expect(failed.getByRole("link", {name: "example.test/unreadable"})).toBeVisible()

  // The same url mid-sentence, now that the preview it would have shown is known to resolve.
  await expect(inline.getByRole("link", {name: "example.test/announcement"})).toBeVisible()
  await expect(inline.getByText("Flotilla ships v1")).toHaveCount(0)
})

test("US-064 follow a link to another space", async ({seed, as}) => {
  let reference!: Seeded

  const scenario = await seed(({relay, user, at}) => {
    const space = relay("space")
    const other = relay("other")

    space.room("general", {name: "General"})
    space.join(user.alice, "general")
    space.join(user.bob, "general")

    other.room("lounge", {name: "Other Lounge"})
    other.join(user.alice, "lounge")

    // The second space's url only exists once seeding has run, so the message is rendered late.
    reference = space.event(
      user.bob,
      () => makeEvent(MESSAGE, {content: other.url, tags: [["h", "general"]]}),
      at(30, MINUTE),
    )
  })

  const {url} = scenario.space("space")
  const other = scenario.space("other")
  const page = await as(users.alice, roomPath(url, "general"))

  await page
    .locator(`[data-event="${reference.id}"]`)
    .getByRole("link", {name: "other.test"})
    .click()

  await page.waitForURL(next => next.pathname.startsWith(spacePath(other.url)))

  expect(page.context().pages()).toHaveLength(1)
})

test("US-065 see quoted and embedded content", async ({seed, as}) => {
  let original!: Seeded
  let reply!: Seeded
  let thread!: Seeded
  let threadQuote!: Seeded

  const scenario = await seed(({relay, user, at}) => {
    const space = relay("space")

    space.room("general", {name: "General"})
    space.join(user.alice, "general")
    space.join(user.bob, "general")
    space.join(user.carol, "general")

    const point = space.message(user.alice, "general", "the original point", at(6, HOUR))

    // Enough between the two that the original is well off screen when the room opens.
    for (let i = 0; i < 30; i++) {
      space.message(user.bob, "general", `filler message number ${i}`, at(300 - i * 5, MINUTE))
    }

    const topic = space.event(
      user.carol,
      () =>
        space
          .kind(Thread)
          .writer()
          .setRoom(space.url, "general")
          .setTitle("Roadmap for Q3")
          .setContent("Here is what we are planning for the next quarter.")
          .renderTemplate(),
      at(3, HOUR),
    )

    original = point
    thread = topic
    reply = space.reply(user.bob, point, "totally agree with this", at(20, MINUTE))
    threadQuote = space.reply(user.bob, topic, "worth a read", at(15, MINUTE))
  })

  const {url} = scenario.space("space")
  const page = await as(users.alice, roomPath(url, "general"))

  const replyMessage = page.locator(`[data-event="${reply.id}"]`)
  const quoteStrip = replyMessage.locator(".border-l-2")

  await expect(quoteStrip).toContainText("the original point")

  const originalMessage = page.locator(`[data-event="${original.id}"]`)

  await expect(originalMessage).toBeAttached()
  await expect(originalMessage).not.toBeInViewport()

  await quoteStrip.click()

  await expect(originalMessage).toBeInViewport()

  await page.locator(`[data-event="${threadQuote.id}"]`).getByText("Roadmap for Q3").click()

  await page.waitForURL(next => next.pathname === `${spacePath(url)}/threads/${thread.id}`)
})

test("US-066 see distinctive inline tokens", async ({seed, as}) => {
  const mention = `nostr:${npubEncode(users.bob.pubkey)}`
  const content = [
    "Shipping today :partyparrot:",
    `Run \`npm install\` first, then ping ${mention}`,
    "```",
    "const answer = 42",
    "```",
  ].join("\n")

  let tokens!: Seeded

  const scenario = await seed(({relay, user, at}) => {
    const space = relay("space")

    space.room("general", {name: "General"})
    space.join(user.alice, "general")
    space.join(user.bob, "general")
    space.join(user.carol, "general")
    space.profile(user.bob, {name: "Bob Boberton"})
    space.profile(user.carol, {name: "Carol Chen"})

    // Bob posts too, so his profile is loaded against this space before he is mentioned.
    space.message(user.bob, "general", "morning all", at(50, MINUTE))

    // The shortcode's image comes off the message's own emoji tag.
    tokens = space.event(
      user.carol,
      makeEvent(MESSAGE, {
        content,
        tags: [
          ["h", "general"],
          ["emoji", "partyparrot", "https://images.test/partyparrot.png"],
        ],
        created_at: at(40, MINUTE),
      }),
    )
  })

  const {url} = scenario.space("space")
  const page = await as(users.alice, roomPath(url, "general"))

  const message = page.locator(`[data-event="${tokens.id}"]`)

  await expect(message.getByAltText(":partyparrot:")).toBeVisible()
  await expect(message.locator("code").filter({hasText: "npm install"})).toBeVisible()
  await expect(message.locator("code").filter({hasText: "const answer = 42"})).toBeVisible()

  await message.getByRole("button", {name: "@Bob Boberton"}).click()

  await expect(page.getByRole("button", {name: "View Full Profile"})).toBeVisible()
})

test("US-067 copy a shared invoice or token", async ({seed, as}) => {
  let invoice!: Seeded

  const scenario = await seed(({relay, user, at}) => {
    const space = relay("space")

    space.room("general", {name: "General"})
    space.join(user.alice, "general")
    space.join(user.bob, "general")

    invoice = space.message(user.bob, "general", `lightning:${INVOICE}`, at(40, MINUTE))
  })

  const {url} = scenario.space("space")
  const page = await as(users.alice, roomPath(url, "general"), {
    context: {permissions: ["clipboard-read", "clipboard-write"]},
  })

  await page
    .locator(`[data-event="${invoice.id}"]`)
    .getByRole("button", {name: INVOICE.slice(0, 16)})
    .click()

  await expect(page.getByRole("alert")).toBeVisible()
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(INVOICE)
})
