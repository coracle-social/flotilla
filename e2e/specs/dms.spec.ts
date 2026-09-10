import {npubEncode} from "nostr-tools/nip19"
import type {Locator, Page} from "@playwright/test"
import {DAY, HOUR, MINUTE} from "@welshman/lib"
import {DIRECT_MESSAGE, REACTION} from "@welshman/util"
import {MessagingRelayList} from "@welshman/domain"
import {
  bubble,
  chatItems,
  chatList,
  chatPath,
  composer,
  composerDisabled,
  composerEnabled,
  expect,
  forgetRelay,
  makeTestUser,
  pageBar,
  pathPattern,
  profilePath,
  readCachedEvents,
  roomPath,
  send,
  test,
  topDialog,
  users,
} from "../harness"
import type {SeededRumor, SeededSpace, TestUser} from "../harness"

// Everything about a person is resolved through their relay list — their profile, their messaging
// relays, the wraps addressed to them — and a scenario with no fallbacks resolves an author with
// no kind-10002 to no relays at all. So a person here is a membership, a profile and a relay list.
// Membership is also what lets a gift wrap addressed to them be stored: zooid authorizes a
// kind-1059 by the member named in its p tag.
const seedPerson = (space: SeededSpace, user: TestUser, name: string, ...rooms: string[]) => {
  space.join(user, ...rooms)
  space.profile(user, {name})
  space.relayList(user)
}

const chatFilter = (page: Page) => page.locator(".secondary-nav input[type='text']")

// ChatItem's unread mark is a bare dot with no text of its own.
const unreadDots = (scope: Locator) => scope.locator(".rounded-full.bg-primary")

// The "..." menu on a profile header, which is the only ghost circle button either the profile
// page or the profile modal renders.
const profileMenu = (scope: Page | Locator) => scope.locator("button.button-circle.button-ghost")

// A modal's body is the only scroll container carrying its title.
const modalBody = (page: Page, title: string) =>
  page
    .locator(".scroll-container")
    .filter({has: page.getByRole("heading", {name: title, exact: true})})

// Both things the composer puts above itself — the message being replied to and the editing
// indicator — are the same bordered strip.
const composePreview = (page: Page) => page.locator(".room__compose .border-l-2")

// A conversation names its messages by id rather than by text: the same words are sent more than
// once in these stories, and only the id says which bubble is which.
const message = (page: Page, id: string) => page.locator(`[data-event="${id}"]`)

const enablePrompt = (page: Page) => page.getByRole("heading", {name: "Enable direct messaging?"})

// The composer stays disabled until every recipient's messaging relays have been read, so waiting
// on it is part of sending rather than a wait for a wait's sake.
const sendDm = async (page: Page, content: string) => {
  await composerEnabled(page)
  await send(page, content)
}

// A suggestion carries the pubkey it selects as its label, so the name is what gets typed and the
// pubkey is what identifies the row that comes back.
const startChat = async (page: Page, people: {term: string; user: TestUser}[]) => {
  await page.getByRole("button", {name: "Start New Chat"}).click()

  await expect(page.getByRole("heading", {name: "Start a Chat"})).toBeVisible()

  for (const {term, user} of people) {
    const suggestion = page.locator(`.tiptap-suggestions__item[aria-label="${user.pubkey}"]`)

    // Typed a keystroke at a time rather than filled: the suggestion list is rebuilt off the term
    // changing, so a term that arrives all at once is matched against whatever the profile search
    // held at that instant and never again.
    await page.getByPlaceholder("Search for profiles...").pressSequentially(term, {delay: 150})

    await expect(suggestion).toContainText(term)

    await suggestion.click()
  }

  await page.getByRole("button", {name: "Create Chat"}).click()
}

// A message's actions live behind a hover popover on a pointer device and behind a modal of named
// buttons on a touch one, so a spec that wants to name them opens a touch context.
const openMessageMenu = (page: Page, id: string) =>
  message(page, id).locator(".chat-bubble").click()

