import {neventEncode, npubEncode} from "nostr-tools/nip19"
import {DAY, HOUR, MINUTE} from "@welshman/lib"
import {POLL, displayRelayUrl} from "@welshman/util"
import {RelayMessageType} from "@welshman/net"
import {Classified, Comment, FollowList, Note, Poll, Thread} from "@welshman/domain"
import type {Locator, Page} from "@playwright/test"
import {
  composer,
  dialog,
  expect,
  getTranscript,
  message,
  messageActions,
  openRoomDetail,
  pageBar,
  pathPattern,
  roomLink,
  roomPath,
  send,
  settingRow,
  spacePath,
  test,
  users,
} from "../harness"
import type {SeededEvent, SeededSpace, TestUser} from "../harness"

// The unread indicator, which every surface renders the same way: a small primary-colored dot in
// the corner of the thing it belongs to. RelaySummary's "you're a member" check is the same shape
// at h-5 w-5, so the size is part of what says which one this is.
const unreadDot = (scope: Locator) => scope.locator("div.h-2.w-2.rounded-full.bg-primary")

// The bell SpaceMenuRoomItem hangs off a muted room. An icon is a css mask built from a data url,
// so which bell it is can't be read out of the class list, but a room only renders one when it is
// muted.
const mutedRoomBell = (room: Locator) => room.locator("div.ml-auto.opacity-50")

// The bell SpaceMenuHeader puts beside the space's name once the space itself is muted. The only
// other absolutely-positioned dot in that button is the admin action-items one, which is opacity-0.
const mutedSpaceBell = (header: Locator) => header.locator("div.opacity-50")

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
  page.locator(".secondary-nav").getByRole("button", {name: pathPattern(displayRelayUrl(url))})

// The menu it opens closes itself on the next mouseup anywhere, and a click whose press and release
// land in the same instant can reach that listener as it mounts, shutting the menu again. A human's
// click has a gap between the two; playwright's has one only when it is asked for.
const openSpaceMenu = (menu: Locator) => menu.click({delay: 200})

// Every story here goes on to assert something that depends on the message having landed, so
// posting is only finished once it has rendered.
const post = async (page: Page, content: string) => {
  await send(page, content)
  await expect(message(page, content)).toBeVisible()
}

// RoomItem's hover actions are icons with no accessible names, in a fixed order: zap, emoji, reply,
// edit (only on your own recent message), menu.
const replyToMessage = (page: Page, text: string) => messageActions(page, text).nth(2).click()

// Chromium's own notifications are invisible to a test, and a tab playwright drives is never
// hidden, so both of the things the adapter reads are stubbed on the page. It takes the global at
// notify time, which is what lets this land after boot.
const captureNotifications = async (page: Page) => {
  const notifications: {title: string; body: string}[] = []

  await page.exposeFunction("onTestNotification", (title: string, body: string) => {
    notifications.push({title, body})
  })

  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {get: () => true})
    Object.defineProperty(document, "visibilityState", {get: () => "hidden"})

    window.Notification = class {
      static permission = "granted"

      constructor(title: string, options: NotificationOptions = {}) {
        const record = window as unknown as {
          onTestNotification: (title: string, body: string) => void
        }

        record.onTestNotification(title, options.body || "")
      }

      close() {}
    } as unknown as typeof Notification
  })

  return notifications
}

// The page bar names the room, so waiting for it is what says the composer below now belongs to
// the room that was just opened rather than to the one being torn down.
const postTo = async (page: Page, room: string, content: string) => {
  await roomLink(page, room).click()
  await expect(pageBar(page)).toContainText(room)
  await post(page, content)
}

