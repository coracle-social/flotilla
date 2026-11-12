import {neventEncode} from "nostr-tools/nip19"
import {DAY, HOUR, WEEK, now} from "@welshman/lib"
import {MESSAGE, tagSpec, tagValue} from "@welshman/util"
import type {Locator, Page} from "@playwright/test"
import {
  composer,
  dialog,
  expect,
  getPublishedEvents,
  makeTestUser,
  message,
  messageActions,
  messages,
  openMessageMenu,
  openRoomDetail,
  pageBar,
  pathPattern,
  pickEmoji,
  roomLink,
  roomPath,
  send,
  spacePath,
  test,
  users,
} from "../harness"
import type {SeededEvent, SeededSpace, TestUser} from "../harness"

// The room's way back to the live end, up only while the bottom of the container isn't it.
const jumpToNewest = (page: Page) => page.getByRole("button", {name: "Jump to newest"})

// Each of these menus hides itself once the pointer leaves it, and the top left corner is outside.
const dismissMenu = (page: Page) => page.mouse.move(0, 0)

const roomDetail = (page: Page) => page.getByRole("dialog", {name: "Room details"})

const openRoomDetailMenu = (page: Page) =>
  roomDetail(page).getByRole("button", {name: "Room options"}).click()

// A FieldInline puts its control in the div immediately after its label.
const field = (form: Locator, label: string) =>
  form
    .locator("label")
    .filter({hasText: label})
    .locator("xpath=following-sibling::div")
    .locator("input[type=text]")

// RoomForm's permission toggles are a bare checkbox beside their own text.
const permission = (form: Locator, label: string) =>
  form.getByText(label).locator("xpath=preceding-sibling::input")

const reactionPill = (page: Page, text: string) =>
  message(page, text).getByRole("button", {name: /🎉/})

const react = (page: Page, opener: Locator) => pickEmoji(page, opener, "party popper")

// Outbox routing resolves a person through their relay list, and a gift wrap needs one too.
const seedChatter = (space: SeededSpace, user: TestUser) => {
  space.relayList(user)
  space.messagingRelayList(user)
}

test("US-018 send and receive a room message in real time", async ({seed, as}) => {
  const scenario = await seed(({relay, user, at}) => {
    const space = relay("space")

    space.room("general", {name: "General"})
    space.join(user.alice, "general")
    space.join(user.bob, "general")
    space.profile(user.alice, {name: "Alice Anchor"})
    space.message(user.bob, "general", "morning all", at(2, HOUR))
  })

  const {url} = scenario.space("space")
  const path = roomPath(url, "general")

  // Two browser contexts, two identities, one relay: bob's page is already listening when alice sends.
  const alice = await as(users.alice, path)
  const bob = await as(users.bob, path)

  await expect(message(bob, "morning all")).toBeVisible()

  await send(alice, "anyone there?")

  await expect(composer(alice)).toHaveText("")

  const sent = messages(alice).first()

  await expect(sent).toContainText("anyone there?")
  await expect(sent).toContainText("Alice Anchor")

  await expect(message(bob, "anyone there?")).toBeVisible()

  // Shift+Enter breaks the line rather than sending it
  await composer(alice).pressSequentially("first line")
  await composer(alice).press("Shift+Enter")
  await composer(alice).pressSequentially("second line")

  // ...and cmd/ctrl+enter sends from the middle of it
  await composer(alice).press("ArrowUp")
  await composer(alice).press("ControlOrMeta+Enter")

  await expect(composer(alice)).toHaveText("")
  await expect(message(alice, "second line")).toContainText("first line")
  await expect(message(bob, "second line")).toContainText("first line")
})

