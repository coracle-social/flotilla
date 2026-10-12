import {npubEncode} from "nostr-tools/nip19"
import type {Locator, Page} from "@playwright/test"
import {DAY, HOUR, MINUTE} from "@welshman/lib"
import {DIRECT_MESSAGE, REACTION} from "@welshman/util"
import {FollowList, MessagingRelayList} from "@welshman/domain"
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
  users,
} from "../harness"
import type {SeededRumor, SeededSpace, TestUser} from "../harness"

// A person here is a membership, a profile and a relay list, since everything resolves through one.
const seedPerson = (space: SeededSpace, user: TestUser, name: string, ...rooms: string[]) => {
  space.join(user, ...rooms)
  space.profile(user, {name})
  space.relayList(user)
}

const chatFilter = (page: Page) => page.locator(".secondary-nav input[type='text']")

// The chat list renders twice, once per breakpoint, so this scopes the tab to the sidebar.
const chatTab = (page: Page, name: string) =>
  page.locator(".secondary-nav").getByRole("button", {name})

// ChatItem's unread mark is a bare dot with no text of its own.
const unreadDots = (scope: Locator) => scope.locator(".rounded-full.bg-primary")

// The reply preview is a bordered strip above the composer.
const composePreview = (page: Page) => page.locator(".room__compose .border-l-2")

// The same words are sent more than once in these stories, so only the id says which bubble is which.
const message = (page: Page, id: string) => page.locator(`[data-event="${id}"]`)

const enablePrompt = (page: Page) => page.getByRole("heading", {name: "Enable direct messaging?"})

// The composer stays disabled until every recipient's messaging relays have been read.
const sendDm = async (page: Page, content: string) => {
  await composerEnabled(page)
  await send(page, content)
}

// A suggestion carries the pubkey it selects as its label, so the pubkey identifies the row.
const startChat = async (page: Page, people: {term: string; user: TestUser}[]) => {
  await page.getByRole("button", {name: "Start New Chat"}).click()

  await expect(page.getByRole("heading", {name: "Start a Chat"})).toBeVisible()

  for (const {term, user} of people) {
    const suggestion = page.locator(`.tiptap-suggestions__item[aria-label="${user.pubkey}"]`)

    // The suggestion list is rebuilt off the term changing, so a term arriving at once is matched once.
    await page.getByPlaceholder("Search for profiles...").pressSequentially(term, {delay: 150})

    await expect(suggestion).toContainText(term)

    await suggestion.click()
  }

  await page.getByRole("button", {name: "Create Chat"}).click()
}

// A message's actions are a hover popover on a pointer device and named buttons on a touch one.
const openMessageMenu = (page: Page, id: string) =>
  message(page, id).locator(".chat-bubble > .text-sm").click()

// Events reach indexeddb in three-second batches, so a spec that reloads has to read the cache first.
const cachedContent = async (page: Page, pubkey: string, kind: number) =>
  (await readCachedEvents(page, pubkey))
    .filter(event => event.kind === kind)
    .map(event => event.content)

test("US-029 start a one-on-one chat", async ({seed, as}) => {
  await seed(({relay, user, at}) => {
    const space = relay("space")

    seedPerson(space, user.alice, "Alice Anchor")
    seedPerson(space, user.bob, "Bob Barnacle")
    seedPerson(space, user.carol, "Carol Cutter")
    space.messagingRelayList(user.alice)
    space.messagingRelayList(user.bob)

    // A conversation the three of them are already in, which puts bob's profile in her client.
    space.dm(user.carol, [user.alice, user.bob], "welcome aboard, both of you", at(3, HOUR))
  })

  const page = await as(users.alice, "/chat")

  // A group conversation's item in the list names only the first of its participants.
  await chatItems(page).filter({hasText: "welcome aboard"}).click()

  await expect(pageBar(page)).toContainText("Bob Barnacle")

  await startChat(page, [{term: "Barnacle", user: users.bob}])

  await expect(page).toHaveURL(pathPattern(chatPath(users.bob.pubkey)))

  await sendDm(page, "hi bob")

  await expect(bubble(page, "hi bob")).toBeVisible()
  await expect(chatItems(page).filter({hasText: "hi bob"})).toContainText("Bob Barnacle")
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

  // Their names rather than their npubs is the client saying it has both profiles.
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

  await alice.getByRole("button", {name: "Enable direct messaging"}).click()

  // Turning it on carries her on into the conversation she started
  await expect(enablePrompt(alice)).toHaveCount(0)
  await expect(alice).toHaveURL(pathPattern(chatPath(users.bob.pubkey)))

  // Bob has never enabled it, so his end of the conversation is a dead end
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

  await sendDm(alice, "finally")

  await expect(bubble(alice, "finally")).toBeVisible()
  await expect(chatItems(bob).filter({hasText: "finally"})).toBeVisible()
})

