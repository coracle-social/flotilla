import {neventEncode, npubEncode} from "nostr-tools/nip19"
import {HOUR, MINUTE} from "@welshman/lib"
import {displayRelayUrl} from "@welshman/util"
import {Classified, MessagingRelayList, RelayList, Thread} from "@welshman/domain"
import type {Locator, Page} from "@playwright/test"
import {expect, roomPath, spacePath, test, users} from "../harness"
import type {SeededSpace, TestUser} from "../harness"

// A handle to a seeded event. SeededEvent isn't exported from the harness, and only its id is ever
// read back here.
type Seeded = {readonly id: string}

// A literal as a pattern, for a url that carries a query string alongside the path being matched,
// or a host whose dots would otherwise be wildcards.
const pattern = (literal: string) => new RegExp(literal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))

// The unread indicator, which every surface renders the same way: a small primary-colored dot in
// the corner of the thing it belongs to. RelaySummary's "you're a member" check is the same shape
// at h-5 w-5, so the size is part of what says which one this is.
const unreadDot = (scope: Locator) => scope.locator("div.h-2.w-2.rounded-full.bg-primary")

// The bell SpaceMenuRoomItem hangs off a room whose notification setting differs from its space's.
// An icon is a css mask built from a data url, so which bell it is can't be read out of the class
// list — but it only renders on a difference, and while the space itself is still notifying the
// only difference a room can have is a mute.
const mutedRoomBell = (room: Locator) => room.locator("div.ml-auto.opacity-50")

// The bell SpaceMenuHeader puts beside the space's name once the space itself is muted. The only
// other absolutely-positioned dot in that button is the admin action-items one, which is opacity-0.
const mutedSpaceBell = (header: Locator) => header.locator("div.opacity-50")

// FieldInline, RoomDetail and EventInfo all lay a labelled control out as a single row, with the
// label at one end and the control at the other.
const settingRow = (page: Page, label: string) =>
  page.locator("div.items-center.justify-between").filter({hasText: label})

// PrimaryNavItemSpace carries the relay's name as a tooltip rather than as an accessible name — its
// icon is a masked svg with no alt text — and it has an onclick, so PrimaryNavItem renders it as a
// button rather than a link. The name comes from nip-11; until that document lands the tooltip is
// the relay's host instead, and each tenant's toml names it after itself, so both start the same.
const spaceNavItem = (page: Page, name: string) =>
  page.locator(`.primary-nav [data-tip^="${name}"]`)

// The phone's bottom bar opens the space menu in a drawer; the desktop rail has no equivalent,
// since the menu is always on screen there.
const spaceMenuNavItem = (page: Page) => page.getByRole("button", {name: "Open space menu"})

// The space menu's header, the one button in the secondary nav carrying the relay's address.
const spaceMenu = (page: Page, url: string) =>
  page.locator(".secondary-nav").getByRole("button", {name: pattern(displayRelayUrl(url))})

const roomLink = (page: Page, name: string) =>
  page.locator(".space-menu__scroll").getByRole("link", {name})

// The room's page bar carries a search button and the detail button, in that order.
const openRoomDetail = (page: Page) =>
  page.locator('[data-component="PageBar"]').getByRole("button").last().click()

// `.dialog` is on both the backdrop wrapper and the panel inside it, so the last match is the panel.
const dialog = (page: Page, title: string) =>
  page
    .locator(".dialog")
    .filter({has: page.getByRole("heading", {name: title, exact: true})})
    .last()

const composer = (page: Page) => page.locator(".chat-editor [contenteditable=true]")

const message = (page: Page, text: string) => page.locator(".room__item").filter({hasText: text})

const send = async (page: Page, content: string) => {
  await composer(page).pressSequentially(content)
  await composer(page).press("Enter")
  await expect(message(page, content)).toBeVisible()
}