// A day divider and a chat item's stamp, formatted by the browser rather than by node, so the
// locale and the timezone are the ones the app rendered with. The options mirror dateFormatter and
// dateTimeFormatter in @welshman/lib.
const dayLabel = (page: Page, seconds: number) =>
  page.evaluate(
    ts =>
      new Intl.DateTimeFormat(undefined, {year: "numeric", month: "long", day: "numeric"}).format(
        new Date(ts * 1000),
      ),
    seconds,
  )

const stampLabel = (page: Page, seconds: number) =>
  page.evaluate(
    ts =>
      new Intl.DateTimeFormat(undefined, {dateStyle: "short", timeStyle: "short"}).format(
        new Date(ts * 1000),
      ),
    seconds,
  )

// What this user's client has written to disk, of one kind. Events reach indexeddb in three-second
// batches with nothing in the ui to say when one has landed, so a spec that takes the relay away
// and reloads has to read the cache first — otherwise it passes or fails on the batch window rather
// than on what was persisted.
const cachedContent = async (page: Page, pubkey: string, kind: number) =>
  (await readCachedEvents(page, pubkey))
    .filter(event => event.kind === kind)
    .map(event => event.content)

const topOf = async (locator: Locator) => {
  const box = await locator.boundingBox()

  expect(box).toBeTruthy()

  return box!.y
}

test("US-029 start a one-on-one chat", async ({seed, as}) => {
  await seed(({relay, user, at}) => {
    const space = relay("space")

    seedPerson(space, user.alice, "Alice Anchor")
    seedPerson(space, user.bob, "Bob Barnacle")
    seedPerson(space, user.carol, "Carol Cutter")
    space.messagingRelayList(user.alice)
    space.messagingRelayList(user.bob)

    // A conversation the three of them are already in. It puts bob's profile in her client before
    // she goes looking for him, without being the one-on-one she is about to start.
    space.dm(user.carol, [user.alice, user.bob], "welcome aboard, both of you", at(3, HOUR))
  })

  const page = await as(users.alice, "/chat")

  // A group conversation's item in the list names only the first of its participants, so his name
  // rather than his npub in its header is the client saying it has his profile, which is what the
  // search she is about to type into is built from.
  await chatItems(page).filter({hasText: "welcome aboard"}).click()

  await expect(pageBar(page)).toContainText("Bob Barnacle")

  await startChat(page, [{term: "Barnacle", user: users.bob}])

  await expect(page).toHaveURL(pathPattern(chatPath(users.bob.pubkey)))
  await expect(composer(page)).toBeVisible()
  await composerEnabled(page)

  await sendDm(page, "hi bob")

  await expect(bubble(page, "hi bob")).toBeVisible()

  // The conversation she just started is the one at the top of her list, under his name
  await expect(chatItems(page).first()).toContainText("Bob Barnacle")
  await expect(chatItems(page).first()).toContainText("hi bob")

  // His profile leads back into the same conversation
  await pageBar(page).getByRole("button", {name: "Bob Barnacle"}).click()
  await page.getByRole("button", {name: "View Full Profile"}).click()

  await expect(page).toHaveURL(pathPattern(profilePath(users.bob.pubkey)))

  await page.getByRole("button", {name: "Message", exact: true}).click()

  await expect(page).toHaveURL(pathPattern(chatPath(users.bob.pubkey)))
  await expect(bubble(page, "hi bob")).toBeVisible()

  // The profile page's menu leaves messaging to the button beside it
  await page.goto(profilePath(users.bob.pubkey))
  await profileMenu(page).click()

  await expect(page.getByRole("button", {name: "Profile Info"})).toBeVisible()
  await expect(page.getByRole("button", {name: "Send Message"})).toHaveCount(0)

  // The profile modal, which has no such button, carries the action in its menu instead
  await page.goto("/chat")
  await chatItems(page).filter({hasText: "welcome aboard"}).click()
  await bubble(page, "welcome aboard").getByRole("button", {name: "Carol Cutter"}).first().click()
  await profileMenu(topDialog(page)).click()
  await page.getByRole("button", {name: "Send Message"}).click()

  await expect(page).toHaveURL(pathPattern(chatPath(users.carol.pubkey)))
  await expect(pageBar(page)).toContainText("Carol Cutter")

  // Her own profile offers no way to message herself
  await page.goto(profilePath(users.alice.pubkey))

  await expect(page.getByRole("button", {name: "Edit profile"})).toBeVisible()
  await expect(page.getByRole("button", {name: "Message", exact: true})).toHaveCount(0)
})

