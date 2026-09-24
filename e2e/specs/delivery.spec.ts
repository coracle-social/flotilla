import {HOUR} from "@welshman/lib"
import {LONG_FORM, MESSAGE} from "@welshman/util"
import {Article, Comment, Reaction} from "@welshman/domain"
import type {Page} from "@playwright/test"
import {
  DEFAULT_BLOSSOM_ORIGIN,
  bubble,
  chatItems,
  chatPath,
  chooseFile,
  composer,
  composerEnabled,
  expect,
  getPublished,
  getPublishedEvents,
  gifFile,
  menuButton,
  message,
  mockBlossom,
  noteEditor,
  pageBar,
  roomPath,
  send,
  sendButton,
  spacePath,
  test,
  timeline,
  toast,
  users,
} from "../harness"
import type {SeededSpace, TestUser} from "../harness"

// makeSpacePath percent-encodes each segment it is given, and an address is full of colons.
const articlePath = (url: string, address: string) =>
  `${spacePath(url)}/articles/${encodeURIComponent(address)}`

// Outbox routing resolves a person through their relay list, so a person here has a kind-10002.
const seedPerson = (space: SeededSpace, user: TestUser, name: string) => {
  space.profile(user, {name})
  space.relayList(user)
}

// A tippy is appended to the layout's own target and keeps its content mounted after it hides.
const detail = (page: Page) => page.locator(".tippy-target .card").filter({visible: true})

// A comment is a flat block in the comment tree rather than a card, named by its text.
const commentCard = (page: Page, text: string) =>
  page.locator('[data-component="Comment"]').filter({hasText: text})

// The action bar under an article on its own page, which is where that article's status shows.
const articleActions = (page: Page) => page.locator('[data-component="ArticleActions"]')

// Which relays a given event was sent to, oldest first — one entry per attempt.
const publishedTo = (page: Page, id: string) =>
  getPublished(page.context())
    .filter(({event}) => event.id === id)
    .map(({url}) => url)

// The composer is a page of its own, and it holds the reader there until publishing resolves.
const writeArticle = async (page: Page, title: string, body: string) => {
  await pageBar(page).getByRole("button", {name: "Write"}).click()
  await page.getByPlaceholder("Title", {exact: true}).fill(title)
  await noteEditor(page).pressSequentially(body)
  await pageBar(page).getByRole("button", {name: "Publish"}).click()
}

const writeComment = async (page: Page, body: string) => {
  await page.getByRole("button", {name: "Add a comment"}).click()

  const form = page.locator("form").filter({has: page.locator(".note-editor")})

  // The editor takes focus itself once it has mounted, and typing before that puts the caret back.
  await expect(noteEditor(form)).toBeFocused()
  await noteEditor(form).pressSequentially(body)
  await form.getByRole("button", {name: "Comment"}).click()
}

// The slider is initialised from the settings store on mount, so a fresh page says the client took it.
const setSendDelay = async (page: Page, seconds: number) => {
  const slider = page.locator("input[type=range]")

  await page.goto("/settings/content")
  await slider.fill(String(seconds * 1000))

  const unit = seconds === 1 ? "second" : "seconds"

  await expect(
    page.getByText(`Delay sending messages and comments for ${seconds} ${unit}.`),
  ).toBeVisible()

  await page.getByRole("button", {name: "Save Changes"}).click()

  await expect(toast(page)).toContainText("Your settings have been saved!")

  await page.goto("/settings/content")
  await expect(slider).toHaveValue(String(seconds * 1000))
}

