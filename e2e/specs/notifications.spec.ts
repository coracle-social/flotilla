import {neventEncode, npubEncode} from "nostr-tools/nip19"
import {DAY, HOUR, MINUTE} from "@welshman/lib"
import {POLL, displayRelayUrl} from "@welshman/util"
import {Comment, FollowList, Note, Poll, SearchRelayList, Thread} from "@welshman/domain"
import type {Locator, Page} from "@playwright/test"
import {
  composer,
  dialog,
  expect,
  message,
  messageActions,
  modalForm,
  noteEditor,
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

// A small primary-colored dot in the corner. RelaySummary's member check is the same shape at h-5 w-5.
const unreadDot = (scope: Locator) => scope.locator("div.h-2.w-2.rounded-full.bg-primary")

// An icon is a css mask built from a data url, so a room only renders this one when it is muted.
const mutedRoomBell = (room: Locator) => room.locator("div.ml-auto.opacity-50")

// The only other absolutely-positioned dot in that button is the admin action-items one, at opacity-0.
const mutedSpaceBell = (header: Locator) => header.locator("div.opacity-50")

// The name comes from nip-11; until that document lands the tooltip is the relay's host instead.
const spaceNavItem = (page: Page, name: string) =>
  page.locator(`.primary-nav [data-tip^="${name}"]`)

// The desktop rail has no equivalent, since the menu is always on screen there.
const spaceMenuNavItem = (page: Page) => page.getByRole("button", {name: "Open space menu"})

// The space menu's header, the one button in the secondary nav carrying the relay's address.
const spaceMenu = (page: Page, url: string) =>
  page.locator(".secondary-nav").getByRole("button", {name: pathPattern(displayRelayUrl(url))})

// The menu closes on the next mouseup, which a click with no gap between press and release reaches.
const openSpaceMenu = (menu: Locator) => menu.click({delay: 200})

// Every story here depends on the message having landed, so posting is finished once it renders.
const post = async (page: Page, content: string) => {
  await send(page, content)
  await expect(message(page, content)).toBeVisible()
}

// RoomItem's hover actions are icons with no accessible names, in a fixed order: zap, emoji, reply, edit, menu.
const replyToMessage = (page: Page, text: string) => messageActions(page, text).nth(2).click()

// Chromium's own notifications are invisible to a test, and a tab playwright drives is never hidden.
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

// The page bar names the room, so waiting for it says the composer belongs to the room just opened.
const postTo = async (page: Page, room: string, content: string) => {
  await roomLink(page, room).click()
  await expect(pageBar(page)).toContainText(room)
  await post(page, content)
}

// Settings are published to the relays a person's list names, and a gift wrap needs one too.
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

    // History bob wrote himself, since his own messages never raise an indicator.
    space.message(user.bob, "general", "anyone around?", at(2, HOUR))
  })

  const space = scenario.space("space")
  const bob = await as(users.bob, "/spaces")
  const alice = await as(users.alice, roomPath(space.url, "general"))

  const navItem = spaceNavItem(bob, space.name)

  await expect(navItem).toBeVisible()
  await expect(unreadDot(navItem)).toHaveCount(0)

  await post(alice, "the server is on fire")

  // Bob is sitting on the spaces page the whole time, so the dot arrives without a navigation
  await expect(unreadDot(navItem)).toBeVisible()

  // A space's room list only exists in its own menu, so this is the one indicator the rail can't show.
  await navItem.click()

  const general = roomLink(bob, "General")
  const random = roomLink(bob, "Random")

  // Both rooms are on screen first, so a room with no dot is one raising none rather than not rendered.
  await expect(random).toBeVisible()
  await expect(unreadDot(general)).toBeVisible()
  await expect(unreadDot(random)).toHaveCount(0)

  await general.click()

  await expect(message(bob, "the server is on fire")).toBeVisible()

  // Reading it clears the room's dot...
  await bob.getByRole("link", {name: "Space Details"}).click()

  await expect(general).toBeVisible()
  await expect(unreadDot(general)).toHaveCount(0)

  // ...and it stays cleared back on the page he started from
  await bob.locator('.primary-nav a[href="/spaces"]').click()

  await expect(navItem).toBeVisible()
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

  // Silencing a whole space is only offered once push notifications are on.
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

  // Mute is the stronger of the two settings there: it forces notifications off and hides badges.
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

  const menu = spaceMenu(alice, space.url)

  await openSpaceMenu(menu)
  await alice.getByRole("button", {name: "Turn off notifications"}).click()

  await expect(mutedSpaceBell(menu)).toBeVisible()
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

  await page.getByRole("link", {name: "Add a space"}).click()

  await expect(page).toHaveURL(/\/spaces$/)
})

