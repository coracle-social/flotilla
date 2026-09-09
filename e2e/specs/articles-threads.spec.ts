import * as nip19 from "nostr-tools/nip19"
import {HOUR, MINUTE} from "@welshman/lib"
import {LONG_FORM, MESSAGE, NOTE, makeEvent} from "@welshman/util"
import type {SignedEvent, TrustedEvent} from "@welshman/util"
import {ClientMessageType} from "@welshman/net"
import {Article, Comment, RelayList, Thread} from "@welshman/domain"
import type {Locator, Page} from "@playwright/test"
import {expect, getTranscript, mockBlossom, roomPath, spacePath, test, users} from "../harness"

// A handle to a seeded event, which only reads once seed() has drained its queue.
type Seeded = {readonly id: string; readonly event: SignedEvent}

// Where an upload lands. getBlossomServer probes the space's own origin first — blossom is off in
// every tenant's toml, so that probe is meant to fail — then the user's kind-10063 list, and
// VITE_DEFAULT_BLOSSOM_SERVERS is what is left.
const BLOSSOM_ORIGIN = "https://blossom.primal.net"

// A real 1x1 gif. Gif rather than png because compressFileForUpload passes gif through untouched
// instead of re-encoding it through a canvas.
const GIF = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64")

const PARTY = "🎉"

// Every event of a kind this page put on the wire, oldest first.
const publishedEvents = (page: Page, kind: number): TrustedEvent[] =>
  getTranscript(page.context())
    .filter(
      ({direction, message}) =>
        direction === "toRelay" &&
        message[0] === ClientMessageType.Event &&
        message[1].kind === kind,
    )
    .map(({message}) => message[1])

// A modal is mounted alongside the page it covers, so the "Create Thread" in a room's compose menu
// and the "Create Thread" that submits the composer are both reachable at once. Everything inside
// a composer is scoped to the modal's own form to say which one is meant.
const modal = (page: Page, title: string) =>
  page.locator("form").filter({has: page.getByRole("heading", {name: title})})

// The comment and thread-reply composers are the only forms on their pages carrying a rich text
// editor.
const composerForm = (page: Page) =>
  page.locator("form").filter({has: page.locator(".note-editor")})

const editorOf = (scope: Locator | Page) => scope.locator(".note-editor [contenteditable=true]")

const pageBar = (page: Page) => page.locator('[data-component="PageBar"]')

// EventActions renders zap, emoji and menu into one join, in that order, and every one of them is
// an icon with no accessible name.
const emojiButton = (scope: Locator) => scope.locator(".join").getByRole("button").nth(1)

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

// The picker is a web component with an open shadow root, so its search field and its results are
// reachable through it. Searching rather than browsing avoids depending on which category tab an
// emoji happens to live under.
const pickParty = async (page: Page, opener: Locator) => {
  await opener.click()

  const picker = page.locator("emoji-picker").filter({visible: true})

  // Tippy keeps a hidden popover mounted through its fade — a quarter of a second during which the
  // picker from the last card is still visible alongside this one — so wait for there to be one
  // rather than reaching into whichever resolves first.
  await expect(picker).toHaveCount(1)

  // A result's label is the emoji's name, its annotation and every shortcode joined together, so
  // the annotation is matched rather than the whole of it.
  await picker.locator("input.search").fill("party popper")
  await picker
    .getByRole("option", {name: /party popper/})
    .first()
    .click()
}

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