test("US-030 start a group chat", async ({seed, as}) => {
  await seed(({relay, user, at}) => {
    const space = relay("space")

    seedPerson(space, user.alice, "Alice Anchor")
    seedPerson(space, user.bob, "Bob Barnacle")
    seedPerson(space, user.carol, "Carol Cutter")
    space.messagingRelayList(user.alice)
    space.messagingRelayList(user.bob)
    space.messagingRelayList(user.carol)

    // One conversation with each of them, so both profiles are in her client before she searches.
    space.dm(user.bob, [user.alice], "just us two", at(4, HOUR))
    space.dm(user.carol, [user.alice], "hello from carol", at(3, HOUR))
  })

  const page = await as(users.alice, "/chat")

  // Their names rather than their npubs is the client saying it has both profiles, which is what
  // the search she is about to type into is built from.
  await expect(chatItems(page).filter({hasText: "just us two"})).toContainText("Bob Barnacle")
  await expect(chatItems(page).filter({hasText: "hello from carol"})).toContainText("Carol Cutter")

  await startChat(page, [
    {term: "Barnacle", user: users.bob},
    {term: "Cutter", user: users.carol},
  ])

  // One conversation holding both of them, rather than one apiece
  await expect(page).toHaveURL(pathPattern(chatPath(users.bob.pubkey, users.carol.pubkey)))
  await composerEnabled(page)

  // Labeled with both of them rather than with one
  await expect(pageBar(page)).toContainText("Bob Barnacle")
  await expect(pageBar(page)).toContainText("Carol Cutter")

  await pageBar(page)
    .getByRole("button", {name: /Bob Barnacle/})
    .click()

  const members = modalBody(page, "People in this conversation")

  await expect(members.getByText("Bob Barnacle")).toBeVisible()
  await expect(members.getByText("Carol Cutter")).toBeVisible()

  await members.getByRole("button", {name: "Carol Cutter"}).click()

  await expect(members).toHaveCount(0)
  await expect(page.getByRole("button", {name: "View Full Profile"})).toBeVisible()

  await page.getByRole("button", {name: "View Full Profile"}).click()

  await expect(page).toHaveURL(pathPattern(profilePath(users.carol.pubkey)))
})

test("US-031 direct messaging has to be switched on", async ({seed, as}) => {
  await seed(({relay, user}) => {
    const space = relay("space")

    // Neither of them has ever published a kind-10050, which is what messaging being off is.
    seedPerson(space, user.alice, "Alice Anchor")
    seedPerson(space, user.bob, "Bob Barnacle")
  })

  const alice = await as(users.alice, profilePath(users.bob.pubkey))

  await alice.getByRole("button", {name: "Message", exact: true}).click()

  // The prompt stands where the conversation she asked for would have been
  await expect(enablePrompt(alice)).toBeVisible()
  await expect(alice).not.toHaveURL(pathPattern(chatPath(users.bob.pubkey)))
  await expect(composer(alice)).toHaveCount(0)

  await alice.getByRole("button", {name: "Enable direct messaging"}).click()

  // Turning it on carries her on into the conversation she started
  await expect(enablePrompt(alice)).toHaveCount(0)
  await expect(alice).toHaveURL(pathPattern(chatPath(users.bob.pubkey)))

  // Bob has never enabled it, so his end of the conversation is a dead end
  const banner = alice.locator(".card").filter({hasText: "Direct messages are not enabled"})

  await expect(banner).toContainText("Bob Barnacle")
  await composerDisabled(alice)

  const bob = await as(users.bob, "/")

  await bob.locator('.primary-nav [data-tip="Messages"]').click()

  await expect(enablePrompt(bob)).toBeVisible()

  await bob.getByRole("button", {name: "Enable direct messaging"}).click()

  // His list is the app's evidence that his kind-10050 has been published
  await expect(bob).toHaveURL(/\/chat$/)
  await expect(bob.getByRole("button", {name: "Start New Chat"})).toBeVisible()

  // She reopens the conversation the way she opened it the first time
  await pageBar(alice).getByRole("button", {name: "Bob Barnacle"}).click()
  await alice.getByRole("button", {name: "View Full Profile"}).click()

  await expect(alice).toHaveURL(pathPattern(profilePath(users.bob.pubkey)))

  await alice.getByRole("button", {name: "Message", exact: true}).click()

  // The prompt is behind her for good, and his end of it works now
  await expect(alice).toHaveURL(pathPattern(chatPath(users.bob.pubkey)))
  await expect(enablePrompt(alice)).toHaveCount(0)
  await composerEnabled(alice)
  await expect(banner).toHaveCount(0)

  await sendDm(alice, "finally")

  await expect(bubble(alice, "finally")).toBeVisible()
  await expect(chatItems(bob).filter({hasText: "finally"})).toBeVisible()
})