// The page bar names the room, so waiting for it is what says the composer below now belongs to
// the room that was just opened rather than to the one being torn down.
const postTo = async (page: Page, room: string, content: string) => {
  await roomLink(page, room).click()
  await expect(page.locator('[data-component="PageBar"]')).toContainText(room)
  await send(page, content)
}

// Outbox routing resolves everything about a person through their relay list: settings are
// published to the relays it names, and a gift wrap only reaches somebody who has said where their
// messages go.
const seedRelays = (space: SeededSpace, user: TestUser) => {
  space.event(user, () =>
    space
      .kind(RelayList)
      .writer()
      .setReadUrls([space.url])
      .setWriteUrls([space.url])
      .renderTemplate(),
  )
  space.event(user, () =>
    space.kind(MessagingRelayList).writer().setUrls([space.url]).renderTemplate(),
  )
}

test("US-103 see and clear unread indicators", async ({seed, as}) => {
  const scenario = await seed(({relay, user, at}) => {
    const space = relay("space")

    space.room("general", {name: "General"})
    space.room("random", {name: "Random"})
    space.join(user.alice, "general", "random")
    space.join(user.bob, "general", "random")

    // History bob wrote himself, so the space has something in it while nothing in it is unread
    // for him — his own messages never raise an indicator.
    space.message(user.bob, "general", "anyone around?", at(2, HOUR))
  })

  const space = scenario.space("space")
  const bob = await as(users.bob, "/spaces")
  const alice = await as(users.alice, roomPath(space.url, "general"))

  const spaceRow = bob.getByRole("listitem").filter({hasText: space.url})
  const navItem = spaceNavItem(bob, space.name)

  await expect(spaceRow).toBeVisible()
  await expect(navItem).toBeVisible()
  await expect(unreadDot(spaceRow)).toHaveCount(0)
  await expect(unreadDot(navItem)).toHaveCount(0)

  await send(alice, "the server is on fire")

  // Bob is sitting on the space list the whole time, so both dots arrive without a navigation
  await expect(unreadDot(spaceRow)).toBeVisible()
  await expect(unreadDot(navItem)).toBeVisible()

  // Inside the space, the dot points at the room the message landed in. A space's room list only
  // exists in its own menu, so this is the one indicator the list above can't show.
  await spaceRow.click()

  const general = roomLink(bob, "General")
  const random = roomLink(bob, "Random")

  // Both rooms are on screen first, so a room with no dot is a room raising none rather than a
  // row that never rendered
  await expect(random).toBeVisible()
  await expect(unreadDot(general)).toBeVisible()
  await expect(unreadDot(random)).toHaveCount(0)

  await general.click()

  await expect(message(bob, "the server is on fire")).toBeVisible()

  // Reading it clears the room's dot...
  await bob.getByRole("link", {name: "Space Details"}).click()

  await expect(general).toBeVisible()
  await expect(unreadDot(general)).toHaveCount(0)

  // ...and it stays cleared back on the space list he started from
  await bob.locator('.primary-nav a[href="/spaces"]').click()

  await expect(spaceRow).toBeVisible()
  await expect(unreadDot(spaceRow)).toHaveCount(0)
  await expect(unreadDot(navItem)).toHaveCount(0)
})

