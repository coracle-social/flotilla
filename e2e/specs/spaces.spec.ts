import {DAY, HOUR, sleep, sortBy} from "@welshman/lib"
import {ROOMS} from "@welshman/util"
import type {Page} from "@playwright/test"
import type {SeededSpace} from "../harness"
import {expect, pathPattern, readCachedEvents, roomPath, spacePath, test, users} from "../harness"

// Room lists reach indexeddb in three-second batches, so a spec about a reload waits on this first.
const cachedFirstSpace = async (page: Page, pubkey: string) => {
  const events = (await readCachedEvents(page, pubkey)).filter(event => event.kind === ROOMS)
  const newest = sortBy(event => -event.created_at, events)[0]

  return newest?.tags.find(tag => tag[0] === "r")?.[1]
}

// The rail shows icons and no text, so a row is read by the tooltip naming its relay.
const railSpaces = (page: Page) => page.locator(".primary-nav [data-drag-key]")

// A pointer drag is driven by coordinates, so a row is measured rather than located.
const railCenter = async (page: Page, index: number) => {
  const box = await railSpaces(page).nth(index).boundingBox()

  if (!box) {
    throw new Error(`The rail has no space at index ${index}`)
  }

  return {x: box.x + box.width / 2, y: box.y + box.height / 2}
}

const expectRailFirst = (page: Page, name: string) =>
  expect(railSpaces(page).first().locator("[data-tip]")).toHaveAttribute(
    "data-tip",
    new RegExp(`^${name}`),
  )

// A drop reorders the list in place and publishes behind it, so the copy on disk is the round trip.
const expectReordered = async (page: Page, pubkey: string, space: SeededSpace) => {
  await expectRailFirst(page, space.name)
  await expect.poll(() => cachedFirstSpace(page, pubkey)).toBe(space.url)
}

test("US-009 browse and search spaces, and reorder your own", async ({seed, as}) => {
  const scenario = await seed(({relay, user}) => {
    const space = relay("space")
    const other = relay("other")
    const unsigned = relay("unsigned")

    space.room("general", {name: "General"})
    other.room("lounge", {name: "Lounge"})
    unsigned.room("hall", {name: "Hall"})

    // Alice's own two spaces, declared in the order her room list should start out in
    space.join(user.alice, "general")
    other.join(user.alice, "lounge")

    // A space she hasn't joined only becomes browsable through somebody else's room list
    space.join(user.bob, "general")
    unsigned.join(user.bob, "hall")
  })

  const space = scenario.space("space")
  const other = scenario.space("other")
  const unsigned = scenario.space("unsigned")

  // The spaces page discovers unjoined spaces by pulling the room lists of its bootstrap pubkeys.
  const page = await as(users.alice, "/spaces", {env: {VITE_DEFAULT_PUBKEYS: users.bob.pubkey}})

  // The page is for spaces she hasn't joined. The ones she has are in the rail.
  await expect(page.getByText(unsigned.url)).toBeVisible()
  await expect(page.getByText(space.url)).toHaveCount(0)

  const term = page.getByPlaceholder("Search for spaces...")

  await term.fill("nothing by that name")

  await expect(page.getByText(unsigned.url)).toHaveCount(0)

  await term.fill("unsigned")
  await page.getByRole("button").filter({hasText: unsigned.url}).click()

  await expect(page.getByRole("button", {name: "Join Space"})).toBeVisible()

  // Reordering by dragging, which lives in her room list and so outlives the page
  await page.goto("/spaces")

  await expectRailFirst(page, space.name)

  const start = await railCenter(page, 0)
  const end = await railCenter(page, 1)

  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  await page.mouse.move(end.x, end.y, {steps: 5})

  // The rows flip into their new slots over 300ms, and one more move reads the settled list.
  await page.waitForTimeout(400)
  await page.mouse.move(end.x, end.y + 1)
  await page.mouse.up()

  await expectReordered(page, users.alice.pubkey, other)

  await page.reload()

  await expectRailFirst(page, other.name)
})

