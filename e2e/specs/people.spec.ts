import {createHash} from "node:crypto"
import type {Locator, Page} from "@playwright/test"
import {npubEncode} from "nostr-tools/nip19"
import {HOUR, MINUTE, MONTH, uniq} from "@welshman/lib"
import {NOTE, PROFILE, STATUS, makeEvent} from "@welshman/util"
import type {SignedEvent} from "@welshman/util"
import {FollowList, Note, PinList, Profile} from "@welshman/domain"
import {
  DEFAULT_BLOSSOM_ORIGIN,
  GIF,
  WEBP,
  expect,
  getPublished,
  getPublishedEvents,
  mockBlossom,
  mockGeocoding,
  noteEditor,
  profilePath,
  spacePath,
  test,
  topDialog,
  users,
} from "../harness"

// A handle to a seeded event, which only reads once seed() has drained its queue.
type Seeded = {readonly id: string; readonly event: SignedEvent}

// The Reputation and Spaces panels only exist above tailwind's xl breakpoint, where 1280 sits.
const DESKTOP = {viewport: {width: 1440, height: 900}}

const CLIPBOARD = {...DESKTOP, permissions: ["clipboard-read", "clipboard-write"]}

// uploadFile appends the extension when the descriptor's url carries none, as the mock's never does.
const uploadedUrl = (body: Buffer, extension: string) =>
  `${DEFAULT_BLOSSOM_ORIGIN}/${createHash("sha256").update(body).digest("hex")}.${extension}`

// The page's own region, so an assertion about an avatar isn't satisfied by the copy the nav renders.
const pageContent = (page: Page) => page.locator(".page__content")

// ProfileTrust and ProfileSharedSpaces are rendered twice, stacked for narrow viewports and here.
const sidebar = (page: Page) => page.locator("aside")

// A space path redirects as the page mounts, and modal.ts closes every open modal on navigation.
const enteredSpace = (page: Page) => expect(page).toHaveURL(new RegExp("/spaces/[^/]+/."))

// Search is a dialog the nav opens rather than a page of its own.
const openSearch = (page: Page) => page.locator('.primary-nav button[data-tip="Search"]').click()

const searchTerm = (page: Page) => page.getByPlaceholder("Search your spaces...")

const searchResults = (page: Page) => topDialog(page).locator(".card.card-interactive")

const notes = (page: Page) => pageContent(page).locator(".cv.card")

const readClipboard = (page: Page) => page.evaluate(() => navigator.clipboard.readText())

// The "..." menu on a profile header, which is the only ghost circle button the page renders.
const profileMenu = (page: Page) => page.locator("button.button-circle.button-ghost")

// PeopleItem renders its link twice, once for each breakpoint; the wide one comes first.
const viewProfile = (card: Locator) => card.getByRole("link", {name: "View Profile"}).first()

test("US-074 find a person", async ({seed, as}) => {
  const scenario = await seed(({relay, user}) => {
    const space = relay("space")

    space.room("general", {name: "General"})
    space.join(user.alice, "general")
    space.join(user.bob, "general")
    space.profile(user.bob, {name: "Bob Barnacle"})
    space.relayList(user.bob)
  })

  const page = await as(users.alice, spacePath(scenario.space("space").url), {context: DESKTOP})
  const bobCard = searchResults(page).filter({hasText: "Bob Barnacle"})

  await enteredSpace(page)
  await openSearch(page)
  await searchTerm(page).fill("Barnacle")

  await expect(bobCard).toHaveCount(1)

  await viewProfile(bobCard).click()

  await expect(page).toHaveURL(new RegExp(`${profilePath(users.bob.pubkey)}$`))
  await expect(page.getByRole("heading", {name: "Bob Barnacle"})).toBeVisible()
})