test("US-104 mute a room or a whole space", async ({seed, as}) => {
  const scenario = await seed(({relay, user}) => {
    const space = relay("space")

    space.room("general", {name: "General"})
    space.room("random", {name: "Random"})
    space.join(user.alice, "general", "random")
    space.join(user.bob, "general", "random")

    seedRelays(space, user.alice)
  })

  const space = scenario.space("space")

  // Silencing a whole space is only offered once push notifications are on, so that is where alice
  // has to start.
  const alice = await as(users.alice, "/settings/alerts", {
    context: {permissions: ["notifications"]},
  })

  await settingRow(alice, "Enable push notifications").getByRole("checkbox").check()
  await alice.getByRole("button", {name: "Save Changes"}).click()

  await expect(alice.getByRole("alert")).toContainText("Your settings have been saved!")

  await spaceNavItem(alice, space.name).click()

  const general = roomLink(alice, "General")
  const random = roomLink(alice, "Random")

  await general.click()

  await expect(alice).toHaveURL(pattern(roomPath(space.url, "general")))

  // Silence this one room from its detail panel
  await openRoomDetail(alice)

  const roomNotifications = settingRow(alice, "Notifications").getByRole("checkbox")

  await expect(roomNotifications).toBeChecked()

  await roomNotifications.uncheck()
  await alice.getByRole("button", {name: "Go back"}).click()

  await expect(random).toBeVisible()
  await expect(mutedRoomBell(general)).toBeVisible()
  await expect(mutedRoomBell(random)).toHaveCount(0)

  // Step out of both rooms, so either one is free to raise a dot
  await alice.getByRole("link", {name: "Space Details"}).click()

  const bob = await as(users.bob, roomPath(space.url, "general"))

  await send(bob, "deploy is broken")
  await postTo(bob, "Random", "lunch?")

  // The sibling room's message raises a dot, the muted room's does not
  await expect(unreadDot(random)).toBeVisible()
  await expect(unreadDot(general)).toHaveCount(0)

  // The muted room's message did arrive, it just raised nothing
  await general.click()

  await expect(message(alice, "deploy is broken")).toBeVisible()

  // Turning the room back on restores its indicator for what comes next
  await openRoomDetail(alice)
  await roomNotifications.check()
  await alice.getByRole("button", {name: "Go back"}).click()
  await alice.getByRole("link", {name: "Space Details"}).click()

  await expect(general).toBeVisible()
  await expect(mutedRoomBell(general)).toHaveCount(0)

  await postTo(bob, "General", "and now the build too")

  // Both rooms are now showing a dot, so silencing the space is what takes them down
  await expect(unreadDot(general)).toBeVisible()
  await expect(unreadDot(random)).toBeVisible()

  const menu = spaceMenu(alice, space.url)

  await menu.click()
  await alice.getByRole("button", {name: "Turn off notifications"}).click()

  await expect(mutedSpaceBell(menu)).toBeVisible()
  await expect(unreadDot(general)).toHaveCount(0)
  await expect(unreadDot(random)).toHaveCount(0)

  await postTo(bob, "General", "still broken")
  await postTo(bob, "Random", "still hungry")

  await expect(unreadDot(general)).toHaveCount(0)
  await expect(unreadDot(random)).toHaveCount(0)

  // Reopening the menu shows the label the mute flipped, and turning it back on brings the
  // indicators back — which is also what proves those messages reached alice at all
  await menu.click()

  const turnOn = alice.getByRole("button", {name: "Turn on notifications"})

  await expect(turnOn).toBeVisible()
  await turnOn.click()

  await expect(mutedSpaceBell(menu)).toHaveCount(0)
  await expect(unreadDot(general)).toBeVisible()
  await expect(unreadDot(random)).toBeVisible()
})

test("US-105 land on the home page", async ({seed, as}) => {
  const scenario = await seed(({relay, user}) => {
    const space = relay("space")

    space.room("general", {name: "General"})
    space.join(user.alice, "general")
  })

  const space = scenario.space("space")

  // A build that names a platform space sends /home straight into it
  const platform = await as(users.alice, "/home", {env: {VITE_PLATFORM_RELAYS: space.url}})

  await expect(platform).toHaveURL(pattern(spacePath(space.url)))

  // With none configured, /home is a welcome screen with two ways out
  const page = await as(users.alice, "/home")

  const addSpace = page.getByRole("link", {name: "Add a space"})
  const startConversation = page.getByRole("button", {name: "Start a conversation"})

  await expect(addSpace).toBeVisible()
  await expect(startConversation).toBeVisible()

  await addSpace.click()

  await expect(page).toHaveURL(/\/spaces$/)

  await page.goBack()

  await expect(page).toHaveURL(/\/home$/)

  await startConversation.click()

  await expect(page).toHaveURL(/\/chat$/)
})

