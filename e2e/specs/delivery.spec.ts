import {HOUR} from "@welshman/lib"
import {LONG_FORM, MESSAGE} from "@welshman/util"
import type {TrustedEvent} from "@welshman/util"
import {ClientMessageType} from "@welshman/net"
import {Article, Comment, MessagingRelayList, Reaction, RelayList} from "@welshman/domain"
import type {Locator, Page} from "@playwright/test"
import {expect, getTranscript, mockBlossom, roomPath, spacePath, test, users} from "../harness"
import type {SeededSpace, TestUser} from "../harness"

// The path the app builds for a conversation — see makeChatId in src/app/chats.ts.
const chatPath = (...pubkeys: string[]) => `/chat/${[...pubkeys].sort().join(",")}`

// makeSpacePath percent-encodes each segment it is given, and an address is full of colons.
const articlePath = (url: string, address: string) =>
  `${spacePath(url)}/articles/${encodeURIComponent(address)}`

// Where an upload lands: the space's own origin is probed first and blossom is off in every
// tenant's toml, so what is left is VITE_DEFAULT_BLOSSOM_SERVERS.
const BLOSSOM_ORIGIN = "https://blossom.primal.net"

// A one pixel gif. Gif rather than png because compressFileForUpload passes it through untouched
// rather than re-encoding it through a canvas.
const GIF = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64")

// Outbox routing resolves everything about a person through their relay list, so a person here is
// a membership, a profile and a kind-10002.
const seedPerson = (space: SeededSpace, user: TestUser, name: string) => {
  space.profile(user, {name})
  space.event(user, () =>
    space
      .kind(RelayList)
      .writer()
      .setReadUrls([space.url])
      .setWriteUrls([space.url])
      .renderTemplate(),
  )
}

// The kind-10050 that says where someone's direct messages go. It is read lazily so that a list
// can name a relay whose url only exists once seeding has drained.
const enableDms = (space: SeededSpace, user: TestUser, getUrls: () => string[]) =>
  space.event(user, () =>
    space.kind(MessagingRelayList).writer().setUrls(getUrls()).renderTemplate(),
  )

const composer = (page: Page) => page.locator(".chat-editor [contenteditable=true]")

// The send button carries the shortcut it advertises, which differs by platform.
const sendButton = (page: Page) => page.locator("button[data-tip$='enter to send']")

// The editor is where the composer says whether it is ready. The send button is not there to
// ask while the composer is empty, since a dictation button stands in its place. Only the
// conversation composer has a disabled state; a room's is usable as soon as it renders.
const composerEnabled = (page: Page) =>
  expect(page.locator(".room__compose .chat-editor")).toHaveAttribute("aria-disabled", "false")

const timeline = (page: Page) => page.locator(".room__content")

const message = (page: Page, text: string) => page.locator(".room__item").filter({hasText: text})

const bubble = (page: Page, text: string) => page.locator(".chat-bubble").filter({hasText: text})

// One toast at a time — src/app/toast.ts holds a single writable — so this is the toast.
const toast = (page: Page) => page.getByRole("alert")

// A tippy is appended to the layout's own target rather than beside its trigger, and it keeps its
// content mounted after it hides, so the visible card there is the popover that was just opened.
const detail = (page: Page) => page.locator(".tippy-target .card").filter({visible: true})

// EventActions renders zap, emoji and menu into one join, in that order, and every one of them is
// an icon with no accessible name.
const menuOf = (scope: Locator) => scope.locator(".join").getByRole("button").last()

// A comment, an article and a thread post are all the same feature card, named by their text.
const noteCard = (page: Page, text: string) =>
  page.locator(".card.z-feature").filter({hasText: text})

// A modal is mounted alongside the page it covers, so a page's own "Write" and the composer's
// submit are both in the dom at once.
const modal = (page: Page, title: string) =>
  page.locator("form").filter({has: page.getByRole("heading", {name: title})})

const editorOf = (scope: Locator) => scope.locator(".note-editor [contenteditable=true]")