test("US-068 watch a delayed send, and cancel it", async ({seed, as}) => {
  const scenario = await seed(({relay, user, at}) => {
    const space = relay("space")

    space.room("general", {name: "General"})
    space.join(user.alice, "general")
    space.join(user.bob, "general")

    for (const person of [user.alice, user.bob]) {
      seedPerson(space, person, person.name)
      space.messagingRelayList(person)
    }

    space.message(user.bob, "general", "morning all", at(2, HOUR))
  })

  const {url} = scenario.space("space")
  const path = roomPath(url, "general")

  const alice = await as(users.alice, path)
  const bob = await as(users.bob, path)

  await expect(timeline(alice).getByText("morning all")).toBeVisible()
  await expect(timeline(bob).getByText("morning all")).toBeVisible()

  // The delay defaults to zero, so this one leaves as soon as it is written and says nothing.
  await send(alice, "no delay here")

  await expect(message(alice, "no delay here")).toBeVisible()
  await expect(message(bob, "no delay here")).toBeVisible()
  await expect(toast(alice)).toHaveCount(0)

  await setSendDelay(alice, 5)
  await alice.goto(path)

  await expect(timeline(alice).getByText("morning all")).toBeVisible()

  await send(alice, "second thoughts")

  // The bubble is hers straight away; the delay is only about when it leaves.
  await expect(message(alice, "second thoughts")).toBeVisible()
  await expect(toast(alice)).toContainText("Sending...")
  await expect(toast(alice).getByRole("button", {name: "Cancel"})).toBeVisible()

  await expect(toast(alice)).toContainText("Message sent!")
  await expect(message(bob, "second thoughts")).toBeVisible()
  await expect(toast(alice)).toHaveCount(0)

  await send(alice, "wrong room, sorry")

  await expect(message(alice, "wrong room, sorry")).toBeVisible()

  await toast(alice).getByRole("button", {name: "Cancel"}).click()

  await expect(message(alice, "wrong room, sorry")).toHaveCount(0)
  await expect(toast(alice)).toHaveCount(0)

  // Sent after the cancelled one and delayed by as long, so its window has been and gone.
  await send(alice, "still here")

  await expect(message(bob, "still here")).toBeVisible()
  await expect(message(bob, "wrong room, sorry")).toHaveCount(0)

  // The same cancel in a conversation.
  await alice.goto(chatPath(users.bob.pubkey))
  await bob.goto(chatPath(users.alice.pubkey))

  await send(alice, "ignore this one")

  await expect(bubble(alice, "ignore this one")).toBeVisible()

  await toast(alice).getByRole("button", {name: "Cancel"}).click()

  // That was her only message to him, so the conversation goes with it.
  await expect(chatItems(alice)).toHaveCount(0)

  await send(alice, "actually, hi")

  await expect(bubble(bob, "actually, hi")).toBeVisible()
  await expect(bubble(bob, "ignore this one")).toHaveCount(0)
  await expect(bubble(alice, "ignore this one")).toHaveCount(0)
})

test("US-069 see why a message failed to deliver", async ({seed, as}) => {
  const scenario = await seed(({relay, user, at}) => {
    const space = relay("space")
    const other = relay("other")

    space.room("general", {name: "General"})
    space.join(user.alice, "general")
    space.join(user.bob, "general")
    // Alice belongs to both relays; bob deliberately belongs only to the first.
    other.join(user.alice)

    for (const person of [user.alice, user.bob]) {
      seedPerson(space, person, person.name)
    }

    space.messagingRelayList(user.alice)
    // Bob's client names both relays, but he is a member of one, so the other refuses a wrap for him.
    space.messagingRelayList(user.bob, [space.url, other.url])

    space.message(user.bob, "general", "morning all", at(2, HOUR))
  })

  const {url} = scenario.space("space")

  // A room the relay never created, which is where a link to a room that has since been deleted lands.
  const ghost = roomPath(url, "archive")

  const alice = await as(users.alice, ghost)
  const bob = await as(users.bob, ghost)

  await send(alice, "anyone here?")

  const failure = message(alice, "anyone here?").getByText("Failed to send!")

  await expect(failure).toBeVisible()

  // The text is still hers to see, and the publish is finished and was refused.
  await expect(message(alice, "anyone here?")).toContainText("anyone here?")
  await expect(message(bob, "anyone here?")).toHaveCount(0)

  await failure.click()

  await expect(detail(alice)).toContainText("Failed to send!")
  await expect(detail(alice)).toContainText("space.test")
  await expect(detail(alice)).toContainText("invalid: group not found.")
  await expect(detail(alice).getByRole("button", {name: "Retry"})).toBeVisible()

  // A conversation with someone whose two messaging relays do not both take his mail.
  await alice.goto(chatPath(users.bob.pubkey))

  await send(alice, "half a message")

  const partial = alice.getByText("Failed to send!")

  await expect(partial).toBeVisible()

  await partial.click()

  await expect(detail(alice)).toContainText("Partial delivery 1/2 relays")
  await expect(detail(alice)).toContainText("space.test")
  await expect(detail(alice)).toContainText("other.test")
  await expect(detail(alice)).toContainText("restricted:")
  await expect(detail(alice).locator(".text-success")).toHaveCount(1)
})

