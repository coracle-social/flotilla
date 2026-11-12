import * as nip19 from "nostr-tools/nip19"
import {HOUR, MINUTE} from "@welshman/lib"
import {COMMENT, LONG_FORM, tagSpec, tagValue} from "@welshman/util"
import type {SignedEvent} from "@welshman/util"
import {Article, Comment, Thread} from "@welshman/domain"
import type {Page} from "@playwright/test"
import {
  expect,
  getPublishedEvents,
  dialog,
  noteEditor,
  pageBar,
  roomPath,
  spacePath,
  test,
  users,
} from "../harness"

// A handle to a seeded event, which only reads once seed() has drained its queue.
type Seeded = {readonly id: string; readonly event: SignedEvent}

// The comment and thread-reply composers are the only forms on their pages with a rich text editor.
const composerForm = (page: Page) =>
  page.locator("form").filter({has: page.locator(".note-editor")})

// The card is a div carrying an overlay link, so it is found by its component rather than a role.
const articleCards = (page: Page) => page.locator('[data-component="ArticleItem"]')

// A comment is a flat block rather than a card, and the marker sits on its own row, not its replies.
const comment = (page: Page, text: string) =>
  page.locator('[data-component="Comment"]').filter({hasText: text})

// Clicked near its top-left: a card whose footer wraps puts an interactive row under the centre.
const openArticle = async (page: Page, title: string) => {
  await articleCards(page)
    .filter({hasText: title})
    .getByRole("link", {name: title, exact: true})
    .click({position: {x: 20, y: 20}})

  // The card's own action bar carries the same data-component, and the list is still on screen.
  await expect(page.locator("article header").getByRole("heading", {name: title})).toBeVisible()
}

test("US-037 write and publish an article", async ({seed, as}) => {
  const scenario = await seed(({relay, user}) => {
    const space = relay("space")

    space.room("general", {name: "General"})
    space.join(user.alice, "general")
    space.profile(user.alice, {name: "Alice Anderson"})
  })

  const {url} = scenario.space("space")
  const page = await as(users.alice, `${spacePath(url)}/articles`)

  await pageBar(page).getByRole("button", {name: "Write"}).click()

  const publish = pageBar(page).getByRole("button", {name: "Publish"})
  const title = page.getByPlaceholder("Title", {exact: true})
  const body = noteEditor(page)

  await title.fill("Half Baked")
  await body.pressSequentially("Only the beginning.")

  await page.goBack()

  // Reopening picks up where the composer was closed rather than starting over.
  await pageBar(page).getByRole("button", {name: "Write"}).click()
  await expect(title).toHaveValue("Half Baked")
  await expect(body).toContainText("Only the beginning.")

  await title.fill("Signals in the Noise")
  await publish.click()

  // Publishing lands on the article itself rather than back on the list.
  await expect(page.getByRole("heading", {name: "Signals in the Noise"}).first()).toBeVisible()
  expect(getPublishedEvents(page.context(), LONG_FORM)).toHaveLength(1)

  await page.goto(`${spacePath(url)}/articles`)

  await expect(articleCards(page).filter({hasText: "Signals in the Noise"})).toBeVisible()

  // A published article leaves the composer empty for the next one.
  await pageBar(page).getByRole("button", {name: "Write"}).click()
  await expect(title).toHaveValue("")
  await expect(body).toHaveText("")
})