test("US-010 join a space from an invite link", async ({seed, as}) => {
  const scenario = await seed(({relay, user}) => {
    const space = relay("space")
    const other = relay("other")

    space.room("general", {name: "General"})
    other.room("lounge", {name: "Lounge"})
    space.join(user.alice, "general")
  })

  const other = scenario.space("other")
  const page = await as(users.alice, spacePath(other.url))

  // Arriving at a space she hasn't joined raises the join prompt on its own
  await expect(page.getByRole("button", {name: "Join Space"})).toBeEnabled()

  await page.goto("/spaces")
  await page.getByRole("button", {name: "Add Space"}).click()
  await page.getByRole("button", {name: /Join a space/}).click()

  // An absolute platform url is an off-origin navigation, and parseInviteLink reads query params.
  await page
    .locator("form")
    .filter({hasText: "Invite Link*"})
    .getByRole("textbox")
    .fill("https://app.flotilla.social/join?r=other.test&c=")

  await expect(page.getByText(other.url)).toBeVisible()

  await page.getByRole("button", {name: "Join Space"}).click()

  await expect(page.getByText("Welcome to the space!")).toBeVisible()
  await expect(page).toHaveURL(/\/spaces\/other\.test/)
})

test("US-010 a direct link's join prompt outlives the entry redirect", async ({seed, as}) => {
  const scenario = await seed(({relay, user}) => {
    const space = relay("space")
    const other = relay("other")

    space.room("general", {name: "General"})
    other.room("lounge", {name: "Lounge"})
    space.join(user.alice, "general")
  })

  const other = scenario.space("other")
  const page = await as(users.alice, "/")

  // A space's own path redirects, and a modal raised while that navigation is in flight is lost.
  let held = 0

  await page.context().route(
    url => url.pathname.endsWith("/about/+page.svelte"),
    async route => {
      held++

      await sleep(15000)
      await route.continue()
    },
  )

  await page.goto(spacePath(other.url))

  await expect(page.getByRole("button", {name: "Join Space"})).toBeEnabled({timeout: 60000})
  await expect(page).toHaveURL(pathPattern(spacePath(other.url) + "/about"))

  // A page that stops asking for that module is a spec that no longer covers the race.
  expect(held).toBeGreaterThan(0)
})

test("US-011 request access when a space turns you away", async ({seed, as}) => {
  const scenario = await seed(({relay, user}) => {
    const closed = relay("closed")
    const space = relay("space")

    // The relay only registers a claim through the nip-86 method the invite dialog calls.
    closed.room("lobby", {name: "Lobby"})

    space.room("general", {name: "General"})
    space.join(user.admin, "general")
    space.join(user.bob, "general")
    space.profile(user.bob, {name: "Bob Barnacle"})
  })

  const closed = scenario.space("closed")
  const space = scenario.space("space")

  // Administering a relay is not the same as belonging to it.
  const admin = await as(users.admin, spacePath(closed.url) + "/about")

  await admin.locator("form").getByRole("button", {name: "Go back"}).click()
  await admin.getByRole("button", {name: /closed\.test/}).click()
  await admin.getByRole("button", {name: "Create Invite"}).click()

  const inviteLink = admin.locator("input[readonly]")

  await expect(inviteLink).toHaveValue(/[?&]c=\w/)

  const [, claim = ""] = (await inviteLink.inputValue()).match(/[?&]c=([^&]+)/) ?? []

  const alice = await as(users.alice, spacePath(closed.url))

  // Turned away rather than joined, so the prompt becomes a request
  await alice.getByRole("button", {name: "Request Access"}).click()

  const code = alice.locator("form").filter({hasText: "Invite code*"}).getByRole("textbox")

  await code.fill("NOTTHECODE")
  await alice.getByRole("button", {name: "Join Space"}).click()

  // The relay refused the code, so she is told and left asking
  await expect(alice.getByRole("alert")).toContainText("join request rejected")

  await code.fill(claim)
  await alice.getByRole("button", {name: "Join Space"}).click()

  // The correct code granted her access, so the space stops turning her away
  await expect(alice.getByRole("heading", {name: "Request Access"})).toHaveCount(0)
  await expect(alice.getByRole("button", {name: "Join Space"})).toBeEnabled()

  await alice.getByRole("button", {name: "Join Space"}).click()

  await expect(alice.getByText("Welcome to the space!")).toBeVisible()
  await expect(alice).toHaveURL(/\/spaces\/closed\.test/)

  // A member the admin bans is told why by the relay itself
  await admin.goto(spacePath(space.url) + "/directory")

  const bobCard = admin
    .getByRole("button", {name: "View Bob Barnacle's profile"})
    .locator("xpath=..")

  await bobCard.getByRole("button").last().click()
  await admin.getByRole("button", {name: "Ban member"}).click()

  await admin.getByRole("button", {name: "Confirm"}).click()

  await expect(admin.getByText("Member has successfully been banned!")).toBeVisible()

  const bob = await as(users.bob, spacePath(space.url))

  await expect(bob.getByRole("heading", {name: "Access Error"})).toBeVisible()

  await bob.getByRole("button", {name: "Leave Space"}).click()

  await expect(bob).toHaveURL(/\/home/)
})