test("US-032 exchange messages in a conversation", async ({seed, as}) => {
  let yesterday!: SeededRumor
  let firstToday!: SeededRumor
  let secondToday!: SeededRumor

  const scenario = await seed(({relay, user, at}) => {
    const space = relay("space")

    seedPerson(space, user.alice, "Alice Anchor")
    seedPerson(space, user.bob, "Bob Barnacle")
    space.messagingRelayList(user.alice)
    space.messagingRelayList(user.bob)

    yesterday = space.dm(user.bob, [user.alice], "sent this yesterday", at(30, HOUR))
    // A minute apart, which is what puts these two in the same run of messages.
    firstToday = space.dm(user.bob, [user.alice], "morning alice", at(50, MINUTE))
    secondToday = space.dm(user.bob, [user.alice], "still around?", at(49, MINUTE))
  })

  const alice = await as(users.alice, chatPath(users.bob.pubkey))
  const bob = await as(users.bob, chatPath(users.alice.pubkey))

  await expect(message(alice, yesterday.id)).toBeVisible()
  await expect(message(alice, firstToday.id)).toBeVisible()
  await expect(message(alice, secondToday.id)).toBeVisible()

  // Chronological: each message is rendered below the one before it
  expect(await topOf(message(alice, yesterday.id))).toBeLessThan(
    await topOf(message(alice, firstToday.id)),
  )
  expect(await topOf(message(alice, firstToday.id))).toBeLessThan(
    await topOf(message(alice, secondToday.id)),
  )

  // A divider per day
  await expect(alice.getByText(await dayLabel(alice, scenario.at(30, HOUR)))).toBeVisible()
  await expect(alice.getByText(await dayLabel(alice, scenario.at(50, MINUTE)))).toBeVisible()

  // His second message in a row carries neither his name nor his avatar
  await expect(bubble(alice, "morning alice")).toContainText("Bob Barnacle")
  await expect(bubble(alice, "morning alice").locator(".rounded-full")).toHaveCount(1)
  await expect(bubble(alice, "still around?")).not.toContainText("Bob Barnacle")
  await expect(bubble(alice, "still around?").locator(".rounded-full")).toHaveCount(0)

  await sendDm(alice, "just got here")

  await expect(bubble(alice, "just got here")).toBeVisible()
  await expect(bubble(alice, "just got here")).toHaveClass(/chat-bubble--user/)
  await expect(composer(alice)).toHaveText("")

  // ...and it reaches the conversation he already has open, attributed to her
  await expect(bubble(bob, "just got here")).toBeVisible()
  await expect(bubble(bob, "just got here")).toContainText("Alice Anchor")
})