test("US-019 join and leave a room", async ({seed, as}) => {
  const scenario = await seed(({relay, user, at}) => {
    const space = relay("space")

    space.room("general", {name: "General"})
    space.join(user.alice, "general")
    // Bob belongs to the space but to none of its rooms, so joining one is his to do.
    space.join(user.bob)
    space.profile(user.bob, {name: "Bob Barnacle"})
    space.message(user.alice, "general", "morning all", at(2, HOUR))
  })

  const {url} = scenario.space("space")
  const path = roomPath(url, "general")

  const bob = await as(users.bob, path)
  const alice = await as(users.alice, path)

  await expect(message(bob, "morning all")).toBeVisible()

  await openRoomDetail(bob)
  await openRoomDetailMenu(bob)
  await bob.getByRole("button", {name: "Join member list"}).click()

  await expect(bob.getByText("You have joined the room.")).toBeVisible()

  // The membership events a client listens for live are the ones naming itself.
  await alice.reload()

  await expect(alice.getByText("joined the room").filter({hasText: "Bob Barnacle"})).toBeVisible()

  await openRoomDetailMenu(bob)
  await bob.getByRole("button", {name: "Leave member list"}).click()

  await expect(bob.getByText("You have left the room.")).toBeVisible()

  await openRoomDetailMenu(bob)

  await expect(bob.getByRole("button", {name: "Join member list"})).toBeVisible()
})

test("US-020 create, edit, and delete a room", async ({seed, as}) => {
  const scenario = await seed(({relay, user}) => {
    const space = relay("space")

    space.room("general", {name: "General"})
    space.join(user.admin, "general")
    space.join(user.bob, "general")
  })

  const {url} = scenario.space("space")
  const admin = await as(users.admin, roomPath(url, "general"))

  await admin.getByRole("button", {name: "Create room"}).click()

  const createForm = dialog(admin, "Create a Room")

  await field(createForm, "Name").fill("Ship Log")
  await field(createForm, "Description").fill("Where the watch writes things down")
  await createForm.getByRole("button", {name: "Create Room"}).click()

  await expect(pageBar(admin)).toContainText("Ship Log")

  // The room id is generated, so it comes back off the url the form navigated to
  const h = new URL(admin.url()).pathname.split("/").pop()!

  await openRoomDetail(admin)
  await openRoomDetailMenu(admin)
  await admin.getByRole("button", {name: "Edit Room"}).click()

  const editForm = dialog(admin, "Edit a Room")

  await field(editForm, "Name").fill("Captain's Log")
  await permission(editForm, "Only allow members to read messages").check()
  await editForm.getByRole("button", {name: "Save Changes"}).click()

  await expect(pageBar(admin)).toContainText("Captain's Log")
  await expect(roomLink(admin, "Captain's Log")).toBeVisible()

  await openRoomDetail(admin)

  await expect(roomDetail(admin).getByRole("button", {name: "Private"})).toBeVisible()

  await openRoomDetailMenu(admin)
  await admin.getByRole("button", {name: "Delete Room"}).click()
  await admin.getByRole("button", {name: "Confirm"}).click()

  await expect(admin).not.toHaveURL(pathPattern(h))
  await expect(admin).toHaveURL(pathPattern(spacePath(url)))
  await expect(roomLink(admin, "General")).toBeVisible()
  await expect(roomLink(admin, "Captain's Log")).toHaveCount(0)

  // Room management is the relay's business as much as the ui's, and bob has neither
  const bob = await as(users.bob, roomPath(url, "general"))

  await openRoomDetail(bob)
  await openRoomDetailMenu(bob)

  await expect(bob.getByRole("button", {name: "Leave member list"})).toBeVisible()
  await expect(bob.getByRole("button", {name: "Edit Room"})).toHaveCount(0)
  await expect(bob.getByRole("button", {name: "Delete Room"})).toHaveCount(0)
})

