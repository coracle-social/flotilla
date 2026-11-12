import {npubEncode} from "nostr-tools/nip19"
import {HOUR, MINUTE} from "@welshman/lib"
import {MESSAGE, makeEvent} from "@welshman/util"
import {Thread} from "@welshman/domain"
import {expect, roomPath, spacePath, test, users} from "../harness"
import type {SeededEvent} from "../harness"

test("US-060 reveal a flagged sensitive message", async ({seed, as}) => {
  let flagged!: SeededEvent

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

test("US-062 see images and video inline", async ({seed, as}) => {
  let picture!: SeededEvent
  let clip!: SeededEvent
  let mentioned!: SeededEvent

  const scenario = await seed(({relay, user, at}) => {
    const space = relay("space")

    space.room("general", {name: "General"})
    space.join(user.alice, "general")
    space.join(user.bob, "general")

    picture = space.message(user.bob, "general", "https://images.test/sunset.png", at(40, MINUTE))
    clip = space.message(user.bob, "general", "https://media.test/clip.mp4", at(35, MINUTE))
    mentioned = space.message(
      user.bob,
      "general",
      "clip https://media.test/clip.mp4 again",
      at(30, MINUTE),
    )
  })

  const {url} = scenario.space("space")
  const page = await as(users.alice, roomPath(url, "general"))

  const pictureMessage = page.locator(`[data-event="${picture.id}"]`)
  const clipMessage = page.locator(`[data-event="${clip.id}"]`)
  const mentionedMessage = page.locator(`[data-event="${mentioned.id}"]`)
  const inlineImage = pictureMessage.locator('img[src="https://images.test/sunset.png"]')

  await inlineImage.click()

  const preview = page.getByRole("dialog", {name: "Content preview"})
  const backdrop = preview.getByRole("button", {name: "Close preview"})

  await expect(preview.locator("img")).toBeVisible()

  // The dark background closes it, as a tap on the image itself does.
  await backdrop.click({position: {x: 4, y: 4}})

  await expect(preview).toHaveCount(0)
  await expect(clipMessage.locator("video")).toBeVisible()

  // The player keeps the click, so the preview comes from its own button rather than a link.
  await clipMessage.getByRole("button", {name: "Open video"}).click()

  await expect(preview.locator("video")).toBeVisible()

  // A tap on the player plays it, and a tap on the background beside it closes the preview.
  await preview.locator("video").click()

  await expect(preview).toHaveCount(1)

  await backdrop.click({position: {x: 4, y: 4}})

  await expect(preview).toHaveCount(0)

  // A video url mid-sentence opens the same player instead of downloading the file.
  const mentionedLink = mentionedMessage.getByRole("link", {name: "media.test/clip.mp4"})

  await mentionedLink.click()

  await expect(preview.locator("video")).toBeVisible()

  // Escape still closes it, whichever way the preview was opened.
  await page.keyboard.press("Escape")

  await expect(preview).toHaveCount(0)
})

test("US-063 preview a shared link", async ({seed, as}) => {
  const announcement = "https://example.test/announcement"
  const unreadable = "https://example.test/unreadable"

  let standalone!: SeededEvent
  let broken!: SeededEvent
  let sentence!: SeededEvent

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

test("US-065 see quoted and embedded content", async ({seed, as}) => {
  let original!: SeededEvent
  let reply!: SeededEvent
  let thread!: SeededEvent
  let threadQuote!: SeededEvent

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
  const command = [
    "fla trigger-add gitea-pull https://gitea.coracle.social/coracle/flotilla",
    `--agent meta --ask "Keep the pull request's preview in step with it."`,
  ].join(" ")
  const content = [
    "Shipping today :partyparrot:",
    `Run \`npm install\` first, then ping ${mention}`,
    `The preview trigger is \`${command}\` once the update lands`,
    "```",
    "const answer = 42",
    "```",
  ].join("\n")

  let tokens!: SeededEvent

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

  // A long snippet wraps over two or more lines instead of being cut off with an ellipsis.
  const snippet = message.locator("code").filter({hasText: "fla trigger-add"})

  await expect(snippet).toHaveText(command)
  expect(await snippet.evaluate(element => element.getClientRects().length)).toBeGreaterThan(1)

  await message.getByRole("button", {name: "@Bob Boberton"}).click()

  await expect(page.getByRole("button", {name: "View Full Profile"})).toBeVisible()
})
