import * as nip19 from "nostr-tools/nip19"
import {HOUR, MINUTE} from "@welshman/lib"
import {COMMENT, LONG_FORM, MESSAGE, NOTE, makeEvent, tagSpec, tagValue} from "@welshman/util"
import type {SignedEvent} from "@welshman/util"
import {Article, Comment, Thread} from "@welshman/domain"
import type {Locator, Page} from "@playwright/test"
import {
  DEFAULT_BLOSSOM_ORIGIN,
  GIF,
  emojiButton,
  expect,
  getPublishedEvents,
  mockBlossom,
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

const PARTY = "🎉"

// The comment and thread-reply composers are the only forms on their pages carrying a rich text
// editor.
const composerForm = (page: Page) =>
  page.locator("form").filter({has: page.locator(".note-editor")})

// RoomCompose's join is the upload button and then the compose menu, which is where an article or
// a thread written from inside a room is started.
const openComposeMenu = (page: Page) =>
  page
    .locator("form")
    .filter({has: page.locator(".chat-editor")})
    .locator(".join")
    .getByRole("button")
    .nth(1)
    .click()

const pickParty = (page: Page, opener: Locator) => pickEmoji(page, opener, "party popper")

// One reaction, recorded as the reader's own, and taken back off again.
const expectReactionRoundTrip = async (page: Page, scope: Locator, opener: Locator) => {
  const pill = scope.getByRole("button", {name: new RegExp(PARTY)})

  await pickParty(page, opener)
  await expect(pill).toHaveCount(1)
  await expect(pill).toHaveClass(/button-primary/)

  await pill.click()
  await expect(pill).toHaveCount(0)
}

// formatTimestamp renders a short date and a short time, so the date half of it is what a spec can
// name without pinning a format. Formatted by the browser rather than by node, so the locale and the
// timezone are the ones the app rendered with — see dayLabel in dms.spec.ts.
const shortDate = (page: Page, seconds: number) =>
  page.evaluate(
    ts => new Intl.DateTimeFormat(undefined, {dateStyle: "short"}).format(new Date(ts * 1000)),
    seconds,
  )

// The card is a div carrying an overlay link, so it is found by its component rather than by a
// role — its own contents include a profile button and the room and action links.
const articleCards = (page: Page) => page.locator('[data-component="ArticleItem"]')

// A comment is a flat block in the tree rather than a card, so it carries a component marker for
// the specs to name; the marker sits on the comment's own row, not on its replies.
const comment = (page: Page, text: string) =>
  page.locator('[data-component="Comment"]').filter({hasText: text})

// Clicked near its top-left corner rather than at its centre: the link is an overlay covering the
// whole card, and a card whose footer wraps onto a second line puts that interactive row under the
// centre point, where it swallows the click.
const openArticle = (page: Page, title: string) =>
  articleCards(page)
    .filter({hasText: title})
    .getByRole("link", {name: title, exact: true})
    .click({position: {x: 20, y: 20}})

test("US-037 write and publish an article", async ({seed, as}) => {
  const scenario = await seed(({relay, user, at}) => {
    const space = relay("space")

    space.room("general", {name: "General"})
    space.join(user.alice, "general")
    space.join(user.bob, "general")
    space.profile(user.alice, {name: "Alice Anderson"})
    space.profile(user.bob, {name: "Bob Barker"})

    // An older article, so "at the top of the list" is a statement about order.
    space.event(
      user.bob,
      () =>
        space
          .kind(Article)
          .writer()
          .setIdentifier("old-news")
          .setTitle("Old News")
          .setSummary("Something published a while back.")
          .setPublishedAt(at(3, HOUR))
          .setContent("Yesterday's headlines.")
          .renderTemplate(),
      at(3, HOUR),
    )
  })

  const {url} = scenario.space("space")
  const page = await as(users.alice, `${spacePath(url)}/articles`)

  await expect(articleCards(page)).toHaveCount(1)

  await pageBar(page).getByRole("button", {name: "Write"}).click()

  const publish = pageBar(page).getByRole("button", {name: "Publish"})
  const title = page.getByPlaceholder("Title", {exact: true})
  const body = noteEditor(page)

  await expect(title).toBeVisible()

  await publish.click()
  await expect(page.getByRole("alert")).toContainText("Please provide a title for your article.")

  await title.fill("Half Baked")
  await publish.click()
  await expect(page.getByRole("alert")).toContainText("Please write something for your article.")

  await body.pressSequentially("Only the beginning.")

  // Neither refusal put anything on the wire.
  expect(getPublishedEvents(page.context(), LONG_FORM)).toEqual([])

  await page.goBack()
  await expect(articleCards(page)).toHaveCount(1)

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

  await expect(articleCards(page)).toHaveCount(2)
  await expect(articleCards(page).first()).toContainText("Signals in the Noise")

  // A published article leaves the composer empty for the next one.
  await pageBar(page).getByRole("button", {name: "Write"}).click()
  await expect(title).toHaveValue("")
  await expect(body).toHaveText("")
})

test("US-038 browse, filter, and read articles", async ({seed, as}) => {
  const body = [
    "## Why gardens matter",
    "",
    "Gardens are **worth the trouble**.",
    "",
    "- Soil",
    "- Water",
    "- Sunlight",
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

    space.event(
      user.carol,
      () =>
        space
          .kind(Article)
          .writer()
          .setIdentifier("winter-reading")
          .setTitle("Winter Reading")
          .setSummary("Six books for the dark months.")
          .setTopics([
            "books",
            "keepnostrweird",
            "longform",
            "recommendations",
            "wintering",
            "shortdays",
          ])
          .setPublishedAt(at(1, HOUR))
          .setContent("Start with the shortest one.")
          .renderTemplate(),
      at(1, HOUR),
    )
  })

  const {at} = scenario
  const {url} = scenario.space("space")
  const page = await as(users.bob, `${spacePath(url)}/articles`)

  const garden = articleCards(page).filter({hasText: "Tending the Garden"})

  await expect(articleCards(page)).toHaveCount(4)

  // Author, published date and a preview, all on the card itself.
  await expect(garden).toContainText("Written by")
  await expect(garden).toContainText("Alice Anderson")
  await expect(garden).toContainText("A short teaser about gardens.")
  await expect(garden).toContainText(await shortDate(page, at(4, HOUR)))

  // A card with more topics than fit on one line wraps them, rather than widening its action row
  // until the reactions and the action menu fall off the card's edge.
  const winter = articleCards(page).filter({hasText: "Winter Reading"})
  const winterBox = (await winter.boundingBox())!
  const winterActions = (await winter.locator('[data-component="ArticleActions"]').boundingBox())!

  expect(winterActions.x + winterActions.width).toBeLessThanOrEqual(winterBox.x + winterBox.width)

  const authors = page
    .locator("section")
    .filter({has: page.getByRole("heading", {name: "Authors"})})
  const topics = page.locator("section").filter({has: page.getByRole("heading", {name: "Topics"})})

  await expect(authors.getByRole("button", {name: /Alice Anderson/})).toBeVisible()
  await expect(authors.getByRole("button", {name: /Carol Chen/})).toBeVisible()

  await topics.getByRole("button", {name: /^#gardening/}).click()
  await expect(articleCards(page)).toHaveCount(2)
  await expect(articleCards(page).filter({hasText: "Notes on Foraging"})).toBeVisible()

  // Author and topic together are narrower than either on its own.
  await authors.getByRole("button", {name: /Alice Anderson/}).click()
  await expect(articleCards(page)).toHaveCount(1)
  await expect(articleCards(page).first()).toContainText("Tending the Garden")

  await openArticle(page, "Tending the Garden")

  await expect(page.getByRole("heading", {name: "Tending the Garden"}).first()).toBeVisible()
  await expect(page.locator('img[src="https://images.test/garden.jpg"]')).toBeVisible()
  await expect(page.getByText("A short teaser about gardens.")).toBeVisible()
  // The byline pairs the published date with the reading time, so the header is what carries it.
  await expect(page.locator("article header")).toContainText(await shortDate(page, at(4, HOUR)))

  const markdown = page.locator(".content-markdown")

  await expect(markdown.getByRole("heading", {name: "Why gardens matter"})).toBeVisible()
  await expect(markdown.locator("strong")).toHaveText("worth the trouble")
  await expect(markdown.locator("li")).toHaveText(["Soil", "Water", "Sunlight"])
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

  // The comment renders from the optimistic write, but the composer holds what was typed until the
  // relay confirms it, so for a moment the page carries this text twice. Match the rendered comment.
  await expect(comment(bob, "The soil chapter is the good one.")).toBeVisible()

  // A comment on a room event is a room event, so it carries the room the root lives in. Without
  // that tag the relay doesn't see it as part of the group, and neither its access rules nor a
  // room deletion ever reach it.
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

  await mockBlossom(alice.context(), {server: DEFAULT_BLOSSOM_ORIGIN})
  await openArticle(alice, "Tending the Garden")

  await expect(alice.getByText("The soil chapter is the good one.")).toBeVisible()
  await expect(alice.getByText("Only because you skipped the water chapter.")).toBeVisible()

  // A reply is nested inside the comment it answers; a top level comment is not.
  const nested = alice.locator('[data-component="CommentReplies"]')

  await expect(nested.getByText("Only because you skipped the water chapter.")).toBeVisible()
  await expect(nested.getByText("The soil chapter is the good one.")).toHaveCount(0)

  await alice.getByRole("button", {name: "Add a comment"}).click()

  const composer = composerForm(alice)

  await noteEditor(composer).pressSequentially("Thanks both, here's the bed I meant.")
  await noteEditor(composer).press("Enter")

  const chooser = alice.waitForEvent("filechooser")

  await composer.locator('[data-tip="Add an image"]').click()
  await (await chooser).setFiles({name: "bed.gif", mimeType: "image/gif", buffer: GIF})

  // The attachment carries an uploading marker from the moment the request goes out until the
  // blossom descriptor comes back and replaces its blob url.
  await expect(composer.locator(".tiptap-object")).not.toHaveClass(/tiptap-uploading/)

  await composer.getByRole("button", {name: "Comment"}).click()

  const alicesComment = comment(alice, "Thanks both, here's the bed I meant.")

  await expect(alicesComment).toBeVisible()
  await expect(alicesComment.locator(`img[src^="${DEFAULT_BLOSSOM_ORIGIN}/"]`)).toBeVisible()
})

test("US-040 react to a post with an emoji", async ({seed, as}) => {
  let thread!: Seeded

  const scenario = await seed(({relay, user, at}) => {
    const space = relay("space")

    space.room("general", {name: "General"})
    space.join(user.alice, "general")
    space.join(user.bob, "general")
    space.profile(user.alice, {name: "Alice Anderson"})
    space.profile(user.bob, {name: "Bob Barker"})

    // A profile's notes are loaded through its author's outbox relays, so alice needs a relay list
    // for her note to be findable at all.
    space.relayList(user.alice)

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

    const topic = space.event(
      user.alice,
      () =>
        space
          .kind(Thread)
          .writer()
          .setRoom(space.url, "general")
          .setTitle("Bed rotation")
          .setContent("How often do you move things around?")
          .renderTemplate(),
      at(3, HOUR),
    )

    space.event(
      user.alice,
      () =>
        space
          .kind(Comment)
          .writer()
          .setRootFromEvent(topic.event)
          .setParentFromEvent(topic.event)
          .setContent("Every other season, usually.")
          .renderTemplate(),
      at(2, HOUR),
    )

    space.event(
      user.alice,
      makeEvent(NOTE, {content: "A short note from the garden.", created_at: at(2, HOUR)}),
    )

    thread = topic
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

  await page.goto(`${spacePath(url)}/threads/${thread.id}`)

  const threadPost = page.locator("article").filter({hasText: "Every other season, usually."})

  await expect(threadPost).toBeVisible()
  await expectReactionRoundTrip(page, threadPost, emojiButton(threadPost))

  await page.goto(`/people/${nip19.npubEncode(users.alice.pubkey)}`)

  const noteCard = page
    .locator(".card.card-interactive")
    .filter({hasText: "A short note from the garden."})

  await expect(noteCard).toBeVisible()

  // NoteItem's picker is the last control on the card rather than part of an EventActions join.
  await expectReactionRoundTrip(page, noteCard, noteCard.getByRole("button").last())
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

  // The room hears about the article without alice posting it a second time. Its copy is published
  // after the composer has moved on, so wait for it to leave — a page that unloads mid-publish
  // takes it with it.
  await expect.poll(() => getPublishedEvents(page.context(), MESSAGE)).toHaveLength(1)

  await page.goto(roomPath(url, "lounge"))
  await expect(page.getByText("Repotting in Winter")).toBeVisible()

  await page.goto(`${spacePath(url)}/articles`)

  const card = articleCards(page).filter({hasText: "Repotting in Winter"})

  await expect(card).toBeVisible()
  await expect(card.getByRole("link", {name: /#\s*Lounge/})).toBeVisible()

  await openArticle(page, "Repotting in Winter")

  // A card says which room an article was posted in; the article's own page carries that in its
  // page bar instead.
  const roomLink = pageBar(page).getByRole("link", {name: /#\s*Lounge/})

  await expect(roomLink).toBeVisible()

  await roomLink.click()

  await expect(page).toHaveURL(new RegExp(`${roomPath(url, "lounge")}$`))
  await expect(page.locator(".chat-editor")).toBeVisible()
})

test("US-042 start a thread and see it filed under its room", async ({seed, as}) => {
  const scenario = await seed(({relay, user, at}) => {
    const space = relay("space")

    space.room("lounge", {name: "Lounge"})
    space.join(user.alice, "lounge")
    space.join(user.bob, "lounge")
    space.profile(user.alice, {name: "Alice Anderson"})
    space.profile(user.bob, {name: "Bob Barker"})

    // An older topic with replies, so the board's reply count and last-post time are statements
    // about the thread rather than about an empty row.
    const topic = space.event(
      user.bob,
      () =>
        space
          .kind(Thread)
          .writer()
          .setRoom(space.url, "lounge")
          .setTitle("Chair procurement")
          .setContent("The old ones are done for.")
          .renderTemplate(),
      at(5, HOUR),
    )

    const replies = ["Mesh, obviously.", "Anything but mesh."]

    replies.forEach((content, index) => {
      space.event(
        index === 0 ? user.alice : user.bob,
        () =>
          space
            .kind(Comment)
            .writer()
            .setRootFromEvent(topic.event)
            .setParentFromEvent(topic.event)
            .setContent(content)
            .renderTemplate(),
        at(4, HOUR) + index * 60,
      )
    })
  })

  const {at} = scenario
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
  const chairs = lounge.getByRole("row").filter({hasText: "Chair procurement"})

  await expect(lounge.getByRole("row").filter({hasText: "Bike shed colors"})).toBeVisible()

  // Topic, author, reply count and last post, in that order.
  await expect(chairs.getByRole("cell").nth(0)).toContainText("Chair procurement")
  await expect(chairs.getByRole("cell").nth(1)).toContainText("Bob Barker")
  await expect(chairs.getByRole("cell").nth(2)).toHaveText("2")
  await expect(chairs.getByRole("cell").nth(3)).toContainText(
    await shortDate(page, at(4, HOUR) + 60),
  )

  const general = page
    .locator("section")
    .filter({has: page.getByRole("heading", {name: "General", exact: true})})

  // Each board creates its own threads, so the room comes from the button that was clicked rather
  // than from a picker.
  await general.getByRole("button", {name: "Create", exact: true}).click()

  const fromThreads = modalForm(page, "Create a Thread")

  await fromThreads.getByPlaceholder("What is this thread about?").fill("Open floor")
  await noteEditor(fromThreads).pressSequentially("Anything goes in here.")
  await fromThreads.getByRole("button", {name: "Create Thread"}).click()

  await expect(page.getByRole("heading", {name: "Create a Thread"})).toHaveCount(0)

  await expect(general.getByRole("row").filter({hasText: "Open floor"})).toBeVisible()

  await lounge.getByRole("button", {name: "Create", exact: true}).click()

  const toLounge = modalForm(page, "Create a Thread")

  await toLounge.getByPlaceholder("What is this thread about?").fill("Carpet swatches")
  await noteEditor(toLounge).pressSequentially("Beige is a choice.")
  await toLounge.getByRole("button", {name: "Create Thread"}).click()

  await expect(page.getByRole("heading", {name: "Create a Thread"})).toHaveCount(0)

  await expect(lounge.getByRole("row").filter({hasText: "Carpet swatches"})).toBeVisible()
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

    // Twenty replies is exactly the window a thread opens with, and the last of them is alice's,
    // so her OP badge has to survive bob's own reply pushing the oldest one out of it.
    for (let i = 1; i <= 20; i++) {
      space.event(
        i === 20 ? user.alice : i % 2 === 0 ? user.carol : user.bob,
        () =>
          space
            .kind(Comment)
            .writer()
            .setRootFromEvent(topic.event)
            .setParentFromEvent(topic.event)
            .setContent(`Reply ${String(i).padStart(2, "0")}`)
            .renderTemplate(),
        at(3, HOUR) + i * 60,
      )
    }

    thread = topic
  })

  const {url} = scenario.space("space")
  const threadPath = `${spacePath(url)}/threads/${thread.id}`
  const bob = await as(users.bob, threadPath)

  const openingPost = bob.locator(`[data-event="${thread.id}"]`)

  await expect(openingPost).toBeVisible()
  await expect(openingPost.getByText("OP", {exact: true})).toBeVisible()
  await expect(bob.getByText("20 replies")).toBeVisible()

  // The page bar carries the title, so the opening post does not repeat it.
  await expect(bob.getByText("Bed rotation")).toHaveCount(1)

  await bob.getByRole("button", {name: "Reply to thread"}).click()

  const threadReply = composerForm(bob)

  await expect(threadReply).toBeVisible()
  await expect(threadReply.getByText(/^Replying to/)).toHaveCount(0)

  await noteEditor(threadReply).pressSequentially("Twice a year here.")
  await threadReply.getByRole("button", {name: "Post Reply"}).click()

  await expect(bob.getByText("21 replies")).toBeVisible()
  await expect(bob.getByText("Twice a year here.")).toBeVisible()

  // The same for a thread reply, which goes out through a different composer.
  await expect
    .poll(() =>
      getPublishedEvents(bob.context(), COMMENT).map(event => tagValue(tagSpec("h"), event.tags)),
    )
    .toEqual(["lounge"])

  // His is the twenty first reply, so the oldest one drops out of the window, and the opening
  // post stays above whatever the window holds.
  const showEarlier = bob.getByRole("button", {name: "Show earlier replies"})

  await expect(showEarlier).toBeVisible()
  await expect(bob.getByText("Reply 01", {exact: true})).toHaveCount(0)
  await expect(openingPost).toBeVisible()

  // The thread's author is marked OP wherever their posts turn up.
  const alicesLastPost = bob.locator("article").filter({hasText: "Reply 20"})

  await expect(alicesLastPost.getByText("OP", {exact: true})).toBeVisible()

  await showEarlier.click()

  await expect(bob.getByText("Reply 01", {exact: true})).toBeVisible()
  await expect(showEarlier).toHaveCount(0)

  const carol = await as(users.carol, threadPath)

  await carol.getByRole("button", {name: "Show earlier replies"}).click()

  const bobsFirstPost = carol.locator("article").filter({hasText: "Reply 01"})

  await expect(bobsFirstPost).toBeVisible()
  await bobsFirstPost.getByRole("button", {name: "Reply", exact: true}).click()

  const postReply = composerForm(carol)
  const replyingTo = postReply.locator(".border-l-2")

  await expect(replyingTo).toContainText("Replying to @Bob Barker")
  await expect(replyingTo).toContainText("Reply 01")

  await replyingTo.getByRole("button").last().click()

  await expect(postReply.getByText(/^Replying to/)).toHaveCount(0)

  await noteEditor(postReply).pressSequentially("Answering the thread instead.")
  await postReply.getByRole("button", {name: "Post Reply"}).click()

  // Her post lands at the end of the one list, so there is nothing to click to reach it.
  await expect(carol.getByText("Answering the thread instead.")).toBeVisible()
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

  // Every assertion below is about which of the replies are in the window, so wait until they
  // have all arrived.
  await expect(bob.getByText("41 replies")).toBeVisible()

  // The thread opens on its newest twenty replies, with the opening post above them.
  await expect(bob.locator(`[data-event="${thread.id}"]`)).toBeVisible()
  await expect(bob.getByText("Reply 41", {exact: true})).toBeVisible()
  await expect(bob.getByText("Reply 22", {exact: true})).toBeVisible()
  await expect(bob.getByText("Reply 21", {exact: true})).toHaveCount(0)

  // The control says how many are still above it, so the reveal is not a blind click.
  await expect(showEarlier).toHaveText("Show earlier replies (21)")

  // Each reveal reaches twenty further back without leaving the page.
  await showEarlier.click()

  await expect(bob.getByText("Reply 02", {exact: true})).toBeVisible()
  await expect(bob.getByText("Reply 01", {exact: true})).toHaveCount(0)
  await expect(bob.getByText("Reply 41", {exact: true})).toBeVisible()
  await expect(showEarlier).toHaveText("Show earlier replies (1)")

  await showEarlier.click()

  await expect(bob.getByText("Reply 01", {exact: true})).toBeVisible()
  await expect(showEarlier).toHaveCount(0)

  const oldestPost = bob.locator(`[data-event="${firstReply.id}"]`)

  await oldestPost.getByRole("button", {name: "Permalink"}).click()
  await expect(bob.getByRole("alert")).toContainText("Copied to clipboard!")

  const permalink = await bob.evaluate(() => navigator.clipboard.readText())
  const {pathname, hash} = new URL(permalink)

  expect(pathname).toBe(threadPath)
  expect(hash).toBe(`#${nip19.neventEncode({id: firstReply.id, relays: [url]})}`)

  // A permalink reaches back as far as it has to on its own, so carol never sees the control.
  const carol = await as(users.carol, pathname + hash)
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
  const nevent = nip19.neventEncode({id: promoted.id, kind: MESSAGE, relays: [url]})

  // The seeded entity is parsed, so the composer shows the editor's chip for it rather than
  // the raw uri — which is also what makes the thread carry a q tag for the message.
  await expect(noteEditor(composer)).toContainText(`${nevent.slice(0, 16)}...`)

  await composer.getByPlaceholder("What is this thread about?").fill("Deploy failures")
  await composer.getByRole("button", {name: "Create Thread"}).click()

  await expect(page.getByRole("heading", {name: "Create a Thread"})).toHaveCount(0)
  await expect(message.getByRole("link", {name: "Deploy failures"})).toBeVisible()

  await page.goto(`${spacePath(url)}/threads`)

  const lounge = page.locator("section").filter({has: page.getByRole("heading", {name: "Lounge"})})
  const row = lounge.getByRole("row").filter({hasText: "Deploy failures"})

  await expect(row).toBeVisible()

  await row.click()

  await expect(page.getByRole("heading", {name: "Deploy failures"})).toBeVisible()
  await expect(page.getByText("the deploy broke again")).toBeVisible()
})