test("US-012 decide whether to trust an unsigned space", async ({seed, as}) => {
  const scenario = await seed(({relay, user}) => {
    const unsigned = relay("unsigned")

    unsigned.room("general", {name: "General"})
    unsigned.join(user.alice, "general")
    unsigned.join(user.bob, "general")
    unsigned.message(user.alice, "general", "the hull is patched")
  })

  const unsigned = scenario.space("unsigned")

  // This relay serves events with their signatures stripped, so it can forge messages
  const bob = await as(users.bob, roomPath(unsigned.url, "general"))

  await expect(bob.getByRole("heading", {name: "Do you trust this space?"})).toBeVisible()

  await bob.getByRole("button", {name: "I don't trust this space"}).click()

  await expect(bob).toHaveURL(/\/home/)

  // In-app rather than a fresh load: leaving is published in the background and reaches disk late.
  await bob.getByRole("link", {name: "All Spaces"}).click()

  await expect(railSpaces(bob)).toHaveCount(0)

  const alice = await as(users.alice, roomPath(unsigned.url, "general"))

  await expect(alice.getByRole("heading", {name: "Do you trust this space?"})).toBeVisible()

  await alice.getByRole("button", {name: "I trust this space, continue"}).click()

  await expect(alice.getByRole("heading", {name: "Do you trust this space?"})).toHaveCount(0)
  await expect(alice.getByText("the hull is patched")).toBeVisible()
})

test("US-013 follow a space that has moved", async ({seed, as}) => {
  const scenario = await seed(({relay, user}) => {
    const space = relay("space")
    const other = relay("other")

    space.room("general", {name: "General"})
    other.room("general", {name: "General"})
    space.join(user.alice, "general")
    space.join(user.bob, "general")

    // The new address has to let her in once her list points at it
    other.member(user.alice)
  })

  const space = scenario.space("space")
  const other = scenario.space("other")

  // The relay's own nip-11 document is what reports the move
  const relayInfo = {[space.url]: {redirect_to: "https://other.test/"}}

  const alice = await as(users.alice, spacePath(space.url) + "/about", {relayInfo})

  await alice.getByRole("button", {name: "Update and go"}).click()

  await expect(alice).toHaveURL(/\/spaces\/other\.test\/about/)

  // In-app rather than a fresh load: the updated list is published in the background.
  await alice.getByRole("link", {name: "All Spaces"}).click()

  await expectRailFirst(alice, other.name)

  const bob = await as(users.bob, spacePath(space.url) + "/about", {relayInfo})

  await expect(bob.getByRole("heading", {name: "This space has moved"})).toBeVisible()

  await bob.getByRole("button", {name: "Not now"}).click()

  await expect(bob).toHaveURL(/\/spaces\/space\.test\/about/)
})