test("US-033 browse and search your conversations", async ({seed, as}) => {
  const dave = makeTestUser("dave")

  const scenario = await seed(({relay, user, at}) => {
    const space = relay("space")

    seedPerson(space, user.alice, "Alice Anchor")
    seedPerson(space, user.bob, "Bob Barnacle")
    seedPerson(space, user.carol, "Carol Cutter")
    seedPerson(space, dave, "Dave Davits")
    space.messagingRelayList(user.alice)

    space.dm(dave, [user.alice], "see you at the meetup", at(2, DAY))
    space.dm(user.carol, [user.alice], "thanks for the link", at(3, HOUR))
    space.dm(user.bob, [user.alice], "lunch tomorrow?", at(30, MINUTE))
  })

  const page = await as(users.alice, "/chat")

  await expect(chatItems(page)).toHaveCount(3)

  const bobStamp = await stampLabel(page, scenario.at(30, MINUTE))
  const carolStamp = await stampLabel(page, scenario.at(3, HOUR))
  const daveStamp = await stampLabel(page, scenario.at(2, DAY))

  // Most recently active first, each with a name, a preview and a timestamp
  await expect(chatItems(page).nth(0)).toContainText("Bob Barnacle")
  await expect(chatItems(page).nth(0)).toContainText("lunch tomorrow?")
  await expect(chatItems(page).nth(0)).toContainText(bobStamp)
  await expect(chatItems(page).nth(1)).toContainText("Carol Cutter")
  await expect(chatItems(page).nth(1)).toContainText("thanks for the link")
  await expect(chatItems(page).nth(1)).toContainText(carolStamp)
  await expect(chatItems(page).nth(2)).toContainText("Dave Davits")
  await expect(chatItems(page).nth(2)).toContainText("see you at the meetup")
  await expect(chatItems(page).nth(2)).toContainText(daveStamp)

  await chatFilter(page).fill("Bob Barnacle")

  await expect(chatItems(page)).toHaveCount(1)
  await expect(chatItems(page).nth(0)).toContainText("Bob Barnacle")

  await chatFilter(page).fill("")

  await expect(chatItems(page)).toHaveCount(3)
})

test("US-034 track and clear unread conversations", async ({seed, as}) => {
  const dave = makeTestUser("dave")

  await seed(({relay, user, at}) => {
    const space = relay("space")

    seedPerson(space, user.alice, "Alice Anchor")
    seedPerson(space, user.bob, "Bob Barnacle")
    seedPerson(space, user.carol, "Carol Cutter")
    seedPerson(space, dave, "Dave Davits")
    space.messagingRelayList(user.alice)
    space.messagingRelayList(user.bob)

    space.dm(user.carol, [user.alice], "did you see this?", at(3, HOUR))
    space.dm(dave, [user.alice], "ping from dave", at(2, HOUR))
  })

  const alice = await as(users.alice, "/chat")
  const bobChat = chatItems(alice).filter({hasText: "Bob Barnacle"})
  const carolChat = chatItems(alice).filter({hasText: "Carol Cutter"})
  const daveChat = chatItems(alice).filter({hasText: "Dave Davits"})

  await expect(chatItems(alice)).toHaveCount(2)
  await expect(unreadDots(carolChat)).toBeVisible()
  await expect(unreadDots(daveChat)).toBeVisible()

  // Bob writes while she is looking at the list rather than at his conversation
  const bob = await as(users.bob, chatPath(users.alice.pubkey))

  await sendDm(bob, "are you free later?")

  await expect(bobChat).toBeVisible()
  await expect(unreadDots(bobChat)).toBeVisible()

  // Reading it and moving on clears it
  await bobChat.click()

  await expect(bubble(alice, "are you free later?")).toBeVisible()

  await carolChat.click()

  await expect(bubble(alice, "did you see this?")).toBeVisible()
  await expect(unreadDots(bobChat)).toHaveCount(0)

  // Mark all read clears what is left of them in one go
  await alice.locator(".secondary-nav__header").getByRole("button", {name: "Chat options"}).click()
  await alice.getByRole("button", {name: "Mark all read"}).click()

  await expect(unreadDots(chatList(alice))).toHaveCount(0)

  // ...and they are still clear when she comes back
  await alice.locator('.primary-nav [data-tip="Settings"]').click()

  await expect(alice).toHaveURL(pathPattern("/settings/profile"))

  await alice.locator('.primary-nav [data-tip="Messages"]').click()

  await expect(chatItems(alice)).toHaveCount(3)
  await expect(unreadDots(chatList(alice))).toHaveCount(0)
})