test("US-075 view someone's profile", async ({seed, as}) => {
  const scenario = await seed(({relay, user, at}) => {
    const space = relay("space")
    const other = relay("other")

    space.room("general", {name: "General"})
    space.join(user.alice, "general")
    space.join(user.bob, "general")

    // A second space alice does not belong to, so "Member" is a claim about the overlap.
    other.room("lounge", {name: "Lounge"})
    other.join(user.bob, "lounge")

    space.event(user.bob, () =>
      space
        .kind(Profile)
        .writer()
        .setName("Bob Barnacle")
        .setAbout("Deckhand, dockside cook, and keeper of the ship's cat.")
        .renderTemplate(),
    )

    space.event(
      user.bob,
      makeEvent(STATUS, {
        content: "Scrubbing the decks",
        tags: [
          ["d", "general"],
          ["r", "https://bobbarnacle.example/decks"],
        ],
      }),
    )

    space.relayList(user.bob)

    space.member(user.carol)
    space.profile(user.carol, {name: "Carol Cutter"})
    // An expired status is one its author asked relays to stop serving.
    space.event(
      user.carol,
      makeEvent(STATUS, {
        content: "Ashore until spring",
        tags: [
          ["d", "general"],
          ["expiration", String(at(1, HOUR))],
        ],
      }),
    )
    space.relayList(user.carol)
  })

  const space = scenario.space("space")
  const other = scenario.space("other")
  const page = await as(users.alice, profilePath(users.bob.pubkey), {context: DESKTOP})
  const region = pageContent(page)

  await expect(page.getByRole("heading", {name: "Bob Barnacle"})).toBeVisible()
  await expect(region.getByText("Deckhand, dockside cook")).toBeVisible()
  await expect(region.getByRole("link", {name: "Scrubbing the decks"})).toHaveAttribute(
    "href",
    "https://bobbarnacle.example/decks",
  )

  const spaces = sidebar(page).locator(".card.card-sm").filter({hasText: "Spaces"})
  const spaceLink = spaces.locator(`a[href="${spacePath(space.url)}"]`)
  const otherLink = spaces.locator(`a[href="${spacePath(other.url)}"]`)

  await expect(spaceLink).toContainText("Member")
  await expect(otherLink).toBeVisible()
  await expect(otherLink).not.toContainText("Member")

  await page.goto(profilePath(users.carol.pubkey))

  await expect(page.getByRole("heading", {name: "Carol Cutter"})).toBeVisible()
  await expect(region.getByText("Ashore until spring")).toHaveCount(0)
})

test("US-076 follow and unfollow", async ({seed, as}) => {
  await seed(({relay, user}) => {
    const space = relay("space")

    space.room("general", {name: "General"})
    space.join(user.alice, "general")
    space.join(user.bob, "general")
    space.profile(user.bob, {name: "Bob Barnacle"})
    space.relayList(user.alice)
    space.relayList(user.bob)
  })

  const page = await as(users.alice, profilePath(users.bob.pubkey), {context: DESKTOP})
  const follow = page.getByRole("button", {name: "Follow", exact: true})
  const unfollow = page.getByRole("button", {name: "Unfollow", exact: true})

  await expect(follow).toBeVisible()

  await follow.click()

  await expect(unfollow).toBeVisible()

  await unfollow.click()

  await expect(follow).toBeVisible()
})

test("US-077 see web-of-trust standing build up", async ({seed, as}) => {
  const scenario = await seed(({relay, user}) => {
    const space = relay("space")

    space.room("general", {name: "General"})
    space.join(user.alice, "general")
    space.join(user.bob, "general")
    space.join(user.carol, "general")
    space.profile(user.bob, {name: "Bob Barnacle", about: "Dockside cook."})
    space.profile(user.carol, {name: "Carol Cutter", about: "Sailmaker."})
    space.relayList(user.alice)
    space.relayList(user.bob)
    space.relayList(user.carol)

    // Carol already follows bob, so alice following carol is the one thing that goes through the ui.
    space.event(user.carol, () =>
      space.kind(FollowList).writer().follow(user.bob.pubkey).renderTemplate(),
    )
  })

  // Every hop here is a link click rather than a navigation, so the follow stays in one client.
  const page = await as(users.alice, spacePath(scenario.space("space").url), {context: DESKTOP})
  const term = searchTerm(page)
  const cards = searchResults(page)
  const bobCard = cards.filter({hasText: "Bob Barnacle"})
  const carolCard = cards.filter({hasText: "Carol Cutter"})
  const reputation = () => sidebar(page).locator(".card.card-sm").filter({hasText: "Reputation"})

  await enteredSpace(page)
  await openSearch(page)
  await term.fill("Barnacle")

  await expect(bobCard).toHaveCount(1)

  await viewProfile(bobCard).click()

  await expect(page).toHaveURL(new RegExp(`${profilePath(users.bob.pubkey)}$`))
  // Word-bounded: a plain "0 / 100" is also a substring of "10 / 100" and "20 / 100".
  await expect(reputation()).toContainText(/\b0 \/ 100\b/)

  await openSearch(page)
  await term.fill("Cutter")

  await expect(carolCard).toHaveCount(1)

  await viewProfile(carolCard).click()

  await expect(page).toHaveURL(new RegExp(`${profilePath(users.carol.pubkey)}$`))

  await page.getByRole("button", {name: "Follow", exact: true}).click()

  await expect(page.getByRole("button", {name: "Unfollow", exact: true})).toBeVisible()

  await openSearch(page)
  await term.fill("Barnacle")

  await expect(bobCard).toHaveCount(1)

  await viewProfile(bobCard).click()

  await expect(reputation()).toContainText("Followed by 1+ people in your network.")
})