test("US-070 retry a failed relay", async ({seed, as}) => {
  const scenario = await seed(({relay, user}) => {
    const space = relay("space")

    space.room("general", {name: "General"})
    space.join(user.alice, "general")
    space.join(user.bob, "general")
    seedPerson(space, user.alice, "Alice Anderson")
    seedPerson(space, user.bob, "Bob Barker")
  })

  const {url} = scenario.space("space")
  const ghost = roomPath(url, "archive")
  const alice = await as(users.alice, ghost)

  // Seeding again replaces the scenario, and a page opened from that one carries no room list.
  const bob = await as(users.bob, roomPath(url, "general"))

  // A delay is what makes the retry's own "Sending..." a state rather than an instant.
  await setSendDelay(alice, 5)
  await alice.goto(ghost)

  await send(alice, "is anyone here?")

  const failure = message(alice, "is anyone here?").getByText("Failed to send!")

  await expect(failure).toBeVisible()

  await failure.click()
  await detail(alice).getByRole("button", {name: "Retry"}).click()

  await expect(toast(alice)).toContainText("Sending...")

  // The room still does not exist, so this attempt is refused too.
  await expect(toast(alice)).toHaveCount(0)
  await expect(failure).toBeVisible()

  // Seeding again is the only way the relay changes its mind about something it has already refused.
  await seed(({relay}) => {
    relay("space").room("archive", {name: "Archive"})
  })

  await failure.click()
  await detail(alice).getByRole("button", {name: "Retry"}).click()

  await expect(toast(alice)).toContainText("Sending...")
  await expect(toast(alice)).toContainText("Message sent!")

  const [sent] = getPublishedEvents(alice.context(), MESSAGE)

  // One attempt and two retries, every one of them to the relay that failed and to nothing else.
  expect(publishedTo(alice, sent.id)).toEqual([url, url, url])

  await bob.goto(roomPath(url, "archive"))

  await expect(message(bob, "is anyone here?")).toBeVisible()
})

test("US-071 content posts show delivery status in place", async ({seed, as}) => {
  const scenario = await seed(({relay, user}) => {
    const space = relay("space")
    const other = relay("other")

    space.room("general", {name: "General"})
    space.join(user.alice, "general")
    space.join(user.bob, "general")
    seedPerson(space, user.alice, "Alice Anderson")
    seedPerson(space, user.bob, "Bob Barker")

    // A second space in her list, so that opening it prompts her for nothing.
    other.join(user.alice)
  })

  const {url} = scenario.space("space")
  const quiet = scenario.space("other").url

  // A space whose relay this browser will not open a socket to, so a post is sent and nothing returns.
  const alice = await as(users.alice, `${spacePath(url)}/articles`, {
    env: {VITE_BLOCKED_RELAYS: quiet},
  })

  // A comment leaves after the send delay the way a chat message does.
  await setSendDelay(alice, 1)
  await alice.goto(`${spacePath(url)}/articles`)

  await writeArticle(alice, "Signals in the Noise", "Everything worth hearing is quiet.")

  // Publishing lands on the article's own page, where its status sits under the article itself.
  await expect(alice.getByRole("heading", {name: "Signals in the Noise"}).first()).toBeVisible()
  await expect(articleActions(alice).getByText("Sending...")).toHaveCount(0)
  await expect(articleActions(alice).getByText("Failed to send!")).toHaveCount(0)
  await expect(toast(alice)).toHaveCount(0)

  await writeComment(alice, "Worth saying twice.")

  const comment = commentCard(alice, "Worth saying twice.")

  await expect(menuButton(comment)).toBeVisible()
  await expect(comment.getByText("Sending...")).toHaveCount(0)
  await expect(comment.getByText("Failed to send!")).toHaveCount(0)
  await expect(toast(alice)).toHaveCount(0)

  // The same post into the space whose relay says nothing back.
  await alice.goto(`${spacePath(quiet)}/articles`)
  await writeArticle(alice, "Into the Void", "Nobody is listening.")

  // Nothing was refused, so there is no toast; the action bar says the relay never answered.
  const stuck = articleActions(alice)

  await expect(stuck.getByText("Failed to send!")).toBeVisible()
  await expect(toast(alice)).toHaveCount(0)

  await stuck.getByText("Failed to send!").click()

  await expect(detail(alice)).toContainText("Failed to send!")
  await expect(detail(alice)).toContainText("other.test")
  await expect(detail(alice)).toContainText("request timed out.")

  await writeComment(alice, "A footnote nobody asked for.")

  const footnote = commentCard(alice, "A footnote nobody asked for.")

  await expect(footnote.getByText("Sending...")).toBeVisible()
  await expect(footnote.getByRole("button", {name: "Cancel"})).toBeVisible()

  await footnote.getByRole("button", {name: "Cancel"}).click()

  await expect(commentCard(alice, "A footnote nobody asked for.")).toHaveCount(0)
})