test("US-035 reply to, edit, and react to a direct message", async ({seed, as}) => {
  let his!: SeededRumor
  let hers!: SeededRumor

  await seed(({relay, user, at}) => {
    const space = relay("space")

    seedPerson(space, user.alice, "Alice Anchor")
    seedPerson(space, user.bob, "Bob Barnacle")
    space.messagingRelayList(user.alice)
    space.messagingRelayList(user.bob)

    his = space.dm(user.bob, [user.alice], "did you see the thing?", at(20, MINUTE))
    hers = space.dm(user.alice, [user.bob], "first attempt", at(10, MINUTE))
  })

  // A touch context, which is what puts a message's actions behind named buttons rather than
  // behind a row of icons in a hover popover.
  const alice = await as(users.alice, chatPath(users.bob.pubkey), {context: {hasTouch: true}})
  const bob = await as(users.bob, chatPath(users.alice.pubkey))

  await expect(message(alice, his.id)).toBeVisible()
  await expect(message(alice, hers.id)).toBeVisible()

  // Reply: the preview appears above the composer, and closing it sends nothing
  await openMessageMenu(alice, his.id)
  await alice.getByRole("button", {name: "Reply"}).click()

  await expect(composePreview(alice)).toContainText("Replying to @Bob Barnacle")
  await expect(composePreview(alice)).toContainText("did you see the thing?")

  await composePreview(alice).getByRole("button").last().click()

  await expect(composePreview(alice)).toHaveCount(0)
  await expect(alice.locator(".chat-bubble")).toHaveCount(2)

  await openMessageMenu(alice, his.id)
  await alice.getByRole("button", {name: "Reply"}).click()

  await expect(composePreview(alice)).toContainText("Replying to @Bob Barnacle")

  await sendDm(alice, "yes I did")

  // The reply that gets sent quotes what it answers
  await expect(bubble(alice, "yes I did")).toContainText("did you see the thing?")
  await expect(bubble(bob, "yes I did")).toContainText("did you see the thing?")

  // Edit: her own message is replaced in place for both of them rather than duplicated. The menu
  // leads with React and Reply and keeps the rest behind a disclosure.
  await openMessageMenu(alice, hers.id)
  await alice.getByRole("button", {name: "More Options"}).click()

  await expect(alice.getByRole("button", {name: "Edit Message"})).toBeVisible()

  await alice.getByRole("button", {name: "Edit Message"}).click()

  await expect(composePreview(alice)).toContainText("Editing message")
  await expect(composer(alice)).toContainText("first attempt")

  await composer(alice).press("ControlOrMeta+a")
  await sendDm(alice, "second attempt")

  await expect(bubble(alice, "second attempt")).toBeVisible()
  await expect(alice.locator(".chat-bubble").filter({hasText: "first attempt"})).toHaveCount(0)
  await expect(bubble(bob, "second attempt")).toBeVisible()
  await expect(bob.locator(".chat-bubble").filter({hasText: "first attempt"})).toHaveCount(0)

  // His, hers and her reply — the edit replaced one rather than adding a fourth
  await expect(alice.locator(".chat-bubble")).toHaveCount(3)
  await expect(bob.locator(".chat-bubble")).toHaveCount(3)

  // React, then take it back, on both sides of the conversation
  await openMessageMenu(alice, his.id)
  await alice.getByRole("button", {name: "React"}).click()

  const picker = alice.locator("emoji-picker").filter({visible: true})

  // A result's label is the emoji, its annotation and every shortcode joined together, so the
  // annotation is what gets matched rather than the whole of it.
  await picker.locator("input.search").fill("party popper")
  await picker.getByRole("option", {name: /party popper/}).click()

  await expect(message(alice, his.id)).toContainText("🎉")
  await expect(message(bob, his.id)).toContainText("🎉")

  await message(alice, his.id).getByRole("button", {name: "🎉"}).click()

  await expect(message(alice, his.id)).not.toContainText("🎉")
  await expect(message(bob, his.id)).not.toContainText("🎉")

  // Up in an empty composer picks up the last thing she said, which is the reply
  await expect(composer(alice)).toHaveText("")

  await composer(alice).press("ArrowUp")

  await expect(composePreview(alice)).toContainText("Editing message")
  await expect(composer(alice)).toContainText("yes I did")
})