test("US-078 edit your own profile", async ({seed, as}) => {
  const newAvatar = uploadedUrl(WEBP, "webp")
  const newBanner = uploadedUrl(GIF, "gif")

  await seed(({relay, user}) => {
    const space = relay("space")

    space.room("general", {name: "General"})
    space.join(user.alice, "general")
    space.event(user.alice, () =>
      space
        .kind(Profile)
        .writer()
        .setName("Alice Anderson")
        .setAbout("Ship's navigator.")
        .renderTemplate(),
    )
    space.relayList(user.alice)
  })

  const page = await as(users.alice, profilePath(users.alice.pubkey), {context: DESKTOP})

  await mockBlossom(page.context(), {server: DEFAULT_BLOSSOM_ORIGIN})

  const region = pageContent(page)
  const edit = page.getByRole("button", {name: "Edit profile"})

  await edit.click()

  const form = page.locator("form").first()
  const nickname = form.getByRole("textbox", {name: "Nickname"})
  const about = form.locator("textarea")
  const picker = page.locator('label[aria-label="Drag and drop files here."]')

  await expect(nickname).toHaveValue("Alice Anderson")

  await nickname.fill("Alice Anchor")
  await about.fill("Ship's navigator and part-time cartographer.")
  await page.getByRole("button", {name: "Save Changes"}).click()

  await expect(page.getByRole("alert")).toContainText("Your profile has been updated!")
  await expect(page.getByRole("heading", {name: "Alice Anchor"})).toBeVisible()
  await expect(region.getByText("part-time cartographer")).toBeVisible()

  await edit.click()

  const avatarChooser = page.waitForEvent("filechooser")

  await picker.click()
  await (
    await avatarChooser
  ).setFiles({
    name: "avatar.webp",
    mimeType: "image/webp",
    buffer: WEBP,
  })

  await expect.poll(() => picker.getAttribute("style")).toContain(newAvatar)

  await page.getByRole("button", {name: "Save Changes"}).click()

  await expect(region.locator(`img[src="${newAvatar}"]`).last()).toBeVisible()

  const bannerChooser = page.waitForEvent("filechooser")

  await page.getByRole("button", {name: "Change banner"}).click()
  await (await bannerChooser).setFiles({name: "banner.gif", mimeType: "image/gif", buffer: GIF})

  await expect(page.getByRole("alert")).toContainText("Banner updated.")
  await expect(region.locator(`img[src="${newBanner}"]`)).toBeVisible()
})

test("US-079 read a person's notes", async ({seed, as}) => {
  let carolNote!: Seeded
  let pinned!: Seeded

  await seed(({relay, user, at}) => {
    const space = relay("space")

    space.room("general", {name: "General"})
    space.join(user.alice, "general")
    space.join(user.bob, "general")
    space.join(user.carol, "general")
    space.profile(user.alice, {name: "Alice Anderson"})
    space.profile(user.carol, {name: "Carol Cutter"})
    space.relayList(user.alice)
    space.relayList(user.carol)

    carolNote = space.event(
      user.carol,
      makeEvent(NOTE, {content: "Anyone seen the tide charts?", created_at: at(4, HOUR)}),
    )

    // Older than the feed's first window, so the pin is fetched by id while the feed only pages to it.
    pinned = space.event(
      user.alice,
      makeEvent(NOTE, {content: "PINNED how to read a tide chart", created_at: at(2, MONTH)}),
    )

    space.event(
      user.alice,
      makeEvent(NOTE, {content: "MIDDLE rigging notes from this morning", created_at: at(2, HOUR)}),
    )

    space.event(
      user.alice,
      makeEvent(NOTE, {content: "NEWEST the wind has finally turned", created_at: at(1, HOUR)}),
    )

    // Older than the window the feed opens with, so reaching it is the feed paging backwards.
    space.event(
      user.alice,
      makeEvent(NOTE, {content: "OLDEST from the spring refit", created_at: at(8, MONTH)}),
    )

    // A reply to carol, which a profile's note list leaves out.
    space.event(
      user.alice,
      () =>
        space
          .kind(Note)
          .writer()
          .setParent(carolNote.event)
          .setContent("REPLY they are in the chart drawer")
          .renderTemplate(),
      at(90, MINUTE),
    )

    space.event(user.alice, () =>
      space.kind(PinList).writer().pinPublicly(["e", pinned.id]).renderTemplate(),
    )
  })

  const page = await as(users.bob, profilePath(users.alice.pubkey), {context: DESKTOP})
  const list = notes(page)

  await expect(list.filter({hasText: "NEWEST"})).toBeVisible()
  await expect(list.filter({hasText: "MIDDLE"})).toBeVisible()

  // The pin outranks the newer notes.
  await expect(list.first()).toContainText("PINNED")
  await expect(list.filter({hasText: "PINNED"})).toHaveCount(1)

  // Nothing is scrolled here: the feed keeps widening its window until the page is full.
  await expect(list.filter({hasText: "OLDEST"})).toBeVisible()
  await expect(list.filter({hasText: "REPLY"})).toHaveCount(0)
})