// Every caller of this sends to a room, whose composer gates on nothing, so the wait is for the
// room to have rendered one.
const send = async (page: Page, content: string) => {
  await expect(composer(page)).toBeVisible()
  await composer(page).click()
  await composer(page).pressSequentially(content)
  await composer(page).press("Enter")
}

// Every frame this page put on the wire carrying an event, with the relay it went to.
const published = (page: Page): {url: string; event: TrustedEvent}[] =>
  getTranscript(page.context())
    .filter(
      ({direction, message}) => direction === "toRelay" && message[0] === ClientMessageType.Event,
    )
    .map(({url, message}) => ({url, event: message[1]}))

const publishedEvents = (page: Page, kind: number) =>
  published(page)
    .filter(({event}) => event.kind === kind)
    .map(({event}) => event)

// Which relays a given event was sent to, oldest first — one entry per attempt.
const publishedTo = (page: Page, id: string) =>
  published(page)
    .filter(({event}) => event.id === id)
    .map(({url}) => url)

const writeArticle = async (page: Page, title: string, body: string) => {
  await page.getByRole("button", {name: "Write"}).click()

  const composer = modal(page, "Write an Article")

  await composer.getByPlaceholder("What is this article about?").fill(title)
  await editorOf(composer).pressSequentially(body)
  await composer.getByRole("button", {name: "Publish Article"}).click()
}

const writeComment = async (page: Page, body: string) => {
  await page.getByRole("button", {name: "Add a comment"}).click()

  const composer = page.locator("form").filter({has: page.locator(".note-editor")})

  await editorOf(composer).pressSequentially(body)
  await composer.getByRole("button", {name: "Comment"}).click()
}

// The send delay is a user setting rather than a page's own state, so it is set the way a person
// sets it. Reading it back off a freshly loaded page is what says the client has taken it up: the
// slider is initialised from the settings store on mount.
const setSendDelay = async (page: Page, seconds: number) => {
  const slider = page.locator("input[type=range]")

  await page.goto("/settings/content")
  await slider.fill(String(seconds * 1000))

  await expect(page.getByText(`Delay sending chat messages for ${seconds} seconds.`)).toBeVisible()

  await page.getByRole("button", {name: "Save Changes"}).click()

  await expect(toast(page)).toContainText("Your settings have been saved!")

  await page.goto("/settings/content")
  await expect(slider).toHaveValue(String(seconds * 1000))
}

const chooseFile = async (page: Page, button: Locator, name: string) => {
  const chooser = page.waitForEvent("filechooser")

  await button.click()
  await (await chooser).setFiles({name, mimeType: "image/gif", buffer: GIF})
}