test("US-036 receive a new conversation live", async ({seed, as}) => {
  await seed(({relay, user, at}) => {
    const space = relay("space")

    seedPerson(space, user.alice, "Alice Anchor")
    seedPerson(space, user.bob, "Bob Barnacle")
    seedPerson(space, user.carol, "Carol Cutter")
    space.messagingRelayList(user.alice)
    space.messagingRelayList(user.bob)

    // A conversation each of them already has. A list with something in it is how each page says
    // its own end of the sync is up, before the one that has to arrive live is sent.
    space.dm(user.carol, [user.alice], "see you monday", at(4, HOUR))
    space.dm(user.carol, [user.bob], "you too", at(4, HOUR))
  })

  const alice = await as(users.alice, "/chat")

  await expect(chatItems(alice).filter({hasText: "see you monday"})).toBeVisible()

  const bob = await as(users.bob, "/chat")

  await expect(chatItems(bob).filter({hasText: "you too"})).toBeVisible()

  // He has never talked to her, so he identifies her by the code she gave him
  await bob.getByRole("button", {name: "Start New Chat"}).click()
  await bob.getByPlaceholder("Search for profiles...").fill(npubEncode(users.alice.pubkey))
  await bob.getByRole("button", {name: "Create Chat"}).click()

  await expect(bob).toHaveURL(pathPattern(chatPath(users.alice.pubkey)))

  await sendDm(bob, "starting a chat with you")

  // Her list picks the conversation up on its own
  const fromBob = chatItems(alice).filter({hasText: "Bob Barnacle"})

  await expect(fromBob).toBeVisible()

  await fromBob.click()

  await expect(bubble(alice, "starting a chat with you")).toBeVisible()
})

test("US-108 read messages from a relay you only use for messages", async ({seed, as}) => {
  const scenario = await seed(({relay, user, at}) => {
    const space = relay("space")
    const inbox = relay("other")

    seedPerson(space, user.alice, "Alice Anchor")
    seedPerson(space, user.bob, "Bob Barnacle")
    space.messagingRelayList(user.bob)

    // Alice's inbox is a relay she has nothing else to do with: not a space she has joined, and
    // not one of her read or write relays. Membership of it is only what lets a wrap addressed to
    // her be stored there — it never reaches her room list — so her messaging relay list is the
    // one thing that can vouch for her, and the relay serves her nothing until it does.
    inbox.member(user.alice)

    // Bob's own copy of the wrap is seeded onto the same relay, and this relay authorizes a wrap by
    // the member its p tag names, so he has to be one too. Nothing else here is his.
    inbox.member(user.bob)

    // Tagged verbatim rather than through setUrls, which normalizes on the way in. A list written
    // by another client is where a url missing its trailing slash comes from, and the relay it
    // names is the same relay either way.
    space.event(user.alice, () =>
      space
        .kind(MessagingRelayList)
        .writer()
        .addTags(["relay", inbox.url.replace(/\/$/, "")])
        .renderTemplate(),
    )

    inbox.dm(user.bob, [user.alice], "over on your inbox relay", at(2, HOUR))
  })

  // Only her space indexes, so the inbox relay is dialled for her messages and nothing else — the
  // socket a client opens before it knows what a relay is for never identifies itself to it, and
  // this relay serves an anonymous reader nothing.
  const page = await as(users.alice, "/chat", {
    env: {VITE_INDEXER_RELAYS: scenario.space("space").url},
  })

  const conversation = chatItems(page).filter({hasText: "over on your inbox relay"})

  await expect(conversation).toContainText("Bob Barnacle")

  await conversation.click()

  await expect(pageBar(page)).toContainText("Bob Barnacle")
  await expect(bubble(page, "over on your inbox relay")).toBeVisible()
})