test("US-134 write a public post", async ({seed, as}) => {
  const post = "the wind has finally turned"

  const scenario = await seed(({relay, user}) => {
    const space = relay("space")
    const other = relay("other")

    space.room("general", {name: "General"})
    space.join(user.alice, "general")
    space.profile(user.alice, {name: "Alice Anderson"})
    space.relayList(user.alice)

    // Her second space is in no relay list of hers, so a post reaching it was routed there as a space.
    other.room("general", {name: "General"})
    other.join(user.alice, "general")
  })

  const page = await as(users.alice, profilePath(users.alice.pubkey), {context: DESKTOP})

  await page.getByRole("button", {name: "Create post"}).click()

  const composer = topDialog(page)

  await expect(composer.getByText("Create a Public Post")).toBeVisible()

  await noteEditor(composer).click()
  await noteEditor(composer).pressSequentially(post)
  await composer.getByRole("button", {name: "Post"}).click()

  await expect(notes(page).filter({hasText: post})).toBeVisible()

  await expect
    .poll(() =>
      uniq(
        getPublished(page.context())
          .filter(({event}) => event.content === post)
          .map(({url}) => url),
      ).sort(),
    )
    .toEqual([scenario.space("other").url, scenario.space("space").url].sort())

  // The same composer is how a post starts from home, out of the feed it posts into.
  await page.goto("/home")

  const network = page
    .locator("section")
    .filter({has: page.getByRole("heading", {name: "Network"})})

  await network.getByRole("button", {name: "Create post"}).click()

  await expect(topDialog(page).getByText("Create a Public Post")).toBeVisible()
})

test("US-080 preview a profile from anywhere", async ({seed, as}) => {
  const scenario = await seed(({relay, user}) => {
    const space = relay("space")

    space.room("general", {name: "General"})
    space.join(user.alice, "general")
    space.join(user.bob, "general")
    space.profile(user.bob, {
      name: "Bob Barnacle",
      about: "Deckhand, dockside cook, and keeper of the ship's cat.",
    })
    space.relayList(user.bob)
  })

  const {url} = scenario.space("space")
  const page = await as(users.alice, `${spacePath(url)}/directory`, {context: DESKTOP})
  // The card's aria-label keeps the npub it fell back to at first render, so it is found by the name.
  const preview = page
    .locator(".card.card-interactive")
    .filter({hasText: "Bob Barnacle"})
    .locator("button[aria-label]")
    .first()

  await expect(preview).toBeVisible()

  await preview.click()

  const profile = page.getByRole("dialog", {name: "Profile details"})

  await expect(profile.getByText("Bob Barnacle")).toBeVisible()
  await expect(profile.getByText("Deckhand, dockside cook")).toBeVisible()

  await page.keyboard.press("Escape")

  // Closed, and alice is exactly where she opened it from.
  await expect(page.locator(".dialog")).toHaveCount(0)
  await expect(page).toHaveURL(new RegExp(`${spacePath(url)}/directory$`))

  await preview.click()
  await page.getByRole("button", {name: "View Full Profile"}).click()

  await expect(page).toHaveURL(new RegExp(`${profilePath(users.bob.pubkey)}$`))
  await expect(page.getByRole("heading", {name: "Bob Barnacle"})).toBeVisible()
})

