import * as nip19 from "nostr-tools/nip19"
import {HOUR, MINUTE} from "@welshman/lib"
import {COMMENT, LONG_FORM, MESSAGE, tagSpec, tagValue} from "@welshman/util"
import type {SignedEvent} from "@welshman/util"
import {Article, Comment, Thread} from "@welshman/domain"
import type {Locator, Page} from "@playwright/test"
import {
  emojiButton,
  expect,
  getPublishedEvents,
  modalForm,
  noteEditor,
  pageBar,
  pickEmoji,
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

// A room composer's join is the upload button and then the compose menu.
const openComposeMenu = (page: Page) =>
  page
    .locator("form")
    .filter({has: page.locator(".chat-editor")})
    .locator(".join")
    .getByRole("button")
    .nth(1)
    .click()

// One reaction, added and taken back off again.
const expectReactionRoundTrip = async (page: Page, scope: Locator, opener: Locator) => {
  const pill = scope.getByRole("button", {name: /🎉/})

  await pickEmoji(page, opener, "party popper")
  await expect(pill).toHaveCount(1)

  await pill.click()
  await expect(pill).toHaveCount(0)
}

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
          .setSummary("Heat, and what to do with it.")
          .setTopics(["cooking"])
          .setPublishedAt(at(3, HOUR))
          .setContent("Build the fire first.")
          .renderTemplate(),
      at(3, HOUR),
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

test("US-040 react to a post with an emoji", async ({seed, as}) => {
  const scenario = await seed(({relay, user, at}) => {
    const space = relay("space")

    space.room("general", {name: "General"})
    space.join(user.alice, "general")
    space.join(user.bob, "general")
    space.profile(user.alice, {name: "Alice Anderson"})
    space.profile(user.bob, {name: "Bob Barker"})

    const article = space.event(
      user.alice,
      () =>
        space
          .kind(Article)
          .writer()
          .setIdentifier("tending-the-garden")
          .setTitle("Tending the Garden")
          .setPublishedAt(at(4, HOUR))
          .setContent("Gardens are worth the trouble.")
          .renderTemplate(),
      at(4, HOUR),
    )

    space.event(
      user.alice,
      () =>
        space
          .kind(Comment)
          .writer()
          .setRootFromEvent(article.event)
          .setParentFromEvent(article.event)
          .setContent("A note about the soil chapter.")
          .renderTemplate(),
      at(3, HOUR),
    )
  })

  const {url} = scenario.space("space")
  const page = await as(users.bob, `${spacePath(url)}/articles`)

  await openArticle(page, "Tending the Garden")

  // An article's own reactions live in the action bar under it rather than on the article itself.
  const articleActions = page.locator('[data-component="ArticleActions"]')
  const commentCard = comment(page, "A note about the soil")

  await expect(articleActions).toBeVisible()
  await expectReactionRoundTrip(
    page,
    articleActions,
    articleActions.getByRole("button", {name: "Add a reaction"}),
  )

  await expect(commentCard).toBeVisible()
  await expectReactionRoundTrip(page, commentCard, emojiButton(commentCard))
})

test("US-041 publish an article from a room", async ({seed, as}) => {
  const scenario = await seed(({relay, user}) => {
    const space = relay("space")

    space.room("lounge", {name: "Lounge"})
    space.join(user.alice, "lounge")
    space.profile(user.alice, {name: "Alice Anderson"})
  })

  const {url} = scenario.space("space")
  const page = await as(users.alice, roomPath(url, "lounge"))

  await openComposeMenu(page)
  await page.getByRole("button", {name: "Write an Article"}).click()

  await page.getByPlaceholder("Title", {exact: true}).fill("Repotting in Winter")
  await noteEditor(page).pressSequentially("Wait for a warm week.")
  await pageBar(page).getByRole("button", {name: "Publish"}).click()

  await expect(page.getByRole("heading", {name: "Repotting in Winter"}).first()).toBeVisible()

  // The room's copy is published after the composer has moved on, and a page that unloads takes it.
  await expect.poll(() => getPublishedEvents(page.context(), MESSAGE)).toHaveLength(1)

  await page.goto(roomPath(url, "lounge"))
  await expect(page.getByText("Repotting in Winter")).toBeVisible()

  await page.goto(`${spacePath(url)}/articles`)

  const card = articleCards(page).filter({hasText: "Repotting in Winter"})

  await expect(card.getByRole("link", {name: /#\s*Lounge/})).toBeVisible()
})

test("US-042 start a thread and see it filed under its room", async ({seed, as}) => {
  const scenario = await seed(({relay, user}) => {
    const space = relay("space")

    space.room("lounge", {name: "Lounge"})
    space.join(user.alice, "lounge")
    space.profile(user.alice, {name: "Alice Anderson"})
  })

  const {url} = scenario.space("space")
  const page = await as(users.alice, roomPath(url, "lounge"))

  await openComposeMenu(page)
  await page.getByRole("button", {name: "Create Thread"}).click()

  const fromRoom = modalForm(page, "Create a Thread")

  await fromRoom.getByPlaceholder("What is this thread about?").fill("Bike shed colors")
  await noteEditor(fromRoom).pressSequentially("Blue, surely?")
  await fromRoom.getByRole("button", {name: "Create Thread"}).click()

  await expect(page.getByRole("heading", {name: "Create a Thread"})).toHaveCount(0)

  // The room gets a quote of the thread rather than a second post written by hand.
  await expect(page.getByText("Bike shed colors")).toBeVisible()

  await page.goto(`${spacePath(url)}/threads`)

  const lounge = page.locator("section").filter({has: page.getByRole("heading", {name: "Lounge"})})

  await expect(lounge.getByRole("row").filter({hasText: "Bike shed colors"})).toBeVisible()

  const general = page
    .locator("section")
    .filter({has: page.getByRole("heading", {name: "General", exact: true})})

  // Each board creates its own threads, so the room comes from the button that was clicked.
  await general.getByRole("button", {name: "Create", exact: true}).click()

  const fromThreads = modalForm(page, "Create a Thread")

  await fromThreads.getByPlaceholder("What is this thread about?").fill("Open floor")
  await noteEditor(fromThreads).pressSequentially("Anything goes in here.")
  await fromThreads.getByRole("button", {name: "Create Thread"}).click()

  await expect(page.getByRole("heading", {name: "Create a Thread"})).toHaveCount(0)

  await expect(general.getByRole("row").filter({hasText: "Open floor"})).toBeVisible()
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

  await expect(bob.locator(`[data-event="${thread.id}"]`)).toContainText("Bed rotation")

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

test("US-044 navigate a long thread", async ({seed, as}) => {
  let thread!: Seeded
  let firstReply!: Seeded

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
          .setTitle("The long one")
          .setContent("Settle in.")
          .renderTemplate(),
      at(4, HOUR),
    )

    // Forty one replies is two reveals past the twenty a thread opens with.
    for (let i = 1; i <= 41; i++) {
      const reply = space.event(
        i % 2 === 0 ? user.alice : user.bob,
        () =>
          space
            .kind(Comment)
            .writer()
            .setRootFromEvent(topic.event)
            .setParentFromEvent(topic.event)
            .setContent(`Reply ${String(i).padStart(2, "0")}`)
            .renderTemplate(),
        at(4, HOUR) + i * 60,
      )

      if (i === 1) {
        firstReply = reply
      }
    }

    thread = topic
  })

  const {url} = scenario.space("space")
  const threadPath = `${spacePath(url)}/threads/${thread.id}`
  const bob = await as(users.bob, threadPath, {
    context: {permissions: ["clipboard-read", "clipboard-write"]},
  })

  const showEarlier = bob.getByRole("button", {name: "Show earlier replies"})

  // Every assertion below is about which of the replies are in the window, so wait for all of them.
  await expect(bob.getByText("41 replies")).toBeVisible()

  // The thread opens on its newest twenty replies.
  await expect(bob.getByText("Reply 22", {exact: true})).toBeVisible()
  await expect(bob.getByText("Reply 21", {exact: true})).toHaveCount(0)

  // Each reveal reaches twenty further back without leaving the page.
  await showEarlier.click()

  await expect(bob.getByText("Reply 02", {exact: true})).toBeVisible()
  await expect(bob.getByText("Reply 01", {exact: true})).toHaveCount(0)

  await showEarlier.click()

  await expect(bob.getByText("Reply 01", {exact: true})).toBeVisible()
  await expect(showEarlier).toHaveCount(0)

  const oldestPost = bob.locator(`[data-event="${firstReply.id}"]`)

  await oldestPost.getByRole("button", {name: "Permalink"}).click()
  await expect(bob.getByRole("alert")).toBeVisible()

  const permalink = new URL(await bob.evaluate(() => navigator.clipboard.readText()))

  expect(permalink.pathname).toBe(threadPath)

  // A permalink reaches back as far as it has to on its own, so carol never sees the control.
  const carol = await as(users.carol, permalink.pathname + permalink.search)
  const target = carol.locator(`[data-event="${firstReply.id}"]`)

  await expect(target).toBeVisible()
  await expect(target).toBeInViewport()
  await expect(carol.getByRole("button", {name: "Show earlier replies"})).toHaveCount(0)
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

  const composer = modalForm(page, "Create a Thread")

  await composer.getByPlaceholder("What is this thread about?").fill("Deploy failures")
  await composer.getByRole("button", {name: "Create Thread"}).click()

  await expect(page.getByRole("heading", {name: "Create a Thread"})).toHaveCount(0)
  await expect(message.getByRole("link", {name: "Deploy failures"})).toBeVisible()

  await page.goto(`${spacePath(url)}/threads`)

  const lounge = page.locator("section").filter({has: page.getByRole("heading", {name: "Lounge"})})

  await lounge.getByRole("row").filter({hasText: "Deploy failures"}).click()

  await expect(page.locator("article").filter({hasText: "Deploy failures"})).toBeVisible()
  await expect(page.getByText("the deploy broke again")).toBeVisible()
})