test("US-109 keep a conversation you have already read", async ({seed, as}) => {
  let his!: SeededRumor
  let hers!: SeededRumor

  const scenario = await seed(({relay, user, at}) => {
    const space = relay("space")

    space.room("general", {name: "General"})

    seedPerson(space, user.alice, "Alice Anchor", "general")
    seedPerson(space, user.bob, "Bob Barnacle", "general")
    space.messagingRelayList(user.alice)
    space.messagingRelayList(user.bob)

    his = space.dm(user.bob, [user.alice], "the tide charts are up", at(2, HOUR))
    hers = space.dm(user.alice, [user.bob], "thakns", at(1, HOUR))

    // The control on the relay having really forgotten. A room message comes off the same relay as
    // the wraps and is the kind of thing a client reads back off the wire every time, so it is what
    // a conversation that survives is being distinguished from.
    space.message(user.bob, "general", "boat is in the water", at(2, HOUR))
  })

  const url = scenario.space("space").url

  // A touch context, which is what puts Edit Message behind a named button. Editing is the only way
  // the ui takes a direct message back, and the delete it publishes is the second half of the story.
  const alice = await as(users.alice, roomPath(url, "general"), {context: {hasTouch: true}})

  await expect(alice.locator(".room__item").filter({hasText: "boat is in the water"})).toBeVisible()

  await alice.goto(chatPath(users.bob.pubkey))

  await expect(message(alice, his.id)).toBeVisible()
  await expect(message(alice, hers.id)).toBeVisible()

  await openMessageMenu(alice, hers.id)
  await alice.getByRole("button", {name: "More Options"}).click()
  await alice.getByRole("button", {name: "Edit Message"}).click()

  await expect(composer(alice)).toContainText("thakns")

  await composer(alice).press("ControlOrMeta+a")
  await sendDm(alice, "thanks")

  await expect(bubble(alice, "thanks")).toBeVisible()
  await expect(alice.locator(".chat-bubble").filter({hasText: "thakns"})).toHaveCount(0)

  // A reaction travels to the conversation gift-wrapped the way the messages do, so it is kept or
  // lost with them rather than on its own terms.
  await openMessageMenu(alice, his.id)
  await alice.getByRole("button", {name: "React"}).click()

  const picker = alice.locator("emoji-picker").filter({visible: true})

  await picker.locator("input.search").fill("party popper")
  await picker.getByRole("option", {name: /party popper/}).click()

  await expect(message(alice, his.id)).toContainText("🎉")

  // The edit, the delete that retracted the original and the reaction all reach disk in batches, so
  // waiting for them there is waiting for the whole of what the reload is about to read back.
  await expect
    .poll(() => cachedContent(alice, users.alice.pubkey, DIRECT_MESSAGE))
    .toEqual(expect.arrayContaining(["the tide charts are up", "thanks"]))

  await expect.poll(() => cachedContent(alice, users.alice.pubkey, REACTION)).toContain("🎉")

  // Her messaging relay drops everything it was holding, and she comes back to the app
  forgetRelay(alice.context(), url)

  await alice.reload()

  await expect(bubble(alice, "the tide charts are up")).toBeVisible()
  await expect(bubble(alice, "thanks")).toBeVisible()
  await expect(alice.locator(".chat-bubble").filter({hasText: "thakns"})).toHaveCount(0)
  await expect(message(alice, his.id)).toContainText("🎉")

  // ...and the room, which she keeps no copy of, is as empty as the relay now is
  await alice.goto(roomPath(url, "general"))

  await expect(alice.locator(".room__item")).toHaveCount(0)
})
