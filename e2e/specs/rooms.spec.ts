import {neventEncode, npubEncode} from "nostr-tools/nip19"
import {DAY, HOUR, MINUTE, WEEK, bech32ToHex, now} from "@welshman/lib"
import {getLnUrl} from "@welshman/util"
import {Profile, displayPubkey} from "@welshman/domain"
import type {Locator, Page} from "@playwright/test"
import {
  composer,
  dialog,
  expect,
  makeTestUser,
  message,
  messageActions,
  messages,
  mockDufflepud,
  mockOpenRouterSpeech,
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

// The space menu's sections are flat siblings, so a room's section is a question of document order.
const roomSection = (page: Page, name: string) =>
  page.locator(".space-menu__scroll").evaluate((menu, roomName) => {
    let section: string | undefined

    for (const node of menu.querySelectorAll(".secondary-nav__header, .secondary-nav__nav-item")) {
      if (node.classList.contains("secondary-nav__header")) {
        section = node.textContent?.trim()
      } else if (node.textContent?.trim() === roomName) {
        return section
      }
    }
  }, name)

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
    space.profile(user.alice, {name: "Alice Anchor", picture: "https://images.test/alice.png"})
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
  await expect(sent).toContainText(/Today at \d/)
  await expect(sent.locator('img[src="https://images.test/alice.png"]')).toBeVisible()

  await expect(message(bob, "anyone there?")).toBeVisible()

  // Shift+Enter breaks the line rather than sending it
  await composer(alice).pressSequentially("first line")
  await composer(alice).press("Shift+Enter")
  await composer(alice).pressSequentially("second line")

  await expect(composer(alice).locator("br")).toHaveCount(1)
  await expect(messages(alice)).toHaveCount(2)

  // ...and cmd/ctrl+enter sends from the middle of it
  await composer(alice).press("ArrowUp")
  await composer(alice).press("ControlOrMeta+Enter")

  await expect(composer(alice)).toHaveText("")
  await expect(message(alice, "second line")).toContainText("first line")
  await expect(message(bob, "second line")).toContainText("first line")
})

// Two messages sharing a second are ordered by event id, which is the same on every client.
test("US-118 messages sent in the same second are in one order for everyone", async ({
  seed,
  as,
}) => {
  const tied: SeededEvent[] = []

  const scenario = await seed(({relay, user, at}) => {
    const space = relay("space")
    const sentAt = at(2, HOUR)

    space.room("general", {name: "General"})
    space.join(user.alice, "general")
    space.join(user.bob, "general")

    tied.push(
      space.message(user.bob, "general", "the tide turns at four", sentAt),
      space.message(user.alice, "general", "the tug is already out", sentAt),
      space.message(user.bob, "general", "we cast off before dark", sentAt),
      space.message(user.alice, "general", "the pilot boat follows us", sentAt),
      space.message(user.bob, "general", "and the harbor master knows", sentAt),
    )
  })

  const {url} = scenario.space("space")
  const page = await as(users.alice, roomPath(url, "general"))

  await expect(message(page, "and the harbor master knows")).toBeVisible()
  await expect(messages(page)).toHaveCount(5)

  const rendered = await messages(page).evaluateAll(items =>
    items.map(item => item.getAttribute("data-event")),
  )

  // The room reads newest first in the dom, so the ids run the other way from the feed.
  expect(rendered.reverse()).toEqual(tied.map(({id}) => id).sort())
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
  await expect.poll(() => roomSection(bob, "General")).toBe("Rooms")

  await openRoomDetail(bob)
  await openRoomDetailMenu(bob)
  await bob.getByRole("button", {name: "Join member list"}).click()

  await expect.poll(() => roomSection(bob, "General")).toBe("Your Rooms")

  // The membership events a client listens for live are the ones naming itself.
  await alice.reload()

  const joined = alice.getByText("joined the room").filter({hasText: "Bob Barnacle"})

  await expect(joined).toBeVisible()

  await joined.getByRole("button", {name: "@Bob Barnacle"}).click()

  await expect(alice.getByRole("button", {name: "View Full Profile"})).toBeVisible()

  await openRoomDetailMenu(bob)
  await bob.getByRole("button", {name: "Leave member list"}).click()

  await expect(bob.getByRole("alert")).toHaveClass(/text-content/)

  await openRoomDetailMenu(bob)

  await expect(bob.getByRole("button", {name: "Join member list"})).toBeVisible()
  await expect.poll(() => roomSection(bob, "General")).toBe("Rooms")
})