test("US-081 inspect and share a profile", async ({seed, as}) => {
  await seed(({relay, user}) => {
    const space = relay("space")

    space.room("general", {name: "General"})
    space.join(user.alice, "general")
    space.join(user.bob, "general")
    space.profile(user.bob, {name: "Bob Barnacle", about: "Dockside cook."})
    space.relayList(user.bob)
  })

  const page = await as(users.alice, profilePath(users.bob.pubkey), {context: CLIPBOARD})

  await profileMenu(page).click()
  await page.getByRole("button", {name: "Profile Info"}).click()

  await expect(page.getByRole("heading", {name: "Profile Details"})).toBeVisible()

  const info = topDialog(page)
  // The pubkey and its copy button share the dialog's second bordered label.
  const pubkeyField = info.locator("label.input").nth(1)

  await expect(pubkeyField.locator('input[type="text"]')).toHaveValue(npubEncode(users.bob.pubkey))

  await pubkeyField.getByRole("button").click()

  await expect(page.getByRole("alert")).toContainText("Copied to clipboard!")
  await expect.poll(() => readClipboard(page)).toBe(npubEncode(users.bob.pubkey))

  await page.getByRole("button", {name: "Got it"}).click()

  await profileMenu(page).click()
  await page.getByRole("button", {name: "Share"}).click()

  const share = topDialog(page)

  await expect(share.locator("canvas")).toBeVisible()
  await expect(share.locator("input")).toHaveValue(/nprofile1/)
})

test("US-082 mute an account", async ({seed, as}) => {
  await seed(({relay, user, at}) => {
    const space = relay("space")

    space.room("general", {name: "General"})
    space.join(user.alice, "general")
    space.join(user.bob, "general")
    space.profile(user.bob, {name: "Bob Barnacle", about: "Dockside cook."})
    space.relayList(user.alice)
    space.relayList(user.bob)

    space.event(
      user.bob,
      makeEvent(NOTE, {content: "Salt on the rigging this morning", created_at: at(2, HOUR)}),
    )

    space.event(
      user.bob,
      makeEvent(NOTE, {content: "The gulls have taken the mainsail", created_at: at(1, HOUR)}),
    )
  })

  const page = await as(users.alice, "/settings/content", {context: DESKTOP})
  const badge = page.locator(".badge").filter({hasText: "Bob Barnacle"})
  const save = page.getByRole("button", {name: "Save Changes"})

  // Typed slower than the search's own debounce, since the profile only arrives after a pause.
  await page
    .getByPlaceholder("Search for profiles...")
    .pressSequentially("Bob Barnacle", {delay: 700})

  const suggestion = page.locator(".tiptap-suggestions__item").filter({hasText: "Bob Barnacle"})

  await expect(suggestion).toBeVisible()

  await suggestion.click()

  await expect(badge).toBeVisible()

  await save.click()

  await expect(page.getByRole("alert")).toContainText("Your settings have been saved!")

  // Through the nav rather than a fresh navigation, so this is what the publishing client believes.
  const openBobsProfile = async () => {
    await openSearch(page)
    await searchTerm(page).fill("Barnacle")

    const card = searchResults(page).filter({hasText: "Bob Barnacle"})

    await expect(card).toHaveCount(1)
    await viewProfile(card).click()
    await expect(page).toHaveURL(new RegExp(`${profilePath(users.bob.pubkey)}$`))
  }

  await openBobsProfile()

  const list = notes(page)

  await expect(list).toHaveCount(2)
  await expect(pageContent(page).getByText("Salt on the rigging")).toHaveCount(0)

  await list.first().getByRole("button", {name: "Show anyway"}).click()

  await expect(list.first()).toContainText("The gulls have taken the mainsail")

  await page.goto("/settings/content")

  await expect(badge).toBeVisible()

  await badge.getByRole("button").first().click()

  await expect(badge).toHaveCount(0)

  await save.click()

  await expect(page.getByRole("alert")).toContainText("Your settings have been saved!")

  await openBobsProfile()

  await expect(list).toHaveCount(2)
  await expect(pageContent(page).getByText("Salt on the rigging this morning")).toBeVisible()
  await expect(pageContent(page).getByText("The gulls have taken the mainsail")).toBeVisible()
})