test("US-116 read the home dashboard", async ({seed, as}) => {
  await seed(({relay, user, at}) => {
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

  const page = await as(users.alice, "/home")

  // Each conversation is one link, headed by its room and carrying the latest message underneath
  const conversation = page.getByRole("link").filter({hasText: "the server is on fire"})

  await expect(conversation).toBeVisible()
  await expect(conversation).toContainText("General")
  await expect(unreadDot(conversation)).toBeVisible()

  // Threads, events and classifieds are counted per space in Activity rather than listed as conversations.
  const activity = page.getByRole("link").filter({hasText: "1 thread"})

  await expect(activity).toBeVisible()

  // The inbox is the badges, so a conversation leaves the list once it has nothing unread
  await page.getByRole("button", {name: "Mark all read"}).click()

  await expect(conversation).toHaveCount(0)
  await expect(activity).toHaveCount(0)
  await expect(page.getByText("You're all caught up")).toBeVisible()
})

test("US-117 read the network feed on home", async ({seed, as}) => {
  const note = "the tide charts are wrong again"
  const reply = "they were reprinted last week"
  const topic = "Dredging the channel"

  await seed(({relay, user}) => {
    const space = relay("space")

    space.room("general", {name: "General"})
    space.join(user.alice, "general")
    space.join(user.bob, "general")

    // The feed asks each follow's write relays for their notes, so a note needs a relay list naming one.
    seedRelays(space, user.alice)
    seedRelays(space, user.bob)

    space.event(user.alice, () =>
      space.kind(FollowList).writer().follow(user.bob.pubkey).renderTemplate(),
    )

    const posted = space.event(user.bob, () =>
      space.kind(Note).writer().setContent(note).renderTemplate(),
    )

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

  // The feed is notes only: a reply is counted on the note it answers and gets no card of its own.
  await expect(page.getByRole("button", {name: "1 reply", exact: true})).toBeVisible()
  await expect(page.getByText(reply)).toHaveCount(0)

  // The feed carries every kind of post a follow writes, not only their notes.
  await expect(network.getByText(topic)).toBeVisible()
})

test("US-117 read a follow who is in none of your spaces", async ({seed, as}) => {
  const note = "the lighthouse has been dark since tuesday"
  const answer = "the keeper is on holiday"

  await seed(({relay, open, user, at}) => {
    const space = relay("space")
    const indexer = open("indexer")
    const outbox = open("outbox")

    space.room("general", {name: "General"})
    space.join(user.alice, "general")

    // Bob's relay is somewhere she writes and nowhere she reads, which is enough to identify to it.
    indexer.relayList(user.alice, {
      read: [space.url, indexer.url],
      write: [space.url, indexer.url, outbox.url],
    })
    indexer.follows(user.alice, [user.bob])

    // Bob is in none of her spaces, so his relay list is the only thing that can point the feed at him.
    indexer.relayList(user.bob, {read: [outbox.url], write: [outbox.url]})
    outbox.profile(user.bob, {name: "Bob Barker"})

    const posted = outbox.note(user.bob, note, at(30, MINUTE))

    outbox.event(
      user.bob,
      () => outbox.kind(Note).writer().setParent(posted.event).setContent(answer).renderTemplate(),
      at(20, MINUTE),
    )
  })

  const page = await as(users.alice, "/home")

  const network = page
    .locator("section")
    .filter({has: page.getByRole("heading", {name: "Network"})})

  await expect(network.getByText(note)).toBeVisible()
  await expect(network.getByText("Bob Barker")).toBeVisible()

  // Alice reads from her space rather than bob's relay, so a context asked of hers comes back empty.
  await expect(network.getByRole("button", {name: "1 reply", exact: true})).toBeVisible()
})

test("US-117 read the network feed when one relay never answers", async ({seed, as}) => {
  // Nothing serves this url: the fault is a relay that takes the socket and then says nothing.
  const stalled = "wss://stalled.test/"
  const note = "the drawbridge has been stuck open since noon"

  await seed(({relay, open, user, at}) => {
    const space = relay("space")
    const indexer = open("indexer")
    const outbox = open("outbox")

    space.room("general", {name: "General"})
    space.join(user.alice, "general")

    // Somewhere she writes and nowhere she reads, which is what lets her client identify to them.
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

  // A span releases what it found once it is done waiting, so one silent relay holds it empty.
  await expect(network.getByText(note)).toBeVisible({timeout: 20_000})
  await expect(network.getByText("Bob Barker")).toBeVisible()
})

// A url the container does not serve, so its nip-11 document never arrives and nothing knows what it supports.
const unreachableRelayUrl = "wss://unreachable.test/"

test("US-133 keep the search relays that support search", async ({seed, as}) => {
  const scenario = await seed(({relay, open, user}) => {
    const space = relay("space")
    const indexer = open("indexer")
    const outbox = open("outbox")

    space.room("general", {name: "General"})
    space.join(user.alice, "general")

    indexer.relayList(user.alice, {
      read: [space.url, indexer.url],
      write: [space.url, indexer.url],
    })

    // No search relay of hers is a space, so the health check is the only thing asking for their metadata.
    indexer.event(user.alice, () =>
      indexer
        .kind(SearchRelayList)
        .writer()
        .setUrls([indexer.url, outbox.url, unreachableRelayUrl])
        .renderTemplate(),
    )
  })

  const indexer = scenario.open("indexer")
  const outbox = scenario.open("outbox")

  const page = await as(users.alice, "/home", {
    relayInfo: {[indexer.url]: {supported_nips: [1, 50]}},
  })

  const healthCheck = page.getByRole("group", {name: "Invalid Search Relays"})

  await expect(healthCheck).toBeVisible()

  await healthCheck.getByRole("button", {name: "Fix"}).click()

  const review = dialog(page, "Review changes")

  // Outbox answered and advertised no search; the other two are a relay that does and one nobody can ask.
  await expect(review.getByText(displayRelayUrl(outbox.url))).toBeVisible()
  await expect(review.getByText(displayRelayUrl(indexer.url))).toHaveCount(0)
  await expect(review.getByText(displayRelayUrl(unreachableRelayUrl))).toHaveCount(0)
})

test("US-106 share text into the app", async ({seed, as}) => {
  const shared = "the offsite is moving to the 14th"

  const scenario = await seed(({relay, user, at}) => {
    const space = relay("space")

    space.room("general", {name: "General"})
    space.join(user.alice, "general")
    space.join(user.bob, "general")
    space.profile(user.bob, {name: "Bob Barker"})

    seedRelays(space, user.alice)
    seedRelays(space, user.bob)

    space.dm(user.bob, [user.alice], "are you around?", at(20, MINUTE))
  })

  const space = scenario.space("space")

  // A client only unwraps direct messages once its owner has opened chat.
  const page = await as(users.alice, "/chat")

  await expect(page.getByText("are you around?").first()).toBeVisible()

  // The text arrives in the query string rather than through a native share intent.
  await page.goto(`/share?text=${encodeURIComponent(shared)}`)

  const share = dialog(page, "Share")

  await expect(share.getByRole("button", {name: "Bob Barker"})).toBeVisible()

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

  // EventInfo renders the link on mount rather than during setup.
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

  // A phone has no room list on screen while a room is open.
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

  // Bob's own space still has an unread room, which is that space's own business.
  await bob.goto(spacePath(space.url))

  await expect(unreadDot(roomLink(bob, "Random"))).toBeVisible()
  await expect(unreadDot(menuButton)).toHaveCount(0)
})

// SpaceMenuNavItems offers a content type once the space has an event of that kind or an unread.
const contentNavItem = (page: Page, name: string) =>
  page.locator(".secondary-nav").getByRole("link", {name})

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
    seedThread(space, user.alice, "the anchor is dragging", at(1, HOUR))
  })

  const space = scenario.space("space")
  const bob = await as(users.bob, roomPath(space.url, "general"))

  const threadsNav = contentNavItem(bob, "Threads")

  await expect(threadsNav).toBeVisible()
  await expect(unreadDot(threadsNav)).toBeVisible()

  await threadsNav.click()

  const hers = bob.getByRole("row").filter({hasText: "the server is on fire"})
  const unopened = bob.getByRole("row").filter({hasText: "the anchor is dragging"})
  const his = bob.getByRole("row").filter({hasText: "where is the sextant"})

  await expect(his).toBeVisible()

  // syncChecked marks the page read 300ms later and latestActivityByPath is throttled to a second.
  await bob.waitForTimeout(1500)

  await expect(unreadDot(hers)).toBeVisible()
  await expect(unreadDot(unopened)).toBeVisible()
  await expect(unreadDot(his)).toHaveCount(0)

  await hers.click()

  await expect(bob.locator("article").filter({hasText: "the server is on fire"})).toBeVisible()

  // Opening a thread is what marks it read, so only the one he opened loses its dot
  await bob.goBack()

  await expect(unreadDot(hers)).toHaveCount(0)
  await expect(unreadDot(unopened)).toBeVisible()

  await roomLink(bob, "General").click()

  // The nav item is clear even with a thread under it still unread
  await expect(threadsNav).toBeVisible()
  await expect(unreadDot(threadsNav)).toHaveCount(0)
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

    // Older than the month the space sync asks for, so the nav can only know by asking the relay.
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

    // A comment on a poll nothing holds: the relay kept the comment and dropped its subject.
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

  const bob = await as(users.bob, roomPath(other.url, "general"))
  const spaceButton = spaceNavItem(bob, space.name)

  await expect(unreadDot(spaceButton)).toBeVisible()

  await spaceButton.click()

  const pollsNav = contentNavItem(bob, "Polls")

  await expect(pollsNav).toBeVisible()
  await expect(unreadDot(pollsNav)).toBeVisible()

  await pollsNav.click()

  await expect(bob.getByText("No polls found.")).toBeVisible()

  // With nothing unread and no poll to list, the space stops offering the section at all.
  await roomLink(bob, "General").click()

  await expect(pollsNav).toHaveCount(0)
})

test("US-132 see a room whose newest message is old", async ({seed, as}) => {
  const scenario = await seed(({relay, user, at}) => {
    const space = relay("space")
    const other = relay("other")

    space.room("general", {name: "General"})
    other.room("general", {name: "General"})
    space.join(user.alice, "general")
    space.join(user.bob, "general")
    other.join(user.bob, "general")

    space.message(user.alice, "general", "still nobody bought a sextant", at(60, DAY))
  })

  const space = scenario.space("space")
  const other = scenario.space("other")

  const bob = await as(users.bob, roomPath(other.url, "general"))
  const spaceButton = spaceNavItem(bob, space.name)

  await expect(unreadDot(spaceButton)).toBeVisible()

  await spaceButton.click()

  await expect(unreadDot(roomLink(bob, "General"))).toBeVisible()
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

  // The tab has to be in the background before a push notification is raised at all.
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

  // A reply prepends the message it answers, so its first line is an entity rather than the reply.
  await expect
    .poll(() => notifications.at(-1))
    .toEqual({
      title: "Someone mentioned you",
      body: "sunday, the notice is at a link to harbor.example",
    })
})

test("US-136 hear about a new message and not about a new thread", async ({seed, as}) => {
  const scenario = await seed(({relay, user}) => {
    const space = relay("space")

    space.room("general", {name: "General"})
    space.join(user.alice, "general")
    space.join(user.bob, "general")
    space.profile(user.alice, {name: "Alice Anchor"})
    space.profile(user.bob, {name: "Bob Barnacle"})
  })

  const space = scenario.space("space")

  // The tab has to be in the background before a notification is raised at all.
  const alice = await as(users.alice, "/settings/alerts", {
    context: {permissions: ["notifications"]},
  })

  await settingRow(alice, "Enable push notifications").getByRole("checkbox").check()
  await alice.getByRole("button", {name: "Save Changes"}).click()

  await expect(alice.getByRole("alert")).toContainText("Your settings have been saved!")

  await spaceNavItem(alice, space.name).click()
  await roomLink(alice, "General").click()

  await expect(alice).toHaveURL(pathPattern(roomPath(space.url, "general")))

  const notifications = await captureNotifications(alice)

  const bob = await as(users.bob, `${spacePath(space.url)}/threads`)
  const board = bob
    .locator("section")
    .filter({has: bob.getByRole("heading", {name: "General", exact: true})})

  await board.getByRole("button", {name: "Create", exact: true}).click()

  const threadForm = modalForm(bob, "Create a Thread")

  await threadForm.getByPlaceholder("What is this thread about?").fill("the dock is closing")
  await noteEditor(threadForm).pressSequentially("sunday, apparently")
  await threadForm.getByRole("button", {name: "Create Thread"}).click()

  await expect(board.getByRole("row").filter({hasText: "the dock is closing"})).toBeVisible()

  // Alice holds the thread before bob says anything, so a notification for it would be here by now.
  await contentNavItem(alice, "Threads").click()
  await expect(alice.getByRole("row").filter({hasText: "the dock is closing"})).toBeVisible()

  await postTo(bob, "General", "when does the dock close?")

  await expect
    .poll(() => notifications)
    .toEqual([{title: "New message", body: "when does the dock close?"}])
})