test("US-106 share text into the app", async ({seed, as}) => {
  const shared = "the offsite is moving to the 14th"

  const scenario = await seed(({relay, user, at}) => {
    const space = relay("space")

    space.room("general", {name: "General"})
    space.room("watercooler", {name: "Watercooler"})
    space.join(user.alice, "general", "watercooler")
    space.join(user.bob, "general", "watercooler")
    space.profile(user.bob, {name: "Bob Barker"})

    seedRelays(space, user.alice)
    seedRelays(space, user.bob)

    space.dm(user.bob, [user.alice], "are you around?", at(20, MINUTE))
  })

  const space = scenario.space("space")

  // A client only unwraps direct messages once its owner has opened chat, so a conversation the
  // share dialog can offer is one alice has already seen.
  const page = await as(users.alice, "/chat")

  await expect(page.getByText("are you around?").first()).toBeVisible()

  // The text arrives in the query string rather than through a native share intent, which is the
  // same thing src/routes/share reads either way.
  await page.goto(`/share?text=${encodeURIComponent(shared)}`)

  const share = dialog(page, "Share")

  await expect(page.getByText("Where would you like to share this?")).toBeVisible()
  await expect(share.getByRole("button", {name: "General"})).toBeVisible()
  await expect(share.getByRole("button", {name: "Watercooler"})).toBeVisible()
  await expect(share.getByRole("button", {name: "Bob Barker"})).toBeVisible()

  const search = page.getByPlaceholder("Search rooms and conversations...")

  await search.fill("Watercooler")

  await expect(share.getByRole("button", {name: "Watercooler"})).toBeVisible()
  await expect(share.getByRole("button", {name: "General"})).toHaveCount(0)
  await expect(share.getByRole("button", {name: "Bob Barker"})).toHaveCount(0)

  await search.fill("")
  await share.getByRole("button", {name: "General"}).click()
  await share.getByRole("button", {name: "Share", exact: true}).click()

  await expect(page).toHaveURL(pattern(roomPath(space.url, "general")))
  await expect(composer(page)).toHaveText(shared)
})

test("US-107 open a nostr link", async ({seed, as}) => {
  let posted!: Seeded

  const scenario = await seed(({relay, user, at}) => {
    const space = relay("space")

    space.room("general", {name: "General"})
    space.join(user.alice, "general")
    space.join(user.bob, "general")
    space.profile(user.bob, {name: "Bob Barker"})

    seedRelays(space, user.bob)

    posted = space.message(user.bob, "general", "the meeting moved to friday", at(20, MINUTE))
  })

  const space = scenario.space("space")
  const page = await as(users.alice, roomPath(space.url, "general"), {
    context: {permissions: ["clipboard-read", "clipboard-write"]},
  })

  const item = page.locator(`[data-event="${posted.id}"]`)

  await expect(item).toBeVisible()
  await item.hover()
  await item.locator(".room__item-actions button").last().click()
  await page.getByRole("button", {name: "Message Details"}).click()

  await expect(page.getByRole("heading", {name: "Event Details"})).toBeVisible()

  // EventInfo renders the link on mount rather than during setup, so wait for it rather than
  // copying an empty field
  const eventLink = settingRow(page, "Event Link")

  await expect(eventLink.getByRole("textbox")).toHaveValue(/^nostr:nevent1/)
  await eventLink.getByRole("button").click()

  await expect(page.getByRole("alert")).toContainText("Copied to clipboard!")

  const link = await page.evaluate(() => navigator.clipboard.readText())

  expect(link).toMatch(/^nostr:nevent1/)

  await page.goto("/" + link.replace(/^nostr:/, ""))

  await expect(page).toHaveURL(pattern(roomPath(space.url, "general") + "?at="))
  await expect(message(page, "the meeting moved to friday")).toBeVisible()

  // A person's npub resolves the same way
  const npub = npubEncode(users.bob.pubkey)

  await page.goto(`/${npub}`)

  await expect(page).toHaveURL(pattern(`/people/${npub}`))
  await expect(page.getByRole("heading", {name: "Bob Barker"})).toBeVisible()

  // Nothing holds this event, so the link falls back to the app's home rather than a dead page
  await page.goto(`/${neventEncode({id: "f".repeat(64), relays: [space.url]})}`)

  await expect(page).toHaveURL(/\/home$/)
})