test("US-021 request access to a private room and get approved", async ({seed, as}) => {
  const scenario = await seed(({relay, user, at}) => {
    const space = relay("space")

    space.room("general", {name: "General"})
    // `private` hides the room's history from non-members; `closed` makes a join a request.
    space.room("wardroom", {name: "Wardroom", private: true, closed: true})
    space.join(user.admin, "general", "wardroom")
    space.join(user.alice, "general", "wardroom")
    // Carol belongs to the space, which is what lets her see that the room exists at all.
    space.join(user.carol)
    space.profile(user.carol, {name: "Carol Cutter"})
    space.message(user.alice, "wardroom", "the charts are in the locker", at(2, HOUR))
  })

  const {url} = scenario.space("space")
  const path = roomPath(url, "wardroom")

  const carol = await as(users.carol, path)
  const admin = await as(users.admin, path)

  await expect(message(admin, "the charts are in the locker")).toBeVisible()

  await expect(carol.getByText("You aren't currently a member of this room.")).toBeVisible()
  await expect(carol.getByText("the charts are in the locker")).toHaveCount(0)

  // A private room offers to join rather than to ask, and a closed one turns that into a request.
  await carol.getByRole("button", {name: "Join Room"}).click()

  await expect(carol.getByRole("button", {name: "Access Pending"})).toBeVisible()

  await admin.getByRole("button", {name: /space\.test/}).click()
  await admin.getByRole("button", {name: /Action Items/}).click()

  const request = admin.locator(".card").filter({hasText: "requested membership in"})

  await expect(request).toContainText("Carol Cutter")
  await expect(request).toContainText("Wardroom")

  await request.getByRole("button", {name: "Accept"}).click()

  await expect(admin.getByText("Member has been added to the room!")).toBeVisible()

  // The history the relay refused her is fetched when the room is next read.
  await carol.reload()

  await expect(carol.getByText("the charts are in the locker")).toBeVisible()

  await send(carol, "found them, thanks")

  await expect(message(carol, "found them, thanks")).toBeVisible()
  await expect(message(admin, "found them, thanks")).toBeVisible()
})

test("US-022 bring people into a room", async ({seed, as}) => {
  const dora = makeTestUser("dora")

  const scenario = await seed(({relay, user, at}) => {
    const space = relay("space")

    space.room("general", {name: "General"})
    space.join(user.admin, "general")
    space.join(user.bob, "general")
    space.profile(user.bob, {name: "Bob Barnacle"})
    // A space member who isn't in the room yet, whose message loads her profile into the client.
    space.join(dora)
    space.profile(dora, {name: "Dora Deckhand"})
    space.message(dora, "general", "passing through", at(3, HOUR))
  })

  const {url} = scenario.space("space")
  const admin = await as(users.admin, roomPath(url, "general"))

  await expect(message(admin, "passing through")).toContainText("Dora Deckhand")

  await openRoomDetail(admin)
  await admin.getByRole("button", {name: "Invite members"}).click()

  const invite = dialog(admin, "Create a Room Invite").locator("input[readonly]")

  await expect(invite).toHaveValue(/\/join\?r=space\.test&c=[^&]*&h=general&code=.+/)

  // A path rather than an absolute url, which would leave the test's own dev server for the platform's.
  const link = new URL(await invite.inputValue())
  const carol = await as(users.carol, `/join${link.search}`)

  await expect(carol.getByText("You're about to join:")).toBeVisible()

  await carol.getByRole("button", {name: "Join Room"}).click()

  await expect(carol.getByText("Welcome to the room!")).toBeVisible()
  await expect(carol).toHaveURL(pathPattern(roomPath(url, "general")))
  await expect(message(carol, "passing through")).toBeVisible()

  await admin.getByRole("button", {name: "Done"}).click()
  await admin.getByRole("button", {name: "View All"}).click()

  const members = dialog(admin, "Members")

  await expect(members.getByText("Bob Barnacle")).toBeVisible()
  await expect(members.getByText("Dora Deckhand")).toHaveCount(0)

  await admin.getByRole("button", {name: "Add members"}).click()
  await admin.getByPlaceholder("Search for profiles or paste a pubkey...").fill("Dora")
  await admin.locator(".tiptap-suggestions").getByRole("button", {name: dora.pubkey}).click()
  await admin.getByRole("button", {name: "Save changes"}).click()

  await expect(admin.getByText("Members have successfully been added!")).toBeVisible()
  await expect(members.getByText("Dora Deckhand")).toBeVisible()

  const doraCard = members.locator(".card").filter({hasText: "Dora Deckhand"})

  await doraCard.getByRole("button").last().click()
  await admin.getByRole("button", {name: "Manage member"}).click()

  const manage = dialog(admin, "Manage Member")

  await manage.getByRole("radio", {name: /Remove from General/}).check()
  await manage.getByRole("button", {name: "Remove from room"}).click()

  await expect(admin.getByText("They've been removed from the room.")).toBeVisible()
  await expect(members.getByText("Dora Deckhand")).toHaveCount(0)
})