const openArticle = (page: Page, title: string) =>
  articleCards(page).filter({hasText: title}).getByRole("link", {name: title, exact: true}).click()

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
  const body = editorOf(page)

  await expect(title).toBeVisible()

  await publish.click()
  await expect(page.getByRole("alert")).toContainText("Please provide a title for your article.")

  await title.fill("Half Baked")
  await publish.click()
  await expect(page.getByRole("alert")).toContainText("Please write something for your article.")

  await body.pressSequentially("Only the beginning.")

  // Neither refusal put anything on the wire.
  expect(publishedEvents(page, LONG_FORM)).toEqual([])

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
  expect(publishedEvents(page, LONG_FORM)).toHaveLength(1)

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
          .setTopics(["books"])
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
  await editorOf(composerForm(bob)).pressSequentially("The soil chapter is the good one.")
  await composerForm(bob).getByRole("button", {name: "Comment"}).click()

  // The comment renders from the optimistic write, but the composer holds what was typed until the
  // relay confirms it, so for a moment the page carries this text twice. Match the rendered comment.
  await expect(comment(bob, "The soil chapter is the good one.")).toBeVisible()

  const carol = await as(users.carol, articlesPath)

  await openArticle(carol, "Tending the Garden")

  const bobsComment = comment(carol, "The soil chapter is the good one.")

  await expect(bobsComment).toBeVisible()

  await bobsComment.getByRole("button", {name: "Reply", exact: true}).click()
  await editorOf(composerForm(carol)).pressSequentially(
    "Only because you skipped the water chapter.",
  )
  await composerForm(carol).getByRole("button", {name: "Reply", exact: true}).click()

  await expect(comment(carol, "Only because you skipped the water chapter.")).toBeVisible()

  const alice = await as(users.alice, articlesPath)

  await mockBlossom(alice.context(), {server: BLOSSOM_ORIGIN})
  await openArticle(alice, "Tending the Garden")

  await expect(alice.getByText("The soil chapter is the good one.")).toBeVisible()
  await expect(alice.getByText("Only because you skipped the water chapter.")).toBeVisible()

  // A reply is nested inside the comment it answers; a top level comment is not.
  const nested = alice.locator('[data-component="CommentReplies"]')

  await expect(nested.getByText("Only because you skipped the water chapter.")).toBeVisible()
  await expect(nested.getByText("The soil chapter is the good one.")).toHaveCount(0)

  await alice.getByRole("button", {name: "Add a comment"}).click()

  const composer = composerForm(alice)

  await editorOf(composer).pressSequentially("Thanks both, here's the bed I meant.")
  await editorOf(composer).press("Enter")

  const chooser = alice.waitForEvent("filechooser")

  await composer.locator('[data-tip="Add an image"]').click()
  await (await chooser).setFiles({name: "bed.gif", mimeType: "image/gif", buffer: GIF})

  // The attachment carries an uploading marker from the moment the request goes out until the
  // blossom descriptor comes back and replaces its blob url.
  await expect(composer.locator(".tiptap-object")).not.toHaveClass(/tiptap-uploading/)

  await composer.getByRole("button", {name: "Comment"}).click()

  const alicesComment = comment(alice, "Thanks both, here's the bed I meant.")

  await expect(alicesComment).toBeVisible()
  await expect(alicesComment.locator(`img[src^="${BLOSSOM_ORIGIN}/"]`)).toBeVisible()
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
    space.event(user.alice, () =>
      space
        .kind(RelayList)
        .writer()
        .setReadUrls([space.url])
        .setWriteUrls([space.url])
        .renderTemplate(),
    )

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
  await editorOf(page).pressSequentially("Wait for a warm week.")
  await pageBar(page).getByRole("button", {name: "Publish"}).click()

  await expect(page.getByRole("heading", {name: "Repotting in Winter"}).first()).toBeVisible()

  // The room hears about the article without alice posting it a second time. Its copy is published
  // after the composer has moved on, so wait for it to leave — a page that unloads mid-publish
  // takes it with it.
  await expect.poll(() => publishedEvents(page, MESSAGE)).toHaveLength(1)

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

  const fromRoom = modal(page, "Create a Thread")

  await fromRoom.getByPlaceholder("What is this thread about?").fill("Bike shed colors")
  await editorOf(fromRoom).pressSequentially("Blue, surely?")
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

  await pageBar(page).getByRole("button", {name: "Create", exact: true}).click()

  const fromThreads = modal(page, "Create a Thread")

  await fromThreads.getByPlaceholder("What is this thread about?").fill("Open floor")
  await editorOf(fromThreads).pressSequentially("Anything goes in here.")
  await fromThreads.getByRole("button", {name: "Create Thread"}).click()

  await expect(page.getByRole("heading", {name: "Create a Thread"})).toHaveCount(0)

  const general = page
    .locator("section")
    .filter({has: page.getByRole("heading", {name: "General", exact: true})})

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

    // Twenty replies plus the opening post is one post past the first page, and the last of them
    // is alice's, so her OP badge has to survive the page change.
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

  await bob.getByRole("button", {name: "Reply to thread"}).click()

  const threadReply = composerForm(bob)

  await expect(threadReply).toBeVisible()
  await expect(threadReply.getByText(/^Replying to/)).toHaveCount(0)

  await editorOf(threadReply).pressSequentially("Twice a year here.")
  await threadReply.getByRole("button", {name: "Post Reply"}).click()

  await expect(bob.getByText("21 replies")).toBeVisible()

  // The thread's author is marked OP wherever their posts turn up, second page included.
  await bob.getByRole("button", {name: "2", exact: true}).click()
  await expect(bob.getByText("Page 2 of 2")).toBeVisible()

  const alicesLastPost = bob.locator("article").filter({hasText: "Reply 20"})

  await expect(alicesLastPost.getByText("OP", {exact: true})).toBeVisible()
  await expect(bob.getByText("Twice a year here.")).toBeVisible()

  const carol = await as(users.carol, threadPath)
  const bobsFirstPost = carol.locator("article").filter({hasText: "Reply 01"})

  await expect(bobsFirstPost).toBeVisible()
  await bobsFirstPost.getByRole("button", {name: "Reply", exact: true}).click()

  const postReply = composerForm(carol)
  const replyingTo = postReply.locator(".border-l-2")

  await expect(replyingTo).toContainText("Replying to @Bob Barker")
  await expect(replyingTo).toContainText("Reply 01")

  await replyingTo.getByRole("button").last().click()

  await expect(postReply.getByText(/^Replying to/)).toHaveCount(0)

  await editorOf(postReply).pressSequentially("Answering the thread instead.")
  await postReply.getByRole("button", {name: "Post Reply"}).click()

  // Twenty one replies before hers is already a page and a bit, so her post is appended to the
  // last one rather than to the page she wrote it from. The last control in the join is "go last",
  // which is the same button whatever the page count turns out to be.
  await carol
    .getByText(/^Page \d+ of \d+$/)
    .locator("xpath=..")
    .locator(".join")
    .getByRole("button")
    .last()
    .click()

  await expect(carol.getByText("Answering the thread instead.")).toBeVisible()
})