test("US-131 say where you are and find members on a map", async ({seed, as}) => {
  const scenario = await seed(({relay, user}) => {
    const space = relay("space")

    space.room("general", {name: "General"})
    space.join(user.alice, "general")
    space.join(user.bob, "general")
    space.profile(user.alice, {name: "Alice Anders"})

    // Bob shares a town already, so the directory has a pin before alice adds hers.
    space.event(user.bob, () =>
      space
        .kind(Profile)
        .writer()
        .update({name: "Bob Barnacle", location: "Wellington, New Zealand"})
        .addTags(["g", "rbsm1"])
        .renderTemplate(),
    )

    space.relayList(user.alice)
    space.relayList(user.bob)
  })

  const {url} = scenario.space("space")
  const page = await as(users.alice, profilePath(users.alice.pubkey))

  await mockGeocoding(page.context(), [
    {
      type: "city",
      name: "Portland",
      state: "Oregon",
      country: "United States",
      latitude: 45.52345,
      longitude: -122.67621,
    },
    {
      type: "state",
      name: "Oregon",
      country: "United States",
      latitude: 43.93179,
      longitude: -120.76562,
    },
    {
      type: "street",
      name: "Portland Avenue",
      state: "Oregon",
      country: "United States",
      latitude: 45.51,
      longitude: -122.65,
    },
  ])

  const openEditForm = async () => {
    await page.getByRole("button", {name: "Edit profile"}).click()

    return topDialog(page)
  }

  const form = await openEditForm()

  await form.getByPlaceholder("Search for a city").fill("portl")

  // A state is a place to be from; a street is not.
  await expect(form.getByRole("button", {name: "Oregon, United States", exact: true})).toBeVisible()
  await expect(
    form.getByRole("button", {name: "Portland Avenue, Oregon, United States"}),
  ).toHaveCount(0)

  await form.getByRole("button", {name: "Portland, Oregon, United States"}).click()
  await form.getByRole("button", {name: "Save Changes"}).click()

  await expect(page.getByRole("alert")).toContainText("Your profile has been updated!")
  await expect(pageContent(page).getByText("Portland, Oregon, United States")).toBeVisible()

  const published = getPublishedEvents(page.context(), PROFILE)

  expect(JSON.parse(published[0].content).location).toBe("Portland, Oregon, United States")
  expect(published[0].tags).toContainEqual(["g", "c20fb"])

  await page.goto(`${spacePath(url)}/directory`)

  const showMap = page.getByRole("button", {name: "Map"})

  await expect(showMap).toBeVisible()

  await showMap.click()

  const pins = page.locator(".leaflet-marker-icon")

  await expect(pins).toHaveCount(2)

  await pins.and(page.locator('[title="Bob Barnacle"]')).click()

  const profile = page.getByRole("dialog", {name: "Profile details"})

  await expect(profile.getByText("Bob Barnacle")).toBeVisible()
  await expect(profile.getByText("Wellington, New Zealand")).toBeVisible()

  await profile.getByRole("button", {name: "Close dialog"}).click()

  // Searching narrows the map the same way it narrows the list.
  await page.getByPlaceholder("Search people or roles...").fill("Anders")

  await expect(pins).toHaveCount(1)

  await showMap.click()

  await expect(pins).toHaveCount(0)

  // A state is not a pin, so choosing one takes alice off the map.
  await page.goto(profilePath(users.alice.pubkey))

  const secondForm = await openEditForm()

  await expect(secondForm.getByText("Portland, Oregon, United States")).toBeVisible()

  await secondForm.getByRole("button", {name: "Clear location"}).click()
  await secondForm.getByPlaceholder("Search for a city").fill("oreg")
  await secondForm.getByRole("button", {name: "Oregon, United States", exact: true}).click()
  await secondForm.getByRole("button", {name: "Save Changes"}).click()

  await expect(page.getByRole("alert")).toContainText("Your profile has been updated!")

  const republished = getPublishedEvents(page.context(), PROFILE)

  expect(JSON.parse(republished[1].content).location).toBe("Oregon, United States")
  expect(republished[1].tags.map(tag => tag[0])).not.toContain("g")

  await page.goto(`${spacePath(url)}/directory`)
  await page.getByPlaceholder("Search people or roles...").fill("Anders")

  // A state is the member card's to show, since the map cannot.
  await expect(pageContent(page).getByText("Oregon, United States")).toBeVisible()

  // The map is offered whether or not anyone is on it, so an empty one says so.
  await page.getByRole("button", {name: "Map"}).click()

  await expect(pageContent(page).getByText("No locations found.")).toBeVisible()
})