test("US-023 reply to a message", async ({seed, as}) => {
  let notice!: SeededEvent

  const scenario = await seed(({relay, user, at}) => {
    const space = relay("space")

    space.room("general", {name: "General"})
    space.join(user.alice, "general")
    space.join(user.bob, "general")
    space.profile(user.alice, {name: "Alice Anchor"})
    notice = space.message(user.alice, "general", "the tide turns at six", at(2, HOUR))
  })

  const {url} = scenario.space("space")
  const path = roomPath(url, "general")

  const bob = await as(users.bob, path)
  const alice = await as(users.alice, path)

  await expect(message(bob, "the tide turns at six")).toBeVisible()

  await messageActions(bob, "the tide turns at six").nth(2).click()

  await expect(bob.getByText("Replying to @Alice Anchor")).toBeVisible()

  await send(bob, "aye, I'll be there")

  await expect(message(bob, "aye, I'll be there")).toContainText("the tide turns at six")
  await expect(message(alice, "aye, I'll be there")).toContainText("the tide turns at six")

  const quoted = (content: string) =>
    getPublishedEvents(bob.context(), MESSAGE)
      .filter(event => event.content === content)
      .map(event => tagValue(tagSpec("q"), event.tags))

  // The parent is the q tag alone, so the content is just the reply.
  await expect.poll(() => quoted("aye, I'll be there")).toEqual([notice.id])

  await messageActions(bob, "aye, I'll be there").nth(3).click()

  await expect(bob.getByText("Editing message")).toBeVisible()

  await composer(bob).press("ControlOrMeta+a")
  await send(bob, "aye, I'll be there early")

  await expect(message(alice, "aye, I'll be there early")).toContainText("the tide turns at six")
  await expect.poll(() => quoted("aye, I'll be there early")).toEqual([notice.id])
})

test("US-024 edit or delete a message you sent", async ({seed, as}) => {
  const scenario = await seed(({relay, user}) => {
    const space = relay("space")

    space.room("general", {name: "General"})
    space.join(user.alice, "general")
    space.join(user.bob, "general")
    space.profile(user.alice, {name: "Alice Anchor"})
    space.profile(user.bob, {name: "Bob Barnacle"})
  })

  const {url} = scenario.space("space")
  const path = roomPath(url, "general")

  const alice = await as(users.alice, path)
  const bob = await as(users.bob, path)

  // Only a message she sent in the last five minutes is editable, so she sends one
  await send(alice, "we sail at dwan")

  await expect(message(bob, "we sail at dwan")).toBeVisible()

  // Her edit republishes with her original timestamp, and it changes the event id US-118 ties on.
  const sent = now()

  while (now() === sent) {
    await alice.waitForTimeout(50)
  }

  await send(bob, "spelling?")

  await expect(message(alice, "spelling?")).toBeVisible()

  // His message offers her no delete
  await openMessageMenu(alice, "spelling?")

  await expect(alice.getByRole("button", {name: "Report Content"})).toBeVisible()
  await expect(alice.getByRole("button", {name: "Delete Message"})).toHaveCount(0)

  await dismissMenu(alice)

  await messageActions(alice, "we sail at dwan").nth(3).click()

  await expect(alice.getByText("Editing message")).toBeVisible()
  await expect(composer(alice)).toHaveText("we sail at dwan")

  await composer(alice).press("ControlOrMeta+a")
  await send(alice, "we sail at dawn")

  await expect(message(alice, "we sail at dawn")).toBeVisible()
  await expect(alice.getByText("we sail at dwan")).toHaveCount(0)
  await expect(message(bob, "we sail at dawn")).toBeVisible()
  await expect(bob.getByText("we sail at dwan")).toHaveCount(0)

  // Republished with its original timestamp, so it stays above the message it drew
  await expect(messages(alice).nth(1)).toContainText("we sail at dawn")
  await expect(messages(bob).nth(1)).toContainText("we sail at dawn")

  // Up in an empty composer picks up her most recent editable message
  await composer(alice).press("ArrowUp")

  await expect(alice.getByText("Editing message")).toBeVisible()
  await expect(composer(alice)).toHaveText("we sail at dawn")

  await alice.getByText("Editing message").locator("..").getByRole("button").click()

  await expect(alice.getByText("Editing message")).toHaveCount(0)
  await expect(message(alice, "we sail at dawn")).toBeVisible()

  await openMessageMenu(alice, "we sail at dawn")
  await alice.getByRole("button", {name: "Delete Message"}).click()
  await alice.getByRole("button", {name: "Confirm"}).click()

  await expect(alice.getByText("we sail at dawn")).toHaveCount(0)
  await expect(bob.getByText("we sail at dawn")).toHaveCount(0)
})