test("US-110 see another space's unread activity from a phone", async ({seed, as}) => {
  const scenario = await seed(({relay, user}) => {
    const space = relay("space")
    const other = relay("other")

    space.room("general", {name: "General"})
    space.room("random", {name: "Random"})
    other.room("general", {name: "General"})

    space.join(user.alice, "general", "random")
    space.join(user.bob, "general", "random")
    other.join(user.alice, "general")
    other.join(user.bob, "general")
  })

  const space = scenario.space("space")
  const other = scenario.space("other")

  // A phone has no room list on screen while a room is open, so the bottom bar is the only place
  // activity elsewhere can surface
  const bob = await as(users.bob, roomPath(space.url, "general"), {
    context: {viewport: {width: 390, height: 844}, hasTouch: true},
  })

  const menuButton = spaceMenuNavItem(bob)

  await expect(menuButton).toBeVisible()
  await expect(unreadDot(menuButton)).toHaveCount(0)

  const inOther = await as(users.alice, roomPath(other.url, "general"))

  await send(inOther, "the server is on fire")

  await expect(unreadDot(menuButton)).toBeVisible()

  // Meanwhile the space bob is sitting in gets a message too, in a room he isn't reading
  const inSpace = await as(users.alice, roomPath(space.url, "random"))

  await send(inSpace, "anyone seen the sextant?")

  await bob.goto(roomPath(other.url, "general"))

  await expect(message(bob, "the server is on fire")).toBeVisible()

  // Reading the other space empties the bar, even though bob's own space still has an unread room
  // — that one is the space's business, and its own indicators carry it
  await bob.goto(spacePath(space.url))

  await expect(unreadDot(roomLink(bob, "Random"))).toBeVisible()
  await expect(unreadDot(menuButton)).toHaveCount(0)
})

// SpaceMenuNavItems hides a content type until the space has an event of that kind, so this link
// appearing at all is what says the seeded threads loaded.
const contentNavItem = (page: Page, name: string) =>
  page.locator(".secondary-nav").getByRole("link", {name})

const seedClassified = (space: SeededSpace, user: TestUser, title: string, createdAt: number) =>
  space.event(
    user,
    () =>
      space
        .kind(Classified)
        .writer()
        .setRoom(space.url, "general")
        .setIdentifier()
        .setTitle(title)
        .setPrice(100)
        .setContent("in good condition")
        .renderTemplate(),
    createdAt,
  )

const seedThread = (space: SeededSpace, user: TestUser, title: string, createdAt: number) =>
  space.event(
    user,
    () =>
      space
        .kind(Thread)
        .writer()
        .setRoom(space.url, "general")
        .setTitle(title)
        .setContent("worth talking about")
        .renderTemplate(),
    createdAt,
  )