test("US-072 a deleted post is marked deleted", async ({seed, as}) => {
  const scenario = await seed(({relay, user, at}) => {
    const space = relay("space")
    const other = relay("other")

    space.room("general", {name: "General"})
    space.join(user.alice, "general")
    space.join(user.bob, "general")
    seedPerson(space, user.alice, "Alice Anderson")
    seedPerson(space, user.bob, "Bob Barker")
    other.join(user.alice)

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

    const comment = space.event(
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

    // Somebody else's reaction, so the summary the pill is meant to replace has something in it.
    space.event(
      user.bob,
      () => space.kind(Reaction).writer().setEvent(comment.event).setContent("🎉").renderTemplate(),
      at(2, HOUR),
    )
  })

  const {url} = scenario.space("space")
  const quiet = scenario.space("other").url

  const alice = await as(users.alice, `${spacePath(quiet)}/articles`, {
    env: {VITE_BLOCKED_RELAYS: quiet},
  })

  // A post whose relay never answered, deleted while it is still marked failed.
  await writeArticle(alice, "Into the Void", "Nobody is listening.")

  // Publishing waits the relay out and lands on the article anyway, still marked failed.
  const stuck = articleActions(alice)

  await expect(stuck.getByText("Failed to send!")).toBeVisible()

  await alice.getByRole("button", {name: "Article options"}).click()
  await alice.getByRole("button", {name: "Delete Article"}).click()
  await alice.getByRole("button", {name: "Confirm"}).click()

  // Deleted takes over from the failure the article was carrying.
  await expect(stuck.getByText("Deleted", {exact: true})).toBeVisible()
  await expect(stuck.getByText("Failed to send!")).toHaveCount(0)

  await alice.goto(articlePath(url, `${LONG_FORM}:${users.alice.pubkey}:tending-the-garden`))

  const comment = commentCard(alice, "A note about the soil chapter.")
  const article = articleActions(alice)

  await expect(comment).toBeVisible()
  await expect(comment.getByRole("button", {name: /🎉/})).toBeVisible()

  await menuButton(comment).click()
  await alice.getByRole("button", {name: "Delete Comment"}).click()
  await alice.getByRole("button", {name: "Confirm"}).click()

  // The comment list is a feed too, so a deleted comment drops out of it.
  await expect(comment).toHaveCount(0)

  await alice.getByRole("button", {name: "Article options"}).click()
  await alice.getByRole("button", {name: "Delete Article"}).click()
  await alice.getByRole("button", {name: "Confirm"}).click()

  // This page is the article's own view, so it stays and is marked deleted rather than vanishing.
  await expect(article.getByText("Deleted", {exact: true})).toBeVisible()
  await expect(article.getByRole("button", {name: "Add a reaction"})).toHaveCount(0)
})

test("US-073 a multi-part message reports one status", async ({seed, as}) => {
  await seed(({relay, user}) => {
    const space = relay("space")
    const other = relay("other")

    space.room("general", {name: "General"})

    for (const person of [user.alice, user.bob, user.carol]) {
      space.join(person, "general")
      seedPerson(space, person, person.name)
    }

    space.messagingRelayList(user.alice)
    space.messagingRelayList(user.bob)
    // Carol's client names a relay she does not belong to, so one of the two refuses each part.
    space.messagingRelayList(user.carol, [space.url, other.url])
  })

  const alice = await as(users.alice, chatPath(users.bob.pubkey))
  const bob = await as(users.bob, chatPath(users.alice.pubkey))

  await mockBlossom(alice.context(), {server: DEFAULT_BLOSSOM_ORIGIN})
  await mockBlossom(bob.context(), {server: DEFAULT_BLOSSOM_ORIGIN})

  await composerEnabled(alice)

  await composer(alice).click()
  await composer(alice).pressSequentially("here is the harbour")
  await chooseFile(alice, alice.locator("button[data-tip='Add an image']"), gifFile("harbour.gif"))

  // The editor names the file the moment it is attached, and a submit while it uploads is dropped.
  await expect(composer(alice)).toContainText("harbour.gif")
  await expect(composer(alice).locator(".tiptap-uploading")).toHaveCount(0)
  await expect(sendButton(alice)).toBeEnabled()

  await composer(alice).press("Enter")

  // Two bubbles, one status for the pair of them.
  await expect(toast(alice)).toHaveCount(1)
  await expect(toast(alice)).toContainText("Sending...")
  await expect(alice.locator(".chat-bubble")).toHaveCount(2)
  await expect(bubble(alice, "here is the harbour")).toBeVisible()

  // Which only becomes a success once both parts have landed everywhere they were sent.
  await expect(toast(alice)).toContainText("Message sent!")
  await expect(toast(alice)).toHaveCount(1)
  await expect(bob.locator(".chat-bubble")).toHaveCount(2)
  await expect(toast(alice)).toHaveCount(0)

  // The same message to someone one of whose relays refuses it: each part says so for itself.
  await alice.goto(chatPath(users.carol.pubkey))

  await composerEnabled(alice)

  await composer(alice).click()
  await composer(alice).pressSequentially("and one for you")
  await chooseFile(alice, alice.locator("button[data-tip='Add an image']"), gifFile("harbour.gif"))

  await expect(composer(alice)).toContainText("harbour.gif")
  await expect(composer(alice).locator(".tiptap-uploading")).toHaveCount(0)
  await expect(sendButton(alice)).toBeEnabled()

  await composer(alice).press("Enter")

  await expect(alice.locator(".chat-bubble")).toHaveCount(2)
  await expect(alice.getByText("Failed to send!")).toHaveCount(2)
})