test("US-122 long room names keep header and dialog actions available", async ({seed, as}) => {
  const name = "A very long room name for coordinating every ship arriving in the harbor today"
  const scenario = await seed(({relay, user}) => {
    const space = relay("space")

    space.room("harbor", {name})
    space.join(user.alice, "harbor")
  })

  const {url} = scenario.space("space")
  const page = await as(users.alice, roomPath(url, "harbor"), {
    context: {viewport: {width: 800, height: 600}},
  })
  const header = pageBar(page)

  await expect(header.getByRole("button", {name: "Search"})).toBeVisible()
  await expect(header.getByRole("button", {name: "Room details"})).toBeVisible()
  expect(await header.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true)

  await openRoomDetail(page)

  const detail = roomDetail(page)

  await expect(detail.getByRole("button", {name: "Room options"})).toBeVisible()
  expect(await detail.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true)
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
  await expect.poll(() => roomSection(admin, "Ship Log")).toBe("Your Rooms")

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
  await admin.getByRole("button", {name: "Edit Room"}).click()

  await expect(field(editForm, "Name")).toHaveValue("Captain's Log")
  await expect(permission(editForm, "Only allow members to read messages")).toBeChecked()

  await editForm.getByRole("button", {name: "Go back"}).click()
  await openRoomDetailMenu(admin)
  await admin.getByRole("button", {name: "Delete Room"}).click()

  await expect(
    admin.getByRole("heading", {name: "Are you sure you want to delete this room?"}),
  ).toBeVisible()

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

test("US-121 land somewhere after deleting the room you are in", async ({seed, as}) => {
  const scenario = await seed(({relay, user}) => {
    const space = relay("space")

    space.room("general", {name: "General"})
    space.room("wardroom", {name: "Wardroom"})
    space.join(user.admin, "general")
    space.join(user.admin, "wardroom")
  })

  const {url} = scenario.space("space")
  const admin = await as(users.admin, roomPath(url, "wardroom"))

  await openRoomDetail(admin)
  await openRoomDetailMenu(admin)
  await admin.getByRole("button", {name: "Delete Room"}).click()
  await admin.getByRole("button", {name: "Confirm"}).click()

  // The space root renders nothing on a wide screen, handing off to the page of the space open last.
  await expect(admin).toHaveURL(pathPattern(spacePath(url) + "/"))
  await expect(roomLink(admin, "General")).toBeVisible()

  // Entering the space from the rail reads the same memory, so it has to land somewhere too.
  await admin.locator('.primary-nav [data-tip^="space"]').click()

  await expect(admin).toHaveURL(pathPattern(spacePath(url) + "/"))
  await expect(roomLink(admin, "General")).toBeVisible()
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
  const erik = makeTestUser("erik")

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
  await admin.getByRole("button", {name: "Create invite"}).click()

  const inviteModal = dialog(admin, "Create a Room Invite")
  // The link and its copy button share one bordered label, the only readonly field in the dialog.
  const inviteField = inviteModal.locator("label:has(input[readonly])")
  const invite = inviteField.locator("input[readonly]")

  await expect(inviteModal.locator("canvas")).toBeVisible()
  await expect(invite).toHaveValue(/\/join\?r=space\.test&c=[^&]*&h=general&code=.+/)

  await inviteField.getByRole("button").click()

  await expect(admin.getByText("Copied to clipboard!")).toBeVisible()

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
  await admin.getByPlaceholder("Search for profiles...").fill("Dora")
  await admin.locator(".tiptap-suggestions").getByRole("button", {name: dora.pubkey}).click()
  await admin.getByRole("button", {name: "Save changes"}).click()

  await expect(admin.getByText("Members have successfully been added!")).toBeVisible()
  await expect(members.getByText("Dora Deckhand")).toBeVisible()

  // A pubkey pasted into the search field selects that person outright, with no profile needed.
  await admin.getByRole("button", {name: "Add members"}).click()
  await admin.getByPlaceholder("Search for profiles...").fill(erik.pubkey)
  await admin.getByRole("button", {name: "Save changes"}).click()

  await expect(admin.getByText("is not a member of this space. Add them?")).toBeVisible()

  await admin.getByRole("button", {name: "Confirm"}).click()

  await expect(admin.getByText("Members have successfully been added!")).toBeVisible()
  await expect(members.getByText(displayPubkey(erik.pubkey))).toBeVisible()

  const doraCard = members.locator(".card").filter({hasText: "Dora Deckhand"})

  await doraCard.getByRole("button").last().click()
  await admin.getByRole("button", {name: "Remove Member"}).click()
  await admin.getByRole("button", {name: "Confirm"}).click()

  await expect(admin.getByText("Member has successfully been removed!")).toBeVisible()
  await expect(members.getByText("Dora Deckhand")).toHaveCount(0)

  const bob = await as(users.bob, roomPath(url, "general"))

  await openRoomDetail(bob)
  await bob.getByRole("button", {name: "View All"}).click()

  await expect(dialog(bob, "Members").getByText("Bob Barnacle")).toBeVisible()
  await expect(bob.getByRole("button", {name: "Add members"})).toHaveCount(0)
})

test("US-023 reply to a message", async ({seed, as}) => {
  const scenario = await seed(({relay, user, at}) => {
    const space = relay("space")

    space.room("general", {name: "General"})
    space.join(user.alice, "general")
    space.join(user.bob, "general")
    space.profile(user.alice, {name: "Alice Anchor"})
    space.message(user.alice, "general", "the tide turns at six", at(2, HOUR))
  })

  const {url} = scenario.space("space")
  const path = roomPath(url, "general")

  const bob = await as(users.bob, path)
  const alice = await as(users.alice, path)

  await expect(message(bob, "the tide turns at six")).toBeVisible()

  await messageActions(bob, "the tide turns at six").nth(2).click()

  const banner = bob.getByText("Replying to @Alice Anchor")

  await expect(banner).toBeVisible()
  await expect(bob.locator(".room__compose")).toContainText("the tide turns at six")

  // Escape clears the reply without sending it
  await composer(bob).press("Escape")

  await expect(banner).toHaveCount(0)

  // ...and so does the banner's own close button
  await messageActions(bob, "the tide turns at six").nth(2).click()
  await banner.locator("..").getByRole("button").last().click()

  await expect(banner).toHaveCount(0)
  await expect(messages(bob)).toHaveCount(1)

  await messageActions(bob, "the tide turns at six").nth(2).click()
  await send(bob, "aye, I'll be there")

  await expect(message(bob, "aye, I'll be there")).toContainText("the tide turns at six")
  await expect(message(alice, "aye, I'll be there")).toContainText("the tide turns at six")
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

  // Her own message offers zap, emoji, reply, edit and a menu; his offers no edit...
  await expect(messageActions(alice, "we sail at dwan")).toHaveCount(5)
  await expect(messageActions(alice, "spelling?")).toHaveCount(4)
  await expect(message(alice, "we sail at dwan").locator("button button")).toHaveCount(0)

  const moreOptions = message(alice, "we sail at dwan").getByRole("button", {
    name: "More options",
  })

  await moreOptions.focus()
  await expect(message(alice, "we sail at dwan").locator(".room__item-actions")).toHaveCSS(
    "opacity",
    "1",
  )
  await moreOptions.press("Enter")

  const messageDetails = alice.getByRole("button", {name: "Message Details"})

  await messageDetails.focus()
  await expect(messageDetails).toBeFocused()
  await alice.keyboard.press("Escape")
  await expect(moreOptions).toBeFocused()

  // ...and no delete either
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

  const reaction = message(carol, "we made port").getByRole("button", {name: "Add a reaction"})

  await reaction.focus()
  await reaction.press("Enter")

  const picker = carol.locator("emoji-picker").filter({visible: true})
  const search = picker.locator("input.search")

  await expect(picker).toBeVisible()
  await search.focus()
  await expect(search).toBeFocused()
  await carol.keyboard.press("Escape")
  await expect(picker).toHaveCount(0)
  await expect(reaction).toBeFocused()

  await react(carol, reaction)

  await expect(reactionPill(carol, "we made port")).toBeVisible()
  await expect(reactionPill(bob, "we made port")).toBeVisible()

  await react(bob, messageActions(bob, "we made port").nth(1))

  await expect(reactionPill(carol, "we made port")).toContainText("2")
  await expect(reactionPill(bob, "we made port")).toContainText("2")

  await reactionPill(carol, "we made port").click()

  await expect(reactionPill(carol, "we made port")).not.toContainText("2")
  await expect(reactionPill(carol, "we made port")).not.toHaveClass(/button-primary/)
  await expect(reactionPill(bob, "we made port")).not.toContainText("2")

  // On a phone, a pill she hasn't joined shows who reacted rather than adding her own
  const phone = await as(users.carol, path, {
    context: {viewport: {width: 390, height: 844}, hasTouch: true},
  })

  // The phone layout is what puts the reactor list behind a pill, so wait for it to be in effect.
  await expect(phone.getByRole("button", {name: "Open space menu"})).toBeVisible()
  await expect(reactionPill(phone, "we made port")).toBeVisible()

  // A pill she is part of toggles her reaction off instead of opening the list.
  await expect(reactionPill(phone, "we made port")).not.toHaveClass(/button-primary/)

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

  await expect(admin.getByText("Message pinned")).toBeVisible()

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

  await expect(admin.getByText("Message unpinned")).toBeVisible()
  await expect(pins).toContainText("No pinned messages.")
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

  await expect(term).toBeFocused()

  for (const key of ["Tab", "Tab", "Shift+Tab"]) {
    await page.keyboard.press(key)
    expect(await search.evaluate(dialog => dialog.contains(document.activeElement))).toBe(true)
  }

  await term.focus()
  await term.fill("harbor")

  await expect(search.getByText("Last 24 Hours")).toBeVisible()
  await expect(search.getByText("Last 7 Days")).toBeVisible()
  await expect(search.getByText("Older")).toBeVisible()
  await expect(search).toContainText("harbor dredging starts monday")

  await term.fill("mizzenmast")

  await expect(page.getByText("No results found.")).toBeVisible()

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

// A push notification links near the newest end, so the jump lands at the bottom with nothing below.
test("US-027a a permalink near the newest end lands at the bottom", async ({seed, as}) => {
  let recent!: SeededEvent

  const scenario = await seed(({relay, user, at}) => {
    const space = relay("space")

    space.room("general", {name: "General"})
    space.join(user.alice, "general")
    space.join(user.bob, "general")

    for (let i = 0; i < 20; i++) {
      space.message(user.bob, "general", `harbor watch note ${i}`, at(40 - i, MINUTE))
    }

    recent = space.message(user.bob, "general", "the harbor pilot is booked", at(5, MINUTE))

    space.message(user.bob, "general", "and the tide is with us", at(2, MINUTE))
  })

  const {url} = scenario.space("space")
  const path = roomPath(url, "general")
  const page = await as(users.alice, `${path}?at=${recent.event.created_at}`)

  await expect(page.locator(`[data-event="${recent.id}"]`)).toBeInViewport()

  // The newest message in the room is on screen with it, so this is the live end
  await expect(message(page, "and the tide is with us")).toBeInViewport()
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
  expect(permalink.hash).toBe("")

  await picker.getByRole("button", {name: "Random"}).click()
  await picker.getByRole("button", {name: /^Share/}).click()

  await expect(alice).toHaveURL(pathPattern(roomPath(url, "random")))
  await expect(alice.locator(".room__compose")).toContainText("the dock is closed on sunday")

  await send(alice, "heads up")

  await expect(message(alice, "heads up")).toContainText("the dock is closed on sunday")
  await expect(message(bob, "heads up")).toContainText("the dock is closed on sunday")
})

test("US-119 have a message read out loud", async ({seed, as}) => {
  const scenario = await seed(({relay, user, at}) => {
    const space = relay("space")

    space.room("general", {name: "General"})
    space.join(user.alice, "general")
    space.join(user.bob, "general")
    space.profile(user.alice, {name: "Alice Anchor"})
    space.profile(user.bob, {name: "Bob Barnacle"})

    const notice = space.message(user.bob, "general", "the dock is closed on sunday", at(2, HOUR))

    space.reply(
      user.bob,
      notice,
      `heads up nostr:${npubEncode(user.alice.pubkey)}, the notice is at https://harbor.example/dock?ref=1`,
      at(1, HOUR),
    )

    seedChatter(space, user.alice)
  })

  const {url} = scenario.space("space")
  const alice = await as(users.alice, roomPath(url, "general"))
  // Long enough that playback is still going when the controls below are exercised.
  const spoken = await mockOpenRouterSpeech(alice.context(), 10)

  // The mention has to have resolved on screen before it can be expected in what was spoken.
  await expect(message(alice, "heads up")).toContainText("@Alice Anchor")

  // With no key saved, reading a message asks for one the way dictation does.
  await openMessageMenu(alice, "heads up")
  await alice.getByRole("button", {name: "Read Out Loud"}).click()

  const enable = dialog(alice, "Enable read out loud?")

  await enable.locator('input[name="flotilla-openrouter-key"]').fill("sk-or-test")
  await enable.getByRole("button", {name: "Enable read out loud"}).click()

  await expect(alice.getByRole("alert")).toContainText("Read out loud is ready to use!")

  await openMessageMenu(alice, "heads up")
  await alice.getByRole("button", {name: "Read Out Loud"}).click()

  await expect(alice.getByText("a message from Bob Barnacle")).toBeVisible()

  // The quote, the mention and the url are named rather than spelled out a character at a time.
  expect(spoken).toEqual([
    "another message\n\nheads up Alice Anchor, the notice is at a link to harbor.example",
  ])

  // The app decodes what it is answered and rebuilds the container around the samples.
  await expect(alice.getByText("/ 0:10")).toBeVisible()

  // The clip carries autoplay and the button follows the audio element's own play event.
  const playPause = alice.getByRole("button", {name: /^(Play|Pause) message$/})

  await expect(playPause).toHaveAttribute("aria-label", "Pause message")

  await playPause.click()

  await expect(playPause).toHaveAttribute("aria-label", "Play message")

  const seek = alice.getByRole("slider", {name: "Seek within the message"})

  await seek.fill("2")

  await expect(alice.getByText("0:02 /")).toBeVisible()

  await alice.getByRole("button", {name: "Stop reading"}).click()

  await expect(alice.getByText("a message from Bob Barnacle")).toHaveCount(0)
})

test("US-115 connect a wallet without losing the zap you were composing", async ({seed, as}) => {
  // Zapping only gets as far as a dialog once dufflepud answers with a zapper for that endpoint.
  const lud16 = "bob@zap.test"
  // A zapper's receipts are signed by the recipient's lightning provider, so it is an identity of its own.
  const provider = makeTestUser("zapper")

  const scenario = await seed(({relay, user}) => {
    const space = relay("space")

    space.room("general", {name: "General"})
    space.join(user.alice, "general")
    space.join(user.bob, "general")
    space.profile(user.alice, {name: "Alice Anchor"})
    space.event(user.bob, () =>
      space.kind(Profile).writer().update({name: "Bob Barnacle", lud16}).renderTemplate(),
    )
    space.message(user.bob, "general", "the new sail came in")
  })

  const {url} = scenario.space("space")
  const path = roomPath(url, "general")
  const page = await as(users.alice, path, {webln: {node: {alias: "Test Node"}}})

  // Registered after the page opened, so it answers ahead of the empty dufflepud `as()` installs.
  await mockDufflepud(page.context(), {
    zappers: [
      {
        lnurl: bech32ToHex(getLnUrl(lud16)!),
        info: {pubkey: users.bob.pubkey, nostrPubkey: provider.pubkey, allowsNostr: true},
      },
    ],
  })

  await page.goto(path)

  await expect(message(page, "the new sail came in")).toBeVisible()

  await messageActions(page, "the new sail came in").first().click()

  const zap = dialog(page, "Send a Zap")
  const amount = zap.locator('input[type="number"]')

  await expect(zap.getByRole("button", {name: "Create invoice"})).toBeVisible()

  await amount.fill("210")
  await zap.getByRole("button", {name: "Connect a lightning wallet"}).click()

  const connect = dialog(page, "Connect a Wallet")

  await expect(page.locator(".dialog-overlay[inert]")).toHaveCount(1)
  await connect.getByRole("button", {name: "Connect with WebLN"}).click()

  await expect(page.getByRole("alert")).toContainText("Wallet successfully connected!")
  await expect(connect).toHaveCount(0)

  // The zap dialog was underneath rather than replaced, so the amount she had typed survived.
  await expect(zap.getByRole("button", {name: "Connect a lightning wallet"})).toHaveCount(0)
  await expect(zap.getByRole("button", {name: "Send Zap"})).toBeVisible()
  await expect(amount).toHaveValue("210")
})

test("fills a room from a relay that never says it is done", async ({seed, as}) => {
  const scenario = await seed(({relay, user, at}) => {
    const space = relay("space")

    space.room("general", {name: "General"})
    space.join(user.alice, "general")
    space.join(user.bob, "general")
    space.message(user.bob, "general", "the buoy is back on station", at(3, HOUR))
  })

  const {url} = scenario.space("space")
  const page = await as(users.alice, roomPath(url, "general"), {eoseless: [url]})

  // Nothing will tell the feed its page is finished, so a room that waits for that stays empty.
  await expect(message(page, "the buoy is back on station")).toBeVisible()
})
