import {DAY, HOUR, MINUTE, WEEK, sortBy} from "@welshman/lib"
import {ROOMS, THREAD, makeEvent} from "@welshman/util"
import type {Page} from "@playwright/test"
import {expect, readCachedEvents, roomPath, spacePath, test, users} from "../harness"

// The space this user's room list names first, read from the copy on disk the app restores itself
// from. Room lists reach indexeddb in three-second batches with nothing in the ui to say when one
// has landed, so a spec about what survives a reload waits on this before it reloads.
const cachedFirstSpace = async (page: Page, pubkey: string) => {
  const events = (await readCachedEvents(page, pubkey)).filter(event => event.kind === ROOMS)
  const newest = sortBy(event => -event.created_at, events)[0]

  return newest?.tags.find(tag => tag[0] === "r")?.[1]
}

test("US-009 browse, search, and reorder your spaces", async ({seed, as}) => {
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

  // The spaces page discovers unjoined spaces by pulling the room lists of the pubkeys it
  // bootstraps from, so pointing that at bob is what puts his other space in front of alice.
  const page = await as(users.alice, "/spaces", {env: {VITE_DEFAULT_PUBKEYS: users.bob.pubkey}})

  await expect(page.getByText("Your spaces")).toBeVisible()
  await expect(page.getByText(space.url)).toBeVisible()
  await expect(page.getByText(other.url)).toBeVisible()

  // ...and the rest of them in a section of their own
  await expect(page.getByText("Browse Spaces")).toBeVisible()
  await expect(page.getByText(unsigned.url)).toBeVisible()

  const term = page.getByPlaceholder("Search for spaces...")

  await term.fill("unsigned")

  await expect(page.getByText(unsigned.url)).toBeVisible()
  await expect(page.getByText(space.url)).toHaveCount(0)
  await expect(page.getByText(other.url)).toHaveCount(0)

  await term.fill("")

  await expect(page.getByText(space.url)).toBeVisible()

  // A space she's joined opens
  await page.getByRole("listitem").filter({hasText: space.url}).click()

  await expect(page).toHaveURL(/\/spaces\/space\.test\//)

  // A space she hasn't asks her to join first
  await page.goto("/spaces")
  await page.getByRole("button").filter({hasText: unsigned.url}).click()

  await expect(page.getByRole("button", {name: "Join Space"})).toBeVisible()
  await expect(page.getByRole("button", {name: "Go back"})).toBeEnabled()

  // Reordering by dragging, which lives in her room list and so outlives the page
  await page.goto("/spaces")

  const joined = page.getByRole("listitem")

  await expect(joined.first()).toContainText(space.url)

  // Html5 drag and drop, dispatched rather than mimed with the mouse: chromium's synthetic drag
  // starts the drag and moves it, but never delivers the drop the reorder is committed in, so the
  // row would snap back to where it came from.
  const dataTransfer = await page.evaluateHandle(() => new DataTransfer())
  const source = joined.filter({hasText: other.url})
  const target = joined.filter({hasText: space.url})

  await source.dispatchEvent("dragstart", {dataTransfer})
  await target.dispatchEvent("drop", {dataTransfer})

  await expect(joined.first()).toContainText(other.url)

  // The reload restores the list from disk, so wait for the new order to land there rather than
  // racing it — a page that read the old copy back keeps the order it started with.
  await expect.poll(() => cachedFirstSpace(page, users.alice.pubkey)).toBe(other.url)

  await page.reload()

  await expect(page.getByRole("listitem").first()).toContainText(other.url)
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
  await expect(page.getByText(other.url)).toBeVisible()

  await page.getByRole("button", {name: "Go back"}).click()

  // Going back left her un-joined, so arriving again asks again
  await page.goto(spacePath(other.url))

  await expect(page.getByRole("button", {name: "Join Space"})).toBeEnabled()

  await page.goto("/spaces")
  await page.getByRole("button", {name: "Add Space"}).click()
  await page.getByRole("button", {name: /Join a space/}).click()

  const invite = page.locator("form").filter({hasText: "Invite Link*"}).getByRole("textbox")

  await invite.fill("not an invite")

  await expect(page.getByRole("button", {name: "Join Space"})).toBeDisabled()
  await expect(page.getByText("You're about to join:")).toHaveCount(0)

  // The link makeInviteLink builds, typed rather than followed — an absolute platform url is an
  // off-origin navigation, and parseInviteLink only ever reads its query params.
  await invite.fill("https://app.flotilla.social/join?r=other.test&c=")

  await expect(page.getByText("You're about to join:")).toBeVisible()
  await expect(page.getByText(other.url)).toBeVisible()

  await page.getByRole("button", {name: "Join Space"}).click()

  await expect(page.getByText("Welcome to the space!")).toBeVisible()
  await expect(page).toHaveURL(/\/spaces\/other\.test/)
})

test("US-011 request access when a space turns you away", async ({seed, as}) => {
  const scenario = await seed(({relay, user}) => {
    const closed = relay("closed")
    const space = relay("space")

    // This relay refuses a join that carries no claim. A claim is not an event a scenario can
    // publish — the relay only registers one through the nip-86 method the invite dialog calls —
    // so the code alice needs comes out of that dialog below.
    closed.room("lobby", {name: "Lobby"})

    space.room("general", {name: "General"})
    space.join(user.admin, "general")
    space.join(user.bob, "general")
    space.profile(user.bob, {name: "Bob Barnacle"})
  })

  const closed = scenario.space("closed")
  const space = scenario.space("space")

  // Administering a relay is not the same as belonging to it, so the space asks admin to join
  // like anyone else — and issues him an invite code all the same.
  const admin = await as(users.admin, spacePath(closed.url) + "/about")

  await admin.locator("form").getByRole("button", {name: "Go back"}).click()
  await admin.getByRole("button", {name: /closed\.test/}).click()
  await admin.getByRole("button", {name: "Create Invite"}).click()

  const inviteLink = admin.locator("input[readonly]")

  await expect(inviteLink).toHaveValue(/[?&]c=\w/)

  const [, claim = ""] = (await inviteLink.inputValue()).match(/[?&]c=([^&]+)/) ?? []

  const alice = await as(users.alice, spacePath(closed.url))

  // Turned away rather than joined, so the prompt becomes a request
  await expect(alice.getByRole("button", {name: "Request Access"})).toBeEnabled()

  await alice.getByRole("button", {name: "Request Access"}).click()

  await expect(alice.getByRole("heading", {name: "Request Access"})).toBeVisible()

  const code = alice.locator("form").filter({hasText: "Invite code*"}).getByRole("textbox")

  await code.fill("NOTTHECODE")
  await alice.getByRole("button", {name: "Join Space"}).click()

  // The relay refused the code, so she is told and left asking
  await expect(alice.getByRole("alert")).toContainText("join request rejected")
  await expect(alice.getByRole("heading", {name: "Request Access"})).toBeVisible()

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

  await expect(admin.getByText("Ban @Bob Barnacle from the space?")).toBeVisible()

  await admin.getByRole("button", {name: "Confirm"}).click()

  await expect(admin.getByText("Member has successfully been banned!")).toBeVisible()

  const bob = await as(users.bob, spacePath(space.url))

  await expect(bob.getByRole("heading", {name: "Access Error"})).toBeVisible()
  await expect(bob.getByText(/not a member of this relay/i)).toBeVisible()

  // From here he can ask for a code back in
  await bob.getByRole("button", {name: "Request Access"}).click()

  await expect(bob.getByRole("heading", {name: "Request Access"})).toBeVisible()

  await bob.getByRole("button", {name: "Go back"}).click()

  // ...or give up on the space, which takes it off his list
  await bob.getByRole("button", {name: "Leave Space"}).click()

  await expect(bob).toHaveURL(/\/home/)

  await bob.goto("/spaces")

  await expect(bob.getByText("You haven't joined any spaces yet.")).toBeVisible()
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

  // In-app rather than a fresh load: leaving the space is published in the background, and a
  // page that reloads before it reaches disk reads the list he had a moment ago.
  await bob.getByRole("link", {name: "All Spaces"}).click()

  await expect(bob.getByText("You haven't joined any spaces yet.")).toBeVisible()

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
  const movedDialog = alice.locator("form")

  await expect(alice.getByRole("heading", {name: "This space has moved"})).toBeVisible()
  await expect(movedDialog.getByText("space.test", {exact: true})).toBeVisible()
  await expect(movedDialog.getByText("other.test", {exact: true})).toBeVisible()

  await alice.getByRole("button", {name: "Update and go"}).click()

  await expect(alice).toHaveURL(/\/spaces\/other\.test\/about/)

  // In-app rather than a fresh load: the updated list is published in the background, and a page
  // that reloads before it reaches disk reads the old address back.
  await alice.getByRole("link", {name: "All Spaces"}).click()

  const aliceSpaces = alice.getByRole("listitem")

  await expect(aliceSpaces).toHaveCount(1)
  await expect(aliceSpaces.first()).toContainText(other.url)

  const bob = await as(users.bob, spacePath(space.url) + "/about", {relayInfo})

  await expect(bob.getByRole("heading", {name: "This space has moved"})).toBeVisible()

  await bob.getByRole("button", {name: "Not now"}).click()

  await expect(bob).toHaveURL(/\/spaces\/space\.test\/about/)

  await bob.goto("/spaces")

  const bobSpaces = bob.getByRole("listitem")

  await expect(bobSpaces).toHaveCount(1)
  await expect(bobSpaces.first()).toContainText(space.url)
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

  await expect(page.getByText("Are you sure you want to leave?")).toBeVisible()

  await page.getByRole("button", {name: "Confirm"}).click()

  await expect(page).toHaveURL(/\/home/)

  // In-app rather than a fresh load: leaving is published in the background, and a page that
  // reloads before it reaches disk reads the list he had a moment ago.
  await page.getByRole("link", {name: "All Spaces"}).click()

  await expect(page.getByText("You haven't joined any spaces yet.")).toBeVisible()

  // Nothing stops him coming back
  await page.getByRole("button", {name: "Add Space"}).click()
  await page.getByRole("button", {name: /Join a space/}).click()
  await page
    .locator("form")
    .filter({hasText: "Invite Link*"})
    .getByRole("textbox")
    .fill("https://app.flotilla.social/join?r=space.test&c=")

  await expect(page.getByText("You're about to join:")).toBeVisible()

  await page.getByRole("button", {name: "Join Space"}).click()

  await expect(page.getByText("Welcome to the space!")).toBeVisible()
  await expect(page).toHaveURL(/\/spaces\/space\.test/)
})

test("US-015 view a space's details", async ({seed, as}) => {
  const scenario = await seed(({relay, user, at}) => {
    const space = relay("space")

    space.room("general", {name: "General"})
    space.join(user.admin, "general")
    space.join(user.carol, "general")
    space.join(user.alice, "general")
    space.profile(user.alice, {name: "Alice Anchor"})
    space.message(user.alice, "general", "the tide is high", at(1, HOUR))
  })

  const space = scenario.space("space")

  // Contact, terms, privacy and the limitation warnings are nip-11 fields zooid doesn't publish
  // on its own, so the scenario merges them over the relay's real document.
  const relayInfo = {
    [space.url]: {
      icon: "https://space.test/icon.png",
      contact: "harbormaster@space.test",
      terms_of_service: "https://space.test/terms",
      privacy_policy: "https://space.test/privacy",
      limitation: {auth_required: true, payment_required: true, min_pow_difficulty: 20},
    },
  }

  const carol = await as(users.carol, spacePath(space.url) + "/about", {relayInfo})

  await expect(carol.locator('img[src="https://space.test/icon.png"]').first()).toBeVisible()
  await expect(carol.getByRole("heading", {name: "space"})).toBeVisible()
  await expect(carol.getByText("space.test", {exact: true}).first()).toBeVisible()
  await expect(carol.getByText(/Throwaway relay/)).toBeVisible()
  await expect(carol.getByRole("link", {name: "Terms of Service"})).toBeVisible()
  await expect(carol.getByRole("link", {name: "Privacy Policy"})).toBeVisible()

  await expect(carol.getByText(/Administrator:/)).toBeVisible()
  await expect(carol.getByText("Contact: harbormaster@space.test")).toBeVisible()
  await expect(carol.getByText(/Software:/)).toBeVisible()
  await expect(carol.getByText(/Version:/)).toBeVisible()
  await expect(carol.getByText("Auth Required")).toBeVisible()
  await expect(carol.getByText("Payment Required")).toBeVisible()
  await expect(carol.getByText("Min PoW: 20")).toBeVisible()

  await expect(carol.getByRole("heading", {name: "Members"})).toBeVisible()
  await expect(carol.getByText("Admins")).toBeVisible()
  await expect(carol.getByText("New members")).toBeVisible()

  // Nothing is featured yet, so recent activity stands in for it
  await expect(carol.getByRole("heading", {name: "Recent Activity"})).toBeVisible()
  await expect(carol.getByText("the tide is high")).toBeVisible()

  const admin = await as(users.admin, spacePath(space.url) + "/about", {relayInfo})
  const featuredHeader = admin.getByRole("heading", {name: "Featured"}).locator("xpath=..")

  await featuredHeader.getByRole("button").click()
  await admin.getByRole("button", {name: "Add content"}).click()
  await admin.getByPlaceholder("URL or nevent...").fill("Start with the harbor rules")
  await admin.getByRole("button", {name: "Save changes"}).click()

  await expect(admin.getByText("Featured content updated!")).toBeVisible()

  // What admin featured reaches every visitor, and takes the top slot from recent activity
  await expect(carol.getByRole("heading", {name: "Featured"})).toBeVisible()
  await expect(carol.getByText("Start with the harbor rules")).toBeVisible()

  await carol.getByRole("link", {name: "View all members"}).click()

  await expect(carol).toHaveURL(/\/spaces\/space\.test\/directory/)
})

test("US-016 catch up on a space's recent activity", async ({seed, as}) => {
  const scenario = await seed(({relay, user, at}) => {
    const space = relay("space")
    const other = relay("other")

    space.room("general", {name: "General"})
    space.room("quiet", {name: "Quiet Corner"})
    space.join(user.alice, "general", "quiet")
    space.join(user.bob, "general", "quiet")
    space.message(user.alice, "general", "the tide is high", at(30, MINUTE))
    space.message(user.alice, "quiet", "anyone still here?", at(3, HOUR))
    space.event(
      user.alice,
      makeEvent(THREAD, {
        created_at: at(2, HOUR),
        content: "Where should we sail next?",
        tags: [
          ["h", "general"],
          ["title", "Next voyage"],
        ],
      }),
    )

    // More items than the page renders at once, so the oldest is only reachable by scrolling
    for (let day = 1; day <= 20; day++) {
      space.event(
        user.alice,
        makeEvent(THREAD, {
          created_at: at(day, DAY),
          content: `Log entry ${day}`,
          tags: [
            ["h", "general"],
            ["title", `Old voyage ${day}`],
          ],
        }),
      )
    }

    // A space with a member and nothing else
    other.join(user.bob)
  })

  const space = scenario.space("space")
  const other = scenario.space("other")
  const bob = await as(users.bob, spacePath(space.url) + "/recent")
  const items = bob.locator(".cv")

  await expect(bob.getByText("the tide is high")).toBeVisible()
  await expect(bob.getByText("anyone still here?")).toBeVisible()
  await expect(bob.getByText("Next voyage")).toBeVisible()

  // Newest first: the latest message in each room alongside the thread, in one feed
  await expect(items.first()).toContainText("the tide is high")

  await bob.mouse.move(640, 400)
  await bob.mouse.wheel(0, 8000)

  await expect(bob.getByText("Old voyage 20")).toBeVisible()

  // A message in the room that had gone quiet pulls it back to the top
  const alice = await as(users.alice, roomPath(space.url, "quiet"))

  await alice.locator(".chat-editor [contenteditable=true]").pressSequentially("still here!")
  await alice.locator(".chat-editor [contenteditable=true]").press("Enter")

  await expect(alice.getByText("still here!")).toBeVisible()

  // The feed is assembled when the page loads rather than kept up to date behind the reader, so
  // this is the order bob finds when he comes back to it.
  await bob.reload()

  await expect(items.first()).toContainText("Quiet Corner")

  await bob.goto(spacePath(other.url) + "/recent")

  await expect(bob.getByText("No recent activity found!")).toBeVisible()
})

test("US-017 search across a space", async ({seed, as}) => {
  const scenario = await seed(({relay, user, at}) => {
    const space = relay("space")

    space.room("general", {name: "General"})
    space.room("random", {name: "Random"})
    space.join(user.alice, "general", "random")
    space.message(user.alice, "general", "the kraken surfaced at dawn", at(2, HOUR))
    space.message(user.alice, "random", "kraken jokes only in here", at(3, DAY))
    space.message(user.alice, "general", "ancient kraken lore, volume one", at(3, WEEK))
  })

  const space = scenario.space("space")

  // The directory rather than a feed: search is reachable from every page in a space, and this is
  // one where a result's own text can't also be on the page behind the dialog.
  const page = await as(users.alice, spacePath(space.url) + "/directory")

  await page.locator(".secondary-nav").getByRole("button", {name: "Search"}).click()

  const term = page.getByPlaceholder("Search this space...")

  await term.fill("narwhal")

  await expect(page.getByText("No results found.")).toBeVisible()

  await term.fill("kraken")

  await expect(page.getByText("Last 24 Hours")).toBeVisible()
  await expect(page.getByText("Last 7 Days")).toBeVisible()
  await expect(page.getByText("Older")).toBeVisible()

  await expect(page.getByText("the kraken surfaced at dawn")).toBeVisible()
  await expect(page.getByText("ancient kraken lore, volume one")).toBeVisible()

  const fromRandom = page.getByRole("button").filter({hasText: "kraken jokes only in here"})

  await expect(fromRandom).toContainText("Random")

  await fromRandom.click()

  await expect(page).toHaveURL(/\/spaces\/space\.test\/random\?at=/)
})