test("US-112 see which threads are unread", async ({seed, as}) => {
  const scenario = await seed(({relay, user, at}) => {
    const space = relay("space")

    space.room("general", {name: "General"})
    space.join(user.alice, "general")
    space.join(user.bob, "general")

    // A thread bob wrote raises no indicator of its own, so it is the control for a row with no dot
    seedThread(space, user.bob, "where is the sextant", at(3, HOUR))
    seedThread(space, user.alice, "the server is on fire", at(2, HOUR))
  })

  const space = scenario.space("space")
  const bob = await as(users.bob, roomPath(space.url, "general"))

  const threadsNav = contentNavItem(bob, "Threads")

  await expect(threadsNav).toBeVisible()
  await expect(unreadDot(threadsNav)).toBeVisible()

  await threadsNav.click()

  const hers = bob.getByRole("row").filter({hasText: "the server is on fire"})
  const his = bob.getByRole("row").filter({hasText: "where is the sextant"})

  await expect(his).toBeVisible()

  // syncChecked marks the landed-on page read 300ms later and latestActivityByPath is throttled to
  // a second, so a dot the list is about to clear stays up well past the click. Nothing on screen
  // reports the tick — the nav dot goes down on the route change either way — so wait it out.
  await bob.waitForTimeout(1500)

  await expect(unreadDot(hers)).toBeVisible()
  await expect(unreadDot(his)).toHaveCount(0)

  await hers.click()

  await expect(bob.locator('[data-component="PageBar"]')).toContainText("the server is on fire")

  // Leaving the list is what marks its threads read, so the dot is gone on the way back
  await bob.goBack()

  await expect(hers).toBeVisible()
  await expect(unreadDot(hers)).toHaveCount(0)

  await roomLink(bob, "General").click()

  await expect(threadsNav).toBeVisible()
  await expect(unreadDot(threadsNav)).toHaveCount(0)
})

test("US-113 see which threads are unread on a phone", async ({seed, as}) => {
  const scenario = await seed(({relay, user, at}) => {
    const space = relay("space")

    space.room("general", {name: "General"})
    space.join(user.alice, "general")
    space.join(user.bob, "general")

    seedThread(space, user.bob, "where is the sextant", at(3, HOUR))
    seedThread(space, user.alice, "the server is on fire", at(2, HOUR))
  })

  const space = scenario.space("space")

  // ThreadBoard swaps its table for a list of links below tailwind's md breakpoint, and the two
  // branches render the thread separately, so a dot on one says nothing about the other.
  const bob = await as(users.bob, `${spacePath(space.url)}/threads`, {
    context: {viewport: {width: 390, height: 844}, hasTouch: true},
  })

  const hers = bob.getByRole("link").filter({hasText: "the server is on fire"})
  const his = bob.getByRole("link").filter({hasText: "where is the sextant"})

  await expect(his).toBeVisible()

  // Same tick and throttle as US-112: a dot read before both have run is one the list may still be
  // about to clear.
  await bob.waitForTimeout(1500)

  await expect(unreadDot(hers)).toBeVisible()
  await expect(unreadDot(his)).toHaveCount(0)
})

// Classifieds stands in for the five boards whose items are cards rather than rows — they all
// render the same UnreadDot off the same content path, and only the corner it sits in differs.
test("US-114 see which listings are unread", async ({seed, as}) => {
  const scenario = await seed(({relay, user, at}) => {
    const space = relay("space")

    space.room("general", {name: "General"})
    space.join(user.alice, "general")
    space.join(user.bob, "general")

    seedClassified(space, user.bob, "vintage sextant", at(3, HOUR))
    seedClassified(space, user.alice, "brass astrolabe", at(2, HOUR))
  })

  const space = scenario.space("space")
  const bob = await as(users.bob, roomPath(space.url, "general"))

  const classifiedsNav = contentNavItem(bob, "Classifieds")

  await expect(classifiedsNav).toBeVisible()
  await expect(unreadDot(classifiedsNav)).toBeVisible()

  await classifiedsNav.click()

  const hers = bob.getByRole("link").filter({hasText: "brass astrolabe"})
  const his = bob.getByRole("link").filter({hasText: "vintage sextant"})

  await expect(his).toBeVisible()

  // Same tick and throttle as US-112.
  await bob.waitForTimeout(1500)

  await expect(unreadDot(hers)).toBeVisible()
  await expect(unreadDot(his)).toHaveCount(0)
})