test("US-044 navigate a long thread", async ({seed, as}) => {
  let thread!: Seeded
  let lastPost!: Seeded

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

    // Forty one replies plus the opening post is three pages of twenty.
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

      if (i === 41) {
        lastPost = reply
      }
    }

    thread = topic
  })

  const {url} = scenario.space("space")
  const threadPath = `${spacePath(url)}/threads/${thread.id}`
  const bob = await as(users.bob, threadPath, {
    context: {permissions: ["clipboard-read", "clipboard-write"]},
  })

  const indicator = bob.getByText(/^Page \d+ of \d+$/)

  await expect(indicator).toHaveText("Page 1 of 3")
  await expect(bob.getByText("Reply 19", {exact: true})).toBeVisible()

  // ThreadPagination is first, prev, a button per page, next, last, and only the page numbers
  // carry an accessible name — the rest are icons — so with three pages the ends are 0, 1, 5, 6.
  const controls = indicator.locator("xpath=..").locator(".join").getByRole("button")
  const goFirst = controls.nth(0)
  const goPrev = controls.nth(1)
  const goNext = controls.nth(5)
  const goLast = controls.nth(6)

  await goNext.click()
  await expect(indicator).toHaveText("Page 2 of 3")
  await expect(bob.getByText("Reply 20", {exact: true})).toBeVisible()

  await goLast.click()
  await expect(indicator).toHaveText("Page 3 of 3")
  await expect(bob.getByText("Reply 41", {exact: true})).toBeVisible()

  await goPrev.click()
  await expect(indicator).toHaveText("Page 2 of 3")
  await expect(bob.getByText("Reply 20", {exact: true})).toBeVisible()

  await goFirst.click()
  await expect(indicator).toHaveText("Page 1 of 3")
  await expect(bob.getByText("Reply 19", {exact: true})).toBeVisible()

  await bob.getByRole("button", {name: "3", exact: true}).click()
  await expect(indicator).toHaveText("Page 3 of 3")

  const finalPost = bob.locator(`[data-event="${lastPost.id}"]`)

  await finalPost.getByRole("button", {name: "Permalink"}).click()
  await expect(bob.getByRole("alert")).toContainText("Copied to clipboard!")

  const permalink = await bob.evaluate(() => navigator.clipboard.readText())
  const {pathname, hash} = new URL(permalink)

  expect(pathname).toBe(threadPath)
  expect(hash).toBe(`#${nip19.neventEncode({id: lastPost.id, relays: [url]})}`)

  const carol = await as(users.carol, pathname + hash)
  const target = carol.locator(`[data-event="${lastPost.id}"]`)

  await expect(carol.getByText(/^Page \d+ of \d+$/)).toHaveText("Page 3 of 3")
  await expect(target).toBeVisible()
  await expect(target).toBeInViewport()
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

  const composer = modal(page, "Create a Thread")
  const nevent = nip19.neventEncode({id: promoted.id, kind: MESSAGE, relays: [url]})

  await expect(editorOf(composer)).toContainText(`nostr:${nevent}`)

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