test("US-032 exchange messages in a conversation", async ({seed, as}) => {
  await seed(({relay, user, at}) => {
    const space = relay("space")

    seedPerson(space, user.alice, "Alice Anchor")
    seedPerson(space, user.bob, "Bob Barnacle")
    space.messagingRelayList(user.alice)
    space.messagingRelayList(user.bob)

    space.dm(user.bob, [user.alice], "morning alice", at(50, MINUTE))
  })

  const alice = await as(users.alice, chatPath(users.bob.pubkey))
  const bob = await as(users.bob, chatPath(users.alice.pubkey))

  await expect(bubble(alice, "morning alice")).toBeVisible()

  await sendDm(alice, "just got here")

  await expect(bubble(alice, "just got here")).toBeVisible()
  await expect(composer(alice)).toHaveText("")

  // It reaches the conversation he already has open, attributed to her
  await expect(bubble(bob, "just got here")).toContainText("Alice Anchor")
})

test("US-033 browse and search your conversations", async ({seed, as}) => {
  const dave = makeTestUser("dave")

  await seed(({relay, user, at}) => {
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

  // Most recently active first
  await expect(chatItems(page).nth(0)).toContainText("lunch tomorrow?")
  await expect(chatItems(page).nth(2)).toContainText("see you at the meetup")

  await chatFilter(page).fill("Bob Barnacle")

  await expect(chatItems(page)).toHaveCount(1)
  await expect(chatItems(page).nth(0)).toContainText("Bob Barnacle")
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

  // A touch context, which puts a message's actions behind named buttons rather than a hover popover.
  const alice = await as(users.alice, chatPath(users.bob.pubkey), {context: {hasTouch: true}})
  const bob = await as(users.bob, chatPath(users.alice.pubkey))

  await expect(message(alice, his.id)).toBeVisible()
  await expect(message(alice, hers.id)).toBeVisible()

  await openMessageMenu(alice, his.id)
  await alice.getByRole("button", {name: "Reply"}).click()

  await expect(composePreview(alice)).toContainText("Replying to @Bob Barnacle")

  await sendDm(alice, "yes I did")

  // The reply that gets sent quotes what it answers
  await expect(bubble(alice, "yes I did")).toContainText("did you see the thing?")
  await expect(bubble(bob, "yes I did")).toContainText("did you see the thing?")

  // The menu leads with React and Reply and keeps the rest behind a disclosure.
  await openMessageMenu(alice, hers.id)
  await alice.getByRole("button", {name: "More Options"}).click()
  await alice.getByRole("button", {name: "Edit Message"}).click()

  await expect(composer(alice)).toContainText("first attempt")

  await composer(alice).press("ControlOrMeta+a")
  await sendDm(alice, "second attempt")

  await expect(bubble(bob, "second attempt")).toBeVisible()
  await expect(bob.locator(".chat-bubble").filter({hasText: "first attempt"})).toHaveCount(0)

  // React, then take it back, on both sides of the conversation
  await openMessageMenu(alice, his.id)
  await alice.getByRole("button", {name: "React"}).click()

  const picker = alice.locator("emoji-picker").filter({visible: true})

  // A result's label joins the emoji, its annotation and every shortcode.
  await picker.locator("input.search").fill("party popper")
  await picker.getByRole("option", {name: /party popper/}).click()

  await expect(message(alice, his.id)).toContainText("🎉")
  await expect(message(bob, his.id)).toContainText("🎉")

  await message(alice, his.id).getByRole("button", {name: "🎉"}).click()

  await expect(message(bob, his.id)).not.toContainText("🎉")
})

test("US-036 receive a new conversation live", async ({seed, as}) => {
  await seed(({relay, user, at}) => {
    const space = relay("space")

    seedPerson(space, user.alice, "Alice Anchor")
    seedPerson(space, user.bob, "Bob Barnacle")
    seedPerson(space, user.carol, "Carol Cutter")
    space.messagingRelayList(user.alice)
    space.messagingRelayList(user.bob)

    // A list with something in it is how each page says its own end of the sync is up.
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

  // His own copy first, so a send that lost keystrokes fails here rather than thirty seconds later.
  await expect(bubble(bob, "starting a chat with you")).toBeVisible()

  // Her list picks the conversation up on its own
  const fromBob = chatItems(alice).filter({hasText: "Bob Barnacle"})

  await expect(fromBob).toBeVisible()

  await fromBob.click()

  await expect(bubble(alice, "starting a chat with you")).toBeVisible()
})

test("US-128 keep messages from strangers out of your conversations", async ({seed, as}) => {
  const dave = makeTestUser("dave")
  const eve = makeTestUser("eve")

  const scenario = await seed(({relay, user, at}) => {
    const space = relay("space")
    const inbox = relay("other")

    // Carol she knows only through the space they are both in, the weakest thing that counts as knowing.
    seedPerson(space, user.alice, "Alice Anchor")
    seedPerson(space, user.bob, "Bob Barnacle")
    seedPerson(space, user.carol, "Carol Cutter")
    space.messagingRelayList(user.bob)
    space.messagingRelayList(user.carol)
    space.event(user.alice, () =>
      space.kind(FollowList).writer().follow(user.bob.pubkey).renderTemplate(),
    )

    // Membership of a relay never reaches a room list, so writing from it vouches for nobody.
    space.messagingRelayList(user.alice, [space.url, inbox.url])
    inbox.member(user.alice)
    inbox.member(dave)
    inbox.member(eve)

    space.dm(user.bob, [user.alice], "lunch tomorrow?", at(30, MINUTE))
    space.dm(user.carol, [user.alice], "the hull is patched", at(1, HOUR))
    inbox.dm(dave, [user.alice], "you have won a prize", at(2, HOUR))

    // Eve is as much a stranger as Dave, and answering her is the whole difference between them.
    inbox.dm(eve, [user.alice], "are you the alice from the boatyard?", at(4, HOUR))
    inbox.dm(user.alice, [eve], "I am, who is this?", at(3, HOUR))
  })

  // The socket a client opens before it knows what a relay is for never identifies itself to it.
  const page = await as(users.alice, "/chat", {
    env: {VITE_INDEXER_RELAYS: scenario.space("space").url},
  })

  await expect(chatItems(page)).toHaveCount(3)
  await expect(chatItems(page).filter({hasText: "the hull is patched"})).toBeVisible()
  await expect(chatItems(page).filter({hasText: "I am, who is this?"})).toBeVisible()

  await chatTab(page, "Requests").click()

  const fromDave = chatItems(page).filter({hasText: "you have won a prize"})

  await expect(chatItems(page)).toHaveCount(1)
  await expect(fromDave).toBeVisible()

  // A request is a chat like any other, so it opens and reads as one.
  await fromDave.click()

  await expect(bubble(page, "you have won a prize")).toBeVisible()
})

test("US-108 read messages from a relay you only use for messages", async ({seed, as}) => {
  const scenario = await seed(({relay, user, at}) => {
    const space = relay("space")
    const inbox = relay("other")

    seedPerson(space, user.alice, "Alice Anchor")
    seedPerson(space, user.bob, "Bob Barnacle")
    space.messagingRelayList(user.bob)

    // Her messaging relay list is the one thing that vouches for her, and the relay serves her nothing until it does.
    inbox.member(user.alice)

    // This relay authorizes a wrap by the member its p tag names, so bob has to be one too.
    inbox.member(user.bob)

    // Tagged verbatim rather than through setUrls, which normalizes on the way in.
    space.event(user.alice, () =>
      space
        .kind(MessagingRelayList)
        .writer()
        .addTags(["relay", inbox.url.replace(/\/$/, "")])
        .renderTemplate(),
    )

    inbox.dm(user.bob, [user.alice], "over on your inbox relay", at(2, HOUR))
  })

  // Only her space indexes, so the inbox relay is dialled for her messages and nothing else.
  const page = await as(users.alice, "/chat", {
    env: {VITE_INDEXER_RELAYS: scenario.space("space").url},
  })

  const conversation = chatItems(page).filter({hasText: "over on your inbox relay"})

  await expect(conversation).toContainText("Bob Barnacle")

  await conversation.click()

  await expect(pageBar(page)).toContainText("Bob Barnacle")
  await expect(bubble(page, "over on your inbox relay")).toBeVisible()
})

test("US-109 keep a conversation or room you have already read", async ({seed, as}) => {
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

    // A room message comes off the same relay, so it is kept or lost the same way.
    space.message(user.bob, "general", "boat is in the water", at(2, HOUR))
  })

  const url = scenario.space("space").url

  // A touch context, which is what puts Edit Message behind a named button.
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

  // A reaction travels gift-wrapped the way the messages do, so it is kept or lost with them.
  await openMessageMenu(alice, his.id)
  await alice.getByRole("button", {name: "React"}).click()

  const picker = alice.locator("emoji-picker").filter({visible: true})

  await picker.locator("input.search").fill("party popper")
  await picker.getByRole("option", {name: /party popper/}).click()

  await expect(message(alice, his.id)).toContainText("🎉")

  // The edit, the delete and the reaction all reach disk in batches, which is what the reload reads.
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

  // ...and so is the room she had open, which the relay can no longer answer for
  await alice.goto(roomPath(url, "general"))

  await expect(alice.locator(".room__item").filter({hasText: "boat is in the water"})).toBeVisible()
})