test("US-038 browse, filter, and read articles", async ({seed, as}) => {
  const body = [
    "## Why gardens matter",
    "",
    "Gardens are worth the trouble.",
    "",
    `Ask ${nip19.npubEncode(users.carol.pubkey)} what she thinks.`,
  ].join("\n")

  const scenario = await seed(({relay, user, at}) => {
    const space = relay("space")

    space.room("general", {name: "General"})
    space.join(user.alice, "general")
    space.join(user.bob, "general")
    space.join(user.carol, "general")
    space.profile(user.alice, {name: "Alice Anderson"})
    space.profile(user.bob, {name: "Bob Barker"})
    space.profile(user.carol, {name: "Carol Chen"})

    space.event(
      user.alice,
      () =>
        space
          .kind(Article)
          .writer()
          .setIdentifier("tending-the-garden")
          .setTitle("Tending the Garden")
          .setSummary("A short teaser about gardens.")
          .setImage("https://images.test/garden.jpg")
          .setTopics(["gardening"])
          .setPublishedAt(at(4, HOUR))
          .setContent(body)
          .renderTemplate(),
      at(4, HOUR),
    )

    space.event(
      user.alice,
      () =>
        space
          .kind(Article)
          .writer()
          .setIdentifier("cooking-with-fire")
          .setTitle("Cooking with Fire")
          .setTopics(["cooking"])
          .setPublishedAt(at(3, HOUR))
          .setContent("## Build the fire first\n\nThen wait.")
          .renderTemplate(),
      at(10, MINUTE),
    )

    space.event(
      user.bob,
      () =>
        space
          .kind(Article)
          .writer()
          .setIdentifier("notes-on-foraging")
          .setTitle("Notes on Foraging")
          .setSummary("What grows where nobody planted it.")
          .setTopics(["gardening"])
          .setPublishedAt(at(2, HOUR))
          .setContent("Look under the hedges.")
          .renderTemplate(),
      at(2, HOUR),
    )
  })

  const {url} = scenario.space("space")
  const page = await as(users.bob, `${spacePath(url)}/articles`)

  const garden = articleCards(page).filter({hasText: "Tending the Garden"})

  await expect(articleCards(page)).toHaveCount(3)
  await expect(garden).toContainText("Alice Anderson")
  await expect(garden).toContainText("A short teaser about gardens.")

  // Newest published first: cooking was written last but went out between the other two, and its
  // body is drawn as markdown rather than as a flattened summary.
  await expect(articleCards(page).nth(1)).toContainText("Cooking with Fire")
  await expect(
    articleCards(page).nth(1).getByRole("heading", {name: "Build the fire first"}),
  ).toBeVisible()

  const authors = page
    .locator("section")
    .filter({has: page.getByRole("heading", {name: "Authors"})})
  const topics = page.locator("section").filter({has: page.getByRole("heading", {name: "Topics"})})

  await topics.getByRole("button", {name: /^#gardening/}).click()
  await expect(articleCards(page)).toHaveCount(2)
  await expect(articleCards(page).filter({hasText: "Notes on Foraging"})).toBeVisible()

  // Author and topic together are narrower than either on its own.
  await authors.getByRole("button", {name: /Alice Anderson/}).click()
  await expect(articleCards(page)).toHaveCount(1)
  await expect(articleCards(page).first()).toContainText("Tending the Garden")

  await openArticle(page, "Tending the Garden")

  await expect(page.locator('img[src="https://images.test/garden.jpg"]')).toBeVisible()

  const markdown = page.locator(".content-markdown")

  await expect(markdown.getByRole("heading", {name: "Why gardens matter"})).toBeVisible()
  await expect(markdown.getByRole("link", {name: "@Carol Chen"})).toBeVisible()
})

test("US-039 comment on an article", async ({seed, as}) => {
  const scenario = await seed(({relay, user, at}) => {
    const space = relay("space")

    space.room("general", {name: "General"})
    space.join(user.alice, "general")
    space.join(user.bob, "general")
    space.join(user.carol, "general")
    space.profile(user.alice, {name: "Alice Anderson"})
    space.profile(user.bob, {name: "Bob Barker"})
    space.profile(user.carol, {name: "Carol Chen"})

    space.event(
      user.alice,
      () =>
        space
          .kind(Article)
          .writer()
          .setRoom(space.url, "general")
          .setIdentifier("tending-the-garden")
          .setTitle("Tending the Garden")
          .setSummary("A short teaser about gardens.")
          .setPublishedAt(at(4, HOUR))
          .setContent("Gardens are worth the trouble.")
          .renderTemplate(),
      at(4, HOUR),
    )
  })

  const {url} = scenario.space("space")
  const articlesPath = `${spacePath(url)}/articles`

  const bob = await as(users.bob, articlesPath)

  await openArticle(bob, "Tending the Garden")
  await bob.getByRole("button", {name: "Add a comment"}).click()
  await noteEditor(composerForm(bob)).pressSequentially("The soil chapter is the good one.")
  await composerForm(bob).getByRole("button", {name: "Comment"}).click()

  // The composer holds what was typed until the relay confirms it, so the page carries this text twice.
  await expect(comment(bob, "The soil chapter is the good one.")).toBeVisible()

  // A comment on a room event is a room event, so without the room tag the relay sees no group.
  await expect
    .poll(() =>
      getPublishedEvents(bob.context(), COMMENT).map(event => tagValue(tagSpec("h"), event.tags)),
    )
    .toEqual(["general"])

  const carol = await as(users.carol, articlesPath)

  await openArticle(carol, "Tending the Garden")

  const bobsComment = comment(carol, "The soil chapter is the good one.")

  await expect(bobsComment).toBeVisible()

  await bobsComment.getByRole("button", {name: "Reply", exact: true}).click()
  await noteEditor(composerForm(carol)).pressSequentially(
    "Only because you skipped the water chapter.",
  )
  await composerForm(carol).getByRole("button", {name: "Reply", exact: true}).click()

  await expect(comment(carol, "Only because you skipped the water chapter.")).toBeVisible()

  const alice = await as(users.alice, articlesPath)

  await openArticle(alice, "Tending the Garden")

  // A reply is nested inside the comment it answers; a top level comment is not.
  const nested = alice.locator('[data-component="CommentReplies"]')

  await expect(nested.getByText("Only because you skipped the water chapter.")).toBeVisible()
  await expect(nested.getByText("The soil chapter is the good one.")).toHaveCount(0)
})

test("US-042 start a thread and see it filed under its room", async ({seed, as}) => {
  const scenario = await seed(({relay, user}) => {
    const space = relay("space")

    space.room("lounge", {name: "Lounge"})
    space.join(user.alice, "lounge")
    space.profile(user.alice, {name: "Alice Anderson"})
  })

  const {url} = scenario.space("space")

  // A board is one room's topics, so a topic started from the lounge board is filed under Lounge.
  const page = await as(users.alice, `${spacePath(url)}/threads?board=lounge`)

  await page.getByRole("button", {name: "New topic"}).click()

  const fromBoard = dialog(page, "Create a Thread")

  await fromBoard.getByPlaceholder("What is this thread about?").fill("Bike shed colors")
  await noteEditor(fromBoard).pressSequentially("Blue, surely?")
  await fromBoard.getByRole("button", {name: "Create Thread"}).click()

  await expect(page.getByRole("heading", {name: "Create a Thread"})).toHaveCount(0)

  // The board lists the room's topics, so the new one is there.
  await expect(page.getByRole("link").filter({hasText: "Bike shed colors"})).toBeVisible()

  await page.goto(`${spacePath(url)}/threads`)

  const latest = page.locator("section").filter({has: page.getByRole("heading", {name: "Latest"})})

  await expect(latest.getByRole("link").filter({hasText: "Bike shed colors"})).toBeVisible()

  // The header's New topic button creates in the default room, General.
  await page.getByRole("button", {name: "New topic"}).click()

  const fromThreads = dialog(page, "Create a Thread")

  await fromThreads.getByPlaceholder("What is this thread about?").fill("Open floor")
  await noteEditor(fromThreads).pressSequentially("Anything goes in here.")
  await fromThreads.getByRole("button", {name: "Create Thread"}).click()

  await expect(page.getByRole("heading", {name: "Create a Thread"})).toHaveCount(0)

  await expect(latest.getByRole("link").filter({hasText: "Open floor"})).toBeVisible()
})

test("US-043 reply to a thread and to a specific post", async ({seed, as}) => {
  let thread!: Seeded

  const scenario = await seed(({relay, user, at}) => {
    const space = relay("space")

    space.room("lounge", {name: "Lounge"})
    space.join(user.alice, "lounge")
    space.join(user.bob, "lounge")
    space.join(user.carol, "lounge")
    space.profile(user.alice, {name: "Alice Anderson"})
    space.profile(user.bob, {name: "Bob Barker"})
    space.profile(user.carol, {name: "Carol Chen"})

    const topic = space.event(
      user.alice,
      () =>
        space
          .kind(Thread)
          .writer()
          .setRoom(space.url, "lounge")
          .setTitle("Bed rotation")
          .setContent("How often do you move things around?")
          .renderTemplate(),
      at(3, HOUR),
    )

    space.event(
      user.bob,
      () =>
        space
          .kind(Comment)
          .writer()
          .setRootFromEvent(topic.event)
          .setParentFromEvent(topic.event)
          .setContent("Every other season.")
          .renderTemplate(),
      at(2, HOUR),
    )

    thread = topic
  })

  const {url} = scenario.space("space")
  const threadPath = `${spacePath(url)}/threads/${thread.id}`
  const bob = await as(users.bob, threadPath)

  await expect(bob.getByText("Bed rotation").first()).toBeVisible()

  await bob.getByRole("button", {name: "Reply to thread"}).click()

  const threadReply = composerForm(bob)

  await noteEditor(threadReply).pressSequentially("Twice a year here.")
  await threadReply.getByRole("button", {name: "Post Reply"}).click()

  await expect(bob.getByText("Twice a year here.")).toBeVisible()

  // A thread reply goes out through its own composer, which needs the room tag too.
  await expect
    .poll(() =>
      getPublishedEvents(bob.context(), COMMENT).map(event => tagValue(tagSpec("h"), event.tags)),
    )
    .toEqual(["lounge"])

  const carol = await as(users.carol, threadPath)
  const bobsPost = carol.locator("article").filter({hasText: "Every other season."})

  await bobsPost.getByRole("button", {name: "Reply", exact: true}).click()

  const postReply = composerForm(carol)

  await expect(postReply).toContainText("Replying to @Bob Barker")

  await noteEditor(postReply).pressSequentially("Every season here.")
  await postReply.getByRole("button", {name: "Post Reply"}).click()

  await expect(carol.getByText("Every season here.")).toBeVisible()
})

test("US-045 turn a chat message into a thread", async ({seed, as}) => {
  let promoted!: Seeded

  const scenario = await seed(({relay, user, at}) => {
    const space = relay("space")

    space.room("lounge", {name: "Lounge"})
    space.join(user.alice, "lounge")
    space.join(user.bob, "lounge")
    space.profile(user.alice, {name: "Alice Anderson"})
    space.profile(user.bob, {name: "Bob Barker"})

    promoted = space.message(user.alice, "lounge", "the deploy broke again", at(20, MINUTE))
  })

  const {url} = scenario.space("space")
  const page = await as(users.bob, roomPath(url, "lounge"))

  const message = page.locator(`[data-event="${promoted.id}"]`)

  await expect(message).toBeVisible()
  await message.hover()

  // RoomItem's hover actions are zap, emoji, reply and menu, all of them icons.
  await message.locator(".room__item-actions").getByRole("button").last().click()
  await page.getByRole("button", {name: "Create a Thread"}).click()

  const composer = dialog(page, "Create a Thread")

  await composer.getByPlaceholder("What is this thread about?").fill("Deploy failures")
  await composer.getByRole("button", {name: "Create Thread"}).click()

  await expect(page.getByRole("heading", {name: "Create a Thread"})).toHaveCount(0)
  await expect(message.getByRole("link", {name: "Deploy failures"})).toBeVisible()

  await page.goto(`${spacePath(url)}/threads`)

  const latest = page.locator("section").filter({has: page.getByRole("heading", {name: "Latest"})})

  await latest.getByRole("link").filter({hasText: "Deploy failures"}).click()

  await expect(page.locator("article").filter({hasText: "the deploy broke again"})).toBeVisible()
  await expect(page.getByText("the deploy broke again")).toBeVisible()
})