test("US-014 leave a space", async ({seed, as}) => {
  const scenario = await seed(({relay, user}) => {
    const space = relay("space")

    space.room("general", {name: "General"})
    space.join(user.bob, "general")
    space.message(user.bob, "general", "signing off for a while")
  })

  const space = scenario.space("space")
  const page = await as(users.bob, spacePath(space.url) + "/about")

  await page.getByRole("button", {name: /space\.test/}).click()
  await page.getByRole("button", {name: "Leave Space"}).click()

  await page.getByRole("button", {name: "Confirm"}).click()

  await expect(page).toHaveURL(/\/home/)

  // In-app rather than a fresh load: leaving is published in the background.
  await page.getByRole("link", {name: "All Spaces"}).click()

  await expect(railSpaces(page)).toHaveCount(0)
})

test("US-015 view a space's details", async ({seed, as}) => {
  const scenario = await seed(({relay, user}) => {
    const space = relay("space")

    space.room("general", {name: "General"})
    space.join(user.admin, "general")
    space.join(user.carol, "general")
    space.join(user.alice, "general")
    space.profile(user.alice, {name: "Alice Anchor"})
  })

  const space = scenario.space("space")

  // Contact and terms are nip-11 fields zooid doesn't publish.
  const relayInfo = {
    [space.url]: {
      contact: "harbormaster@space.test",
      terms_of_service: "https://space.test/terms",
    },
  }

  const carol = await as(users.carol, spacePath(space.url) + "/about", {relayInfo})

  await expect(carol.getByRole("heading", {name: "space"})).toBeVisible()
  await expect(carol.getByText(/Throwaway relay/)).toBeVisible()
  await expect(carol.getByText(/harbormaster@space\.test/)).toBeVisible()
  await expect(carol.getByRole("link", {name: "Terms of Service"})).toBeVisible()

  const admin = await as(users.admin, spacePath(space.url) + "/about", {relayInfo})
  const featuredHeader = admin.getByRole("heading", {name: "Featured"}).locator("xpath=..")

  await featuredHeader.getByRole("button").click()
  await admin.getByRole("button", {name: "Add content"}).click()
  await admin.getByPlaceholder("URL or nevent...").fill("Start with the harbor rules")
  await admin.getByRole("button", {name: "Save changes"}).click()

  await expect(admin.getByText("Featured content updated!")).toBeVisible()

  // What admin featured reaches every visitor
  await expect(carol.getByRole("heading", {name: "Featured"})).toBeVisible()
  await expect(carol.getByText("Start with the harbor rules")).toBeVisible()
})

test("US-017 search across a space", async ({seed, as}) => {
  const scenario = await seed(({relay, user, at}) => {
    const space = relay("space")

    space.room("general", {name: "General"})
    space.room("random", {name: "Random"})
    space.join(user.alice, "general", "random")
    space.message(user.alice, "general", "the kraken surfaced at dawn", at(2, HOUR))
    space.message(user.alice, "random", "kraken jokes only in here", at(3, DAY))
  })

  const space = scenario.space("space")

  // The directory rather than a feed, since a result's own text can't be on the page behind it.
  const page = await as(users.alice, spacePath(space.url) + "/directory")

  await page.locator(".secondary-nav").getByRole("button", {name: "Search"}).click()

  const term = page.getByPlaceholder("Search this space...")

  await term.fill("narwhal")

  await expect(page.getByText("No results found.")).toBeVisible()

  await term.fill("kraken")

  await expect(page.getByText("the kraken surfaced at dawn")).toBeVisible()

  await page.getByRole("button").filter({hasText: "kraken jokes only in here"}).click()

  await expect(page).toHaveURL(/\/spaces\/space\.test\/random\?at=/)
})