test("US-025 react to a message", async ({seed, as}) => {
  const scenario = await seed(({relay, user, at}) => {
    const space = relay("space")

    space.room("general", {name: "General"})
    space.join(user.alice, "general")
    space.join(user.bob, "general")
    space.join(user.carol, "general")
    space.profile(user.bob, {name: "Bob Barnacle"})
    space.message(user.alice, "general", "we made port", at(2, HOUR))
  })

  const {url} = scenario.space("space")
  const path = roomPath(url, "general")

  const carol = await as(users.carol, path)
  const bob = await as(users.bob, path)

  await expect(message(carol, "we made port")).toBeVisible()
  await expect(message(bob, "we made port")).toBeVisible()

  await react(carol, message(carol, "we made port").getByRole("button", {name: "Add a reaction"}))

  await expect(reactionPill(carol, "we made port")).toBeVisible()
  await expect(reactionPill(bob, "we made port")).toBeVisible()

  await react(bob, messageActions(bob, "we made port").nth(1))

  await expect(reactionPill(carol, "we made port")).toContainText("2")
  await expect(reactionPill(bob, "we made port")).toContainText("2")

  await reactionPill(carol, "we made port").hover()
  await expect(carol.getByRole("tooltip")).toContainText("Bob Barnacle reacted")

  await reactionPill(carol, "we made port").click()

  await expect(reactionPill(carol, "we made port")).not.toContainText("2")
  await expect(reactionPill(bob, "we made port")).not.toContainText("2")

  // On a phone, a pill she hasn't joined shows who reacted rather than adding her own
  const phone = await as(users.carol, path, {
    context: {viewport: {width: 390, height: 844}, hasTouch: true},
  })

  // The phone layout is what puts the reactor list behind a pill, so wait for it to be in effect.
  await expect(phone.getByRole("button", {name: "Open space menu"})).toBeVisible()
  await reactionPill(phone, "we made port").click()

  await expect(phone.getByText("Reacted to this message")).toBeVisible()

  // Exact, because the room behind the dialog names him too, as "@Bob Barnacle".
  await expect(phone.getByRole("button", {name: "Bob Barnacle", exact: true})).toBeVisible()
})

test("US-026 pin a message and browse pins", async ({seed, as}) => {
  let pinned!: SeededEvent

  const scenario = await seed(({relay, user, at}) => {
    const space = relay("space")

    space.room("general", {name: "General"})
    space.join(user.admin, "general")
    space.join(user.alice, "general")

    pinned = space.message(user.alice, "general", "muster at eight bells", at(2, HOUR))
  })

  const {url} = scenario.space("space")
  const admin = await as(users.admin, roomPath(url, "general"))

  await expect(message(admin, "muster at eight bells")).toBeVisible()

  await openMessageMenu(admin, "muster at eight bells")
  await admin.getByRole("button", {name: "Pin Message"}).click()

  const banner = admin.locator(".room-pins")

  await expect(banner).toContainText("muster at eight bells")

  await banner.getByRole("button", {name: "All pinned messages"}).click()

  const pins = dialog(admin, "Pinned Messages")

  await expect(pins).toContainText("muster at eight bells")

  await pins.getByRole("button", {name: "Jump to message"}).click()

  await expect(pins).toHaveCount(0)
  await expect(admin.locator(`[data-event="${pinned.id}"]`)).toBeInViewport()

  await banner.getByRole("button", {name: "All pinned messages"}).click()
  await pins.getByRole("button", {name: "Unpin"}).click()

  await expect(banner).toHaveCount(0)
})