test("US-068 watch a delayed send, and cancel it", async ({seed, as}) => {
  const scenario = await seed(({relay, user, at}) => {
    const space = relay("space")

    space.room("general", {name: "General"})
    space.join(user.alice, "general")
    space.join(user.bob, "general")

    for (const person of [user.alice, user.bob]) {
      seedPerson(space, person, person.name)
      enableDms(space, person, () => [space.url])
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

  // Sent after the cancelled one and delayed by as long, so bob having this means the window the
  // cancelled one would have left in has been and gone.
  await send(alice, "still here")

  await expect(message(bob, "still here")).toBeVisible()
  await expect(message(bob, "wrong room, sorry")).toHaveCount(0)

  // The same cancel in a conversation.
  await alice.goto(chatPath(users.bob.pubkey))
  await bob.goto(chatPath(users.alice.pubkey))

  await send(alice, "ignore this one")

  await expect(bubble(alice, "ignore this one")).toBeVisible()

  await toast(alice).getByRole("button", {name: "Cancel"}).click()

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

    enableDms(space, user.alice, () => [space.url])
    // Bob's client says his messages go to both relays, but he is not a member of the second, so a
    // wrap addressed to him is stored by one and refused by the other.
    enableDms(space, user.bob, () => [space.url, other.url])

    space.message(user.bob, "general", "morning all", at(2, HOUR))
  })

  const {url} = scenario.space("space")

  // A room the relay never created, which is where a link to a room that has since been deleted
  // lands. Everything else about the space still works, so only this one publish is refused.
  const ghost = roomPath(url, "archive")

  const alice = await as(users.alice, ghost)
  const bob = await as(users.bob, ghost)

  await send(alice, "anyone here?")

  const failure = message(alice, "anyone here?").getByText("Failed to send!")

  await expect(failure).toBeVisible()

  // The text is still hers to see, and the publish is finished and was refused, so there is
  // nothing left for bob to receive.
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

  // Opened now rather than once the room exists: seeding again below replaces the scenario, and a
  // page opened from that one carries no room list — which is the only thing telling authPolicy it
  // may answer a members-only relay's challenge, so bob would never get to read anything.
  const bob = await as(users.bob, roomPath(url, "general"))

  // A delay is what makes the retry's own "Sending..." a state rather than an instant, so this
  // watches a retry the way the person who asked for it does.
  await setSendDelay(alice, 5)
  await alice.goto(ghost)

  await send(alice, "is anyone here?")

  const failure = message(alice, "is anyone here?").getByText("Failed to send!")

  await expect(failure).toBeVisible()

  await failure.click()
  await detail(alice).getByRole("button", {name: "Retry"}).click()

  await expect(toast(alice)).toContainText("Sending...")

  // The room still does not exist, so this attempt is refused too: the toast goes without ever
  // having said the message was sent, and the message is still marked failed.
  await expect(toast(alice)).toHaveCount(0)
  await expect(failure).toBeVisible()

  // The admin creates the room the message was addressed to. Seeding again is the only way the
  // relay changes its mind about something it has already refused.
  await seed(({relay}) => {
    relay("space").room("archive", {name: "Archive"})
  })

  await failure.click()
  await detail(alice).getByRole("button", {name: "Retry"}).click()

  await expect(toast(alice)).toContainText("Sending...")
  await expect(toast(alice)).toContainText("Message sent!")

  const [sent] = publishedEvents(alice, MESSAGE)

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

  // A space whose relay this browser will not open a socket to, which is what a post that sits
  // unconfirmed looks like from the inside: it is sent, and nothing comes back.
  const alice = await as(users.alice, `${spacePath(url)}/articles`, {
    env: {VITE_BLOCKED_RELAYS: quiet},
  })

  await writeArticle(alice, "Signals in the Noise", "Everything worth hearing is quiet.")

  const article = alice.locator('[data-component="ArticleItem"]').filter({hasText: "Signals"})

  await expect(alice.getByRole("heading", {name: "Write an Article"})).toHaveCount(0)

  // The row's own actions first: a status this row does not have says nothing until the row it
  // would sit in is on screen.
  await expect(menuOf(article)).toBeVisible()
  await expect(article.getByText("Sending...")).toHaveCount(0)
  await expect(article.getByText("Failed to send!")).toHaveCount(0)
  await expect(toast(alice)).toHaveCount(0)

  await article.getByRole("link", {name: "Signals in the Noise", exact: true}).click()
  await writeComment(alice, "Worth saying twice.")

  const comment = noteCard(alice, "Worth saying twice.")

  await expect(menuOf(comment)).toBeVisible()
  await expect(comment.getByText("Sending...")).toHaveCount(0)
  await expect(comment.getByText("Failed to send!")).toHaveCount(0)
  await expect(toast(alice)).toHaveCount(0)

  // The same post into the space whose relay says nothing back.
  await alice.goto(`${spacePath(quiet)}/articles`)
  await writeArticle(alice, "Into the Void", "Nobody is listening.")

  const stuck = alice.locator('[data-component="ArticleItem"]').filter({hasText: "Into the Void"})

  await expect(stuck.getByText("Sending...")).toBeVisible()
  await expect(stuck.getByRole("button", {name: "Cancel"})).toBeVisible()

  // The composer closes itself once publishing gives up, and the row it left behind says why.
  await expect(stuck.getByText("Failed to send!")).toBeVisible()
  await expect(alice.getByRole("heading", {name: "Write an Article"})).toHaveCount(0)

  await stuck.getByText("Failed to send!").click()

  await expect(detail(alice)).toContainText("Failed to send!")
  await expect(detail(alice)).toContainText("other.test")
  await expect(detail(alice)).toContainText("request timed out.")

  await stuck.getByRole("link", {name: "Into the Void", exact: true}).click()
  await writeComment(alice, "A footnote nobody asked for.")

  const footnote = noteCard(alice, "A footnote nobody asked for.")

  await expect(footnote.getByText("Sending...")).toBeVisible()
  await expect(footnote.getByRole("button", {name: "Cancel"})).toBeVisible()

  await footnote.getByRole("button", {name: "Cancel"}).click()

  await expect(noteCard(alice, "A footnote nobody asked for.")).toHaveCount(0)
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

  const stuck = alice.locator('[data-component="ArticleItem"]').filter({hasText: "Into the Void"})

  await expect(stuck.getByText("Failed to send!")).toBeVisible()

  // The composer closes itself once publishing gives up, and the row's menu is underneath it.
  await expect(alice.getByRole("heading", {name: "Write an Article"})).toHaveCount(0)

  await menuOf(stuck).click()
  await alice.getByRole("button", {name: "Delete Article"}).click()
  await alice.getByRole("button", {name: "Confirm"}).click()

  // A feed shows non-deleted posts only, so deleting it drops the row rather than marking it.
  await expect(stuck).toHaveCount(0)

  await alice.goto(articlePath(url, `${LONG_FORM}:${users.alice.pubkey}:tending-the-garden`))

  const comment = noteCard(alice, "A note about the soil chapter.")
  const article = noteCard(alice, "Gardens are worth the trouble.")

  await expect(comment).toBeVisible()
  await expect(comment.getByRole("button", {name: /🎉/})).toBeVisible()

  await menuOf(comment).click()
  await alice.getByRole("button", {name: "Delete Comment"}).click()
  await alice.getByRole("button", {name: "Confirm"}).click()

  // The comment list is a feed too, so a deleted comment drops out of it.
  await expect(comment).toHaveCount(0)

  await menuOf(article).click()
  await alice.getByRole("button", {name: "Delete Article"}).click()
  await alice.getByRole("button", {name: "Confirm"}).click()

  // But this page is the article's own view, so it stays and is marked deleted rather than
  // vanishing, and the "Deleted" pill stands in place of the actions the row offered before.
  await expect(article.getByText("Deleted", {exact: true})).toBeVisible()
  await expect(article.locator(".join")).toHaveCount(0)
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

    enableDms(space, user.alice, () => [space.url])
    enableDms(space, user.bob, () => [space.url])
    // Carol's client names a relay she does not belong to, so every part of a message to her is
    // stored by one of her two relays and refused by the other.
    enableDms(space, user.carol, () => [space.url, other.url])
  })

  const alice = await as(users.alice, chatPath(users.bob.pubkey))
  const bob = await as(users.bob, chatPath(users.alice.pubkey))

  await mockBlossom(alice.context(), {server: BLOSSOM_ORIGIN})
  await mockBlossom(bob.context(), {server: BLOSSOM_ORIGIN})

  await composerEnabled(alice)

  await composer(alice).click()
  await composer(alice).pressSequentially("here is the harbour")
  await chooseFile(alice, alice.locator("button[data-tip='Add an image']"), "harbour.gif")

  // The editor names the file the moment it is attached, so the name alone does not mean the
  // upload is done — and a submit while it is still running is dropped on the floor.
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
  await chooseFile(alice, alice.locator("button[data-tip='Add an image']"), "harbour.gif")

  await expect(composer(alice)).toContainText("harbour.gif")
  await expect(composer(alice).locator(".tiptap-uploading")).toHaveCount(0)
  await expect(sendButton(alice)).toBeEnabled()

  await composer(alice).press("Enter")

  await expect(alice.locator(".chat-bubble")).toHaveCount(2)
  await expect(alice.getByText("Failed to send!")).toHaveCount(2)
})