// Outbox routing resolves everything about a person through their relay list: settings are
// published to the relays it names, and a gift wrap only reaches somebody who has said where their
// messages go.
const seedRelays = (space: SeededSpace, user: TestUser) => {
  space.relayList(user)
  space.messagingRelayList(user)
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

  await post(alice, "the server is on fire")

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

  await expect(alice).toHaveURL(pathPattern(roomPath(space.url, "general")))

  // Silence this one room from its detail panel. Mute is the stronger of the two settings there: it
  // forces the room's notifications off and hides its unread badges too.
  await openRoomDetail(alice)

  const roomMute = settingRow(alice, "Mute").getByRole("checkbox")

  await expect(roomMute).not.toBeChecked()

  await roomMute.check()
  await alice.getByRole("button", {name: "Go back"}).click()

  await expect(random).toBeVisible()
  await expect(mutedRoomBell(general)).toBeVisible()
  await expect(mutedRoomBell(random)).toHaveCount(0)

  // Step out of both rooms, so either one is free to raise a dot
  await alice.getByRole("link", {name: "Space Details"}).click()

  const bob = await as(users.bob, roomPath(space.url, "general"))

  await post(bob, "deploy is broken")
  await postTo(bob, "Random", "lunch?")

  // The sibling room's message raises a dot, the muted room's does not
  await expect(unreadDot(random)).toBeVisible()
  await expect(unreadDot(general)).toHaveCount(0)

  // The muted room's message did arrive, it just raised nothing
  await general.click()

  await expect(message(alice, "deploy is broken")).toBeVisible()

  // Turning the room back on restores its indicator for what comes next
  await openRoomDetail(alice)
  await roomMute.uncheck()
  await alice.getByRole("button", {name: "Go back"}).click()
  await alice.getByRole("link", {name: "Space Details"}).click()

  await expect(general).toBeVisible()
  await expect(mutedRoomBell(general)).toHaveCount(0)

  await postTo(bob, "General", "and now the build too")

  // Both rooms are now showing a dot, which is what the space-level setting is tested against
  await expect(unreadDot(general)).toBeVisible()
  await expect(unreadDot(random)).toBeVisible()

  const menu = spaceMenu(alice, space.url)

  await openSpaceMenu(menu)
  await alice.getByRole("button", {name: "Turn off notifications"}).click()

  // Silencing the space is about its alerts — hiding unread badges is the room mute's job — so the
  // bell appears beside its name and the dots the rooms are carrying stay up.
  await expect(mutedSpaceBell(menu)).toBeVisible()
  await expect(unreadDot(general)).toBeVisible()
  await expect(unreadDot(random)).toBeVisible()

  // Reopening the menu shows the label the mute flipped, and turning it back on clears the bell.
  // Clicking the header while the menu is still on its way out toggles it straight back shut, so
  // wait for it to go before reopening it.
  const turnOn = alice.getByRole("button", {name: "Turn on notifications"})

  await expect(turnOn).toHaveCount(0)

  await openSpaceMenu(menu)
  await expect(turnOn).toBeVisible()
  await turnOn.click()

  await expect(mutedSpaceBell(menu)).toHaveCount(0)
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

  await expect(platform).toHaveURL(pathPattern(spacePath(space.url)))

  // With none configured, /home is the dashboard, whose empty inbox offers two ways out
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

test("US-116 read the home dashboard", async ({seed, as}) => {
  const scenario = await seed(({relay, user, at}) => {
    const space = relay("space")

    space.room("general", {name: "General"})
    space.join(user.alice, "general")
    space.join(user.bob, "general")
    space.message(user.bob, "general", "the server is on fire", at(1, HOUR))

    space.event(
      user.bob,
      () =>
        space
          .kind(Thread)
          .writer()
          .setRoom(space.url, "general")
          .setTitle("Bed rotation")
          .setContent("How often do you move things around?")
          .renderTemplate(),
      at(2, HOUR),
    )
  })

  const space = scenario.space("space")
  const page = await as(users.alice, "/home")

  // Each conversation is one link, headed by its room and carrying the latest message underneath
  const conversation = page.getByRole("link").filter({hasText: "the server is on fire"})

  await expect(conversation).toBeVisible()
  await expect(conversation).toContainText("General")
  await expect(unreadDot(conversation)).toBeVisible()

  // A space's threads, events and classifieds are counted per space in Activity rather than listed
  // as conversations, so the inbox stays a list of messages
  const activity = page.getByRole("link").filter({hasText: "1 thread"})

  await expect(page.getByRole("heading", {name: "Activity"})).toBeVisible()
  await expect(activity).toBeVisible()
  await expect(conversation).not.toContainText("1 thread")

  // Relay health checks had no mount point at all before the dashboard
  await expect(page.getByText("Health checks")).toBeVisible()

  // Hosting shows even though alice hosts nothing, as an invitation to start a space
  await expect(page.getByRole("button", {name: "Start a space"})).toBeVisible()

  await expect(conversation).toHaveAttribute("href", roomPath(space.url, "general"))

  // The inbox is the badges, so a conversation leaves the list once it has nothing unread
  await page.getByRole("button", {name: "Mark all read"}).click()

  await expect(conversation).toHaveCount(0)
  await expect(activity).toHaveCount(0)
  await expect(page.getByText("You're all caught up")).toBeVisible()
})

test("US-117 read the network feed on home", async ({seed, as}) => {
  const note = "the tide charts are wrong again"
  const quiet = "the ferry is running on time"
  const reply = "they were reprinted last week"
  const topic = "Dredging the channel"

  await seed(({relay, user}) => {
    const space = relay("space")

    space.room("general", {name: "General"})
    space.join(user.alice, "general")
    space.join(user.bob, "general")

    // The feed asks each follow's write relays for their notes, so a note is only reachable
    // through a relay list naming one.
    seedRelays(space, user.alice)
    seedRelays(space, user.bob)

    space.event(user.alice, () =>
      space.kind(FollowList).writer().follow(user.bob.pubkey).renderTemplate(),
    )

    const posted = space.event(user.bob, () =>
      space.kind(Note).writer().setContent(note).renderTemplate(),
    )

    space.event(user.bob, () => space.kind(Note).writer().setContent(quiet).renderTemplate())

    space.event(user.bob, () =>
      space.kind(Note).writer().setParent(posted.event).setContent(reply).renderTemplate(),
    )

    space.event(user.bob, () =>
      space
        .kind(Thread)
        .writer()
        .setRoom(space.url, "general")
        .setTitle(topic)
        .setContent("The barges keep grounding.")
        .renderTemplate(),
    )
  })

  const page = await as(users.alice, "/home")

  const network = page
    .locator("section")
    .filter({has: page.getByRole("heading", {name: "Network"})})

  await expect(page.getByRole("heading", {name: "Network"})).toBeVisible()
  await expect(page.getByText(note)).toBeVisible()

  // The feed is notes only: a reply is counted on the note it answers rather than drawn
  // underneath it, and it never gets a card of its own.
  await expect(page.getByRole("button", {name: "1 reply", exact: true})).toBeVisible()
  await expect(page.getByText(reply)).toHaveCount(0)

  // The count is there whether or not anybody replied, so every post reads the same.
  await expect(page.getByText(quiet)).toBeVisible()
  await expect(
    network.locator(".card").filter({hasText: quiet}).getByRole("button", {name: "0 replies"}),
  ).toBeVisible()

  // The feed carries every kind of post a follow writes, not only their notes.
  await expect(network.getByText(topic)).toBeVisible()

  // Every card says when it was posted.
  await expect(network.getByRole("button", {name: /\d+\/\d+\/\d+/}).first()).toBeVisible()
})

test("US-117 read a follow who is in none of your spaces", async ({seed, as}) => {
  const note = "the lighthouse has been dark since tuesday"
  const answer = "the keeper is on holiday"

  const scenario = await seed(({relay, open, user, at}) => {
    const space = relay("space")
    const indexer = open("indexer")
    const outbox = open("outbox")

    space.room("general", {name: "General"})
    space.join(user.alice, "general")

    // Alice reads from her space and the indexer. Bob's relay is somewhere she writes and nowhere
    // she reads, which is enough for her client to identify to it -- zooid answers no REQ without
    // nip-42, and Flotilla only identifies to relays her own lists name -- while leaving it out of
    // the read urls a feed's context is asked of.
    indexer.relayList(user.alice, {
      read: [space.url, indexer.url],
      write: [space.url, indexer.url, outbox.url],
    })
    indexer.follows(user.alice, [user.bob])

    // Bob is in none of her spaces and writes nowhere she reads, so his relay list is the only
    // thing that can point the feed at his notes.
    indexer.relayList(user.bob, {read: [outbox.url], write: [outbox.url]})
    outbox.profile(user.bob, {name: "Bob Barker"})

    const posted = outbox.note(user.bob, note, at(30, MINUTE))

    outbox.event(
      user.bob,
      () => outbox.kind(Note).writer().setParent(posted.event).setContent(answer).renderTemplate(),
      at(20, MINUTE),
    )
  })

  const space = scenario.space("space")
  const page = await as(users.alice, "/home")

  const network = page
    .locator("section")
    .filter({has: page.getByRole("heading", {name: "Network"})})

  await expect(network.getByText(note)).toBeVisible()
  await expect(network.getByText("Bob Barker")).toBeVisible()

  // The reply is on bob's relay too, and alice reads from her space rather than from that relay,
  // so a context asked of her own read relays comes back with nothing.
  await expect(network.getByRole("button", {name: "1 reply", exact: true})).toBeVisible()

  // Her space never held any of it.
  const fromSpace = getTranscript(page.context()).filter(
    ({url, direction, message}) =>
      url === space.url &&
      direction === "toClient" &&
      message[0] === RelayMessageType.Event &&
      [note, answer].includes(message[2].content),
  )

  expect(fromSpace).toEqual([])
})

test("US-117 read the network feed when one relay never answers", async ({seed, as}) => {
  // Nothing serves this url, and nothing needs to: the fault is a relay that takes the socket and
  // then says nothing, which is all the spec asks of it.
  const stalled = "wss://stalled.test/"
  const note = "the drawbridge has been stuck open since noon"

  await seed(({relay, open, user, at}) => {
    const space = relay("space")
    const indexer = open("indexer")
    const outbox = open("outbox")

    space.room("general", {name: "General"})
    space.join(user.alice, "general")

    // The relays the feed will ask are somewhere she writes and nowhere she reads, which is what
    // lets her client identify to them: zooid answers no REQ without nip-42, and Flotilla only
    // identifies to relays her own lists name.
    indexer.relayList(user.alice, {
      read: [space.url, indexer.url],
      write: [space.url, indexer.url, outbox.url, stalled],
    })
    indexer.follows(user.alice, [user.bob])

    // Bob writes to both, so the feed asks both, and one of them is never going to answer.
    indexer.relayList(user.bob, {read: [outbox.url], write: [outbox.url, stalled]})
    outbox.profile(user.bob, {name: "Bob Barker"})
    outbox.note(user.bob, note, at(30, MINUTE))
  })

  const page = await as(users.alice, "/home", {silent: [stalled]})

  const network = page
    .locator("section")
    .filter({has: page.getByRole("heading", {name: "Network"})})

  // A span releases the events it found once it is done waiting, so a span that waits on every
  // relay it asked is a span one silent relay holds empty.
  await expect(network.getByText(note)).toBeVisible({timeout: 20_000})
  await expect(network.getByText("Bob Barker")).toBeVisible()
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

  await expect(page).toHaveURL(pathPattern(roomPath(space.url, "general")))
  await expect(composer(page)).toHaveText(shared)
})

test("US-107 open a nostr link", async ({seed, as}) => {
  let posted!: SeededEvent

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

  await expect(page).toHaveURL(pathPattern(roomPath(space.url, "general") + "?at="))
  await expect(message(page, "the meeting moved to friday")).toBeVisible()

  // A person's npub resolves the same way
  const npub = npubEncode(users.bob.pubkey)

  await page.goto(`/${npub}`)

  await expect(page).toHaveURL(pathPattern(`/people/${npub}`))
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

  await post(inOther, "the server is on fire")

  await expect(unreadDot(menuButton)).toBeVisible()

  // Meanwhile the space bob is sitting in gets a message too, in a room he isn't reading
  const inSpace = await as(users.alice, roomPath(space.url, "random"))

  await post(inSpace, "anyone seen the sextant?")

  await bob.goto(roomPath(other.url, "general"))

  await expect(message(bob, "the server is on fire")).toBeVisible()

  // Reading the other space empties the bar, even though bob's own space still has an unread room
  // — that one is the space's business, and its own indicators carry it
  await bob.goto(spacePath(space.url))

  await expect(unreadDot(roomLink(bob, "Random"))).toBeVisible()
  await expect(unreadDot(menuButton)).toHaveCount(0)
})

// SpaceMenuNavItems offers a content type once the space has an event of that kind or something
// under it is unread, so this link appearing at all is what says the seeded content loaded.
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

  await expect(pageBar(bob)).toContainText("the server is on fire")

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

  // ThreadBoard swaps its table for a list of links when the board is too narrow for the table,
  // and the two branches render the thread separately, so a dot on one says nothing about the
  // other.
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

const seedPoll = (space: SeededSpace, user: TestUser, title: string, createdAt: number) =>
  space.event(
    user,
    () =>
      space
        .kind(Poll)
        .writer()
        .setTitle(title)
        .setPollType("singlechoice")
        .addOption("Yes", "poll-yes")
        .addOption("No", "poll-no")
        .setUrls([space.url])
        .renderTemplate(),
    createdAt,
  )

test("US-123 find a section whose newest item is older than the sync window", async ({
  seed,
  as,
}) => {
  const scenario = await seed(({relay, user, at}) => {
    const space = relay("space")

    space.room("general", {name: "General"})
    space.join(user.alice, "general")
    space.join(user.bob, "general")

    // Older than the month the space sync asks for, so the nav can only know about it by asking
    // the relay what the space holds rather than by reading what has loaded.
    seedPoll(space, user.alice, "which sextant should we buy", at(60, DAY))
  })

  const space = scenario.space("space")
  const bob = await as(users.bob, roomPath(space.url, "general"))

  const pollsNav = contentNavItem(bob, "Polls")

  await expect(pollsNav).toBeVisible()

  await pollsNav.click()

  await expect(bob.getByText("which sextant should we buy")).toBeVisible()
})

test("US-124 reach a badge raised by content the space doesn't have", async ({seed, as}) => {
  const scenario = await seed(({relay, user, at}) => {
    const space = relay("space")
    const other = relay("other")

    space.room("general", {name: "General"})
    other.room("general", {name: "General"})
    space.join(user.alice, "general")
    space.join(user.bob, "general")
    other.join(user.bob, "general")

    // A comment on a poll nothing holds — the relay kept the comment and dropped its subject.
    // It counts toward the space either way, so the section it belongs to has to be reachable.
    space.event(
      user.alice,
      () =>
        space
          .kind(Comment)
          .writer()
          .setRoot(POLL, "f".repeat(64), users.alice.pubkey)
          .setContent("the second option, surely")
          .renderTemplate(),
      at(2, HOUR),
    )
  })

  const space = scenario.space("space")
  const other = scenario.space("other")

  // A space hides its own dot while you are in it, so the badge is only readable from elsewhere
  const bob = await as(users.bob, roomPath(other.url, "general"))
  const spaceButton = spaceNavItem(bob, space.name)

  await expect(unreadDot(spaceButton)).toBeVisible()

  await spaceButton.click()

  const pollsNav = contentNavItem(bob, "Polls")

  await expect(pollsNav).toBeVisible()
  await expect(unreadDot(pollsNav)).toBeVisible()

  await pollsNav.click()

  await expect(bob.getByText("No polls found.")).toBeVisible()

  // Reading it is the end of it: with nothing unread and no poll to list, the space stops
  // offering the section at all
  await roomLink(bob, "General").click()

  await expect(pollsNav).toHaveCount(0)
})

test("US-120 read what a notification says", async ({seed, as}) => {
  const scenario = await seed(({relay, user, at}) => {
    const space = relay("space")

    space.room("general", {name: "General"})
    space.join(user.alice, "general")
    space.join(user.bob, "general")
    space.profile(user.alice, {name: "Alice Anchor"})
    space.profile(user.bob, {name: "Bob Barnacle"})
    space.message(user.alice, "general", "when does the dock close?", at(2, HOUR))
  })

  const space = scenario.space("space")

  // Push notifications are off until they are asked for, and the tab has to be in the background
  // before one is raised at all.
  const alice = await as(users.alice, "/settings/alerts", {
    context: {permissions: ["notifications"]},
  })

  await settingRow(alice, "Enable push notifications").getByRole("checkbox").check()
  await alice.getByRole("button", {name: "Save Changes"}).click()

  await expect(alice.getByRole("alert")).toContainText("Your settings have been saved!")

  await spaceNavItem(alice, space.name).click()
  await roomLink(alice, "General").click()

  await expect(alice).toHaveURL(pathPattern(roomPath(space.url, "general")))
  await expect(message(alice, "when does the dock close?")).toBeVisible()

  const notifications = await captureNotifications(alice)

  const bob = await as(users.bob, roomPath(space.url, "general"))

  await replyToMessage(bob, "when does the dock close?")
  await composer(bob).pressSequentially("sunday, the notice is at https://harbor.example/dock")
  await composer(bob).press("Enter")

  await expect(message(bob, "sunday, the notice is at")).toBeVisible()

  // A reply prepends the message it answers, so its first line is an entity and says nothing about
  // the reply. The preview is the words bob wrote, with the url named by its host rather than
  // spelled out, and the quote of alice's message tags her, so it reads as a mention.
  await expect
    .poll(() => notifications.at(-1))
    .toEqual({
      title: "Someone mentioned you",
      body: "sunday, the notice is at a link to harbor.example",
    })
})