test("US-027 find a past message and jump to it", async ({seed, as}) => {
  let lastWeek!: SeededEvent
  let older!: SeededEvent

  const scenario = await seed(({relay, user, at}) => {
    const space = relay("space")

    space.room("general", {name: "General"})
    space.join(user.alice, "general")
    space.join(user.bob, "general")
    space.message(user.bob, "general", "harbor lights are on tonight", at(2, HOUR))

    lastWeek = space.message(user.bob, "general", "harbor pilot is booked", at(3, DAY))
    older = space.message(user.bob, "general", "harbor dredging starts monday", at(3, WEEK))
  })

  const {url} = scenario.space("space")
  const path = roomPath(url, "general")
  const page = await as(users.alice, path)

  await expect(message(page, "harbor lights are on tonight")).toBeVisible()

  await pageBar(page).getByRole("button", {name: "Search"}).click()

  const term = page.getByPlaceholder("Search this room...")
  const search = dialog(page, "Search")

  await term.fill("harbor")

  await expect(search).toContainText("harbor dredging starts monday")

  await term.fill("harbor pilot")
  await search.getByText("harbor pilot is booked").click()

  await expect(search).toHaveCount(0)
  await expect(page.locator(`[data-event="${lastWeek.id}"]`)).toBeInViewport()

  // This room is three messages long, so the window runs to the present and the newest loads too.
  await page.goto(`${path}?at=${older.event.created_at}`)

  await expect(page.locator(`[data-event="${older.id}"]`)).toBeInViewport()
  await expect(message(page, "harbor lights are on tonight")).toBeVisible()
  await expect(jumpToNewest(page)).toHaveCount(0)
})

test("US-028 share a message somewhere else", async ({seed, as}) => {
  let shared!: SeededEvent

  const scenario = await seed(({relay, user, at}) => {
    const space = relay("space")

    space.room("general", {name: "General"})
    space.room("random", {name: "Random"})
    space.join(user.alice, "general", "random")
    space.join(user.bob, "general", "random")
    space.profile(user.alice, {name: "Alice Anchor"})
    space.profile(user.bob, {name: "Bob Barnacle"})
    shared = space.message(user.bob, "general", "the dock is closed on sunday", at(2, HOUR))

    seedChatter(space, user.alice)
    seedChatter(space, user.bob)
  })

  const {url} = scenario.space("space")

  const alice = await as(users.alice, roomPath(url, "general"), {
    context: {permissions: ["clipboard-read", "clipboard-write"]},
  })
  const bob = await as(users.bob, roomPath(url, "random"))

  await expect(message(alice, "the dock is closed on sunday")).toBeVisible()

  await openMessageMenu(alice, "the dock is closed on sunday")
  await alice.getByRole("button", {name: "Share Message"}).click()

  // ShareEvent is titled after the noun it was opened with, so its subtitle names it instead.
  const picker = alice
    .locator(".dialog")
    .filter({hasText: "Which room would you like to share this event to?"})
    .last()

  // The same dialog hands out a link to the message, for anywhere flotilla cannot reach.
  await picker.getByRole("button", {name: "Copy link"}).click()
  await expect(alice.getByRole("alert")).toContainText("Copied to clipboard!")

  const permalink = new URL(await alice.evaluate(() => navigator.clipboard.readText()))

  expect(permalink.pathname).toBe(roomPath(url, "general"))
  expect(permalink.search).toBe(
    `?at=${shared.event.created_at}&event=${neventEncode({id: shared.id, relays: [url]})}`,
  )

  await picker.getByRole("button", {name: "Random"}).click()
  await picker.getByRole("button", {name: /^Share/}).click()

  await expect(alice).toHaveURL(pathPattern(roomPath(url, "random")))
  await expect(alice.locator(".room__compose")).toContainText("the dock is closed on sunday")

  await send(alice, "heads up")

  await expect(message(alice, "heads up")).toContainText("the dock is closed on sunday")
  await expect(message(bob, "heads up")).toContainText("the dock is closed on sunday")
})
