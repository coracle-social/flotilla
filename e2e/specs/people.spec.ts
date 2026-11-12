import {createHash} from "node:crypto"
import type {Locator, Page} from "@playwright/test"
import {HOUR, now, uniq} from "@welshman/lib"
import {FOLLOWS, NOTE, STATUS, makeEvent} from "@welshman/util"
import {Profile} from "@welshman/domain"
import {
  DEFAULT_BLOSSOM_ORIGIN,
  GIF,
  WEBP,
  dialog,
  expect,
  getPublished,
  getPublishedEvents,
  mockBlossom,
  noteEditor,
  profilePath,
  spacePath,
  test,
  toast,
  topDialog,
  users,
} from "../harness"

// The Reputation and Spaces panels only exist above tailwind's xl breakpoint, where 1280 sits.
const DESKTOP = {viewport: {width: 1440, height: 900}}

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
  const scenario = await seed(({relay, user}) => {
    const space = relay("space")

    space.room("general", {name: "General"})
    space.join(user.alice, "general")
    space.join(user.bob, "general")
    space.profile(user.bob, {name: "Bob Barnacle"})
    space.relayList(user.alice)
    space.relayList(user.bob)
  })

  const {url} = scenario.space("space")
  const page = await as(users.alice, profilePath(users.bob.pubkey), {context: DESKTOP})
  const follow = page.getByRole("button", {name: "Follow", exact: true})
  const unfollow = page.getByRole("button", {name: "Unfollow", exact: true})

  await expect(follow).toBeVisible()

  await follow.click()

  await expect(unfollow).toBeVisible()

  // A kind 3 replaces only a kind 3 older than it, so the two writes need separate seconds.
  const followedAt = now()

  while (now() === followedAt) {
    await page.waitForTimeout(50)
  }

  await unfollow.click()

  await expect(follow).toBeVisible()

  // The label flips on the optimistic write, so the frame can still be in flight after it.
  await expect.poll(() => getPublishedEvents(page.context(), FOLLOWS).length).toBe(2)

  // The dialog is how most of the app reaches a profile, so the control has to be there too.
  await page.goto(`${spacePath(url)}/about`)

  const preview = page
    .locator(".card.card-interactive")
    .filter({hasText: "Bob Barnacle"})
    .locator("button[aria-label]")
    .first()

  await preview.click()

  const profile = dialog(page, "Profile details")

  await profile.getByRole("button", {name: "Follow", exact: true}).click()

  await expect(profile.getByRole("button", {name: "Unfollow", exact: true})).toBeVisible()
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

  await expect(toast(page)).toContainText("Your post has been published!")
  await expect(notes(page).filter({hasText: post})).toBeVisible()

  await toast(page).getByRole("button", {name: "View it"}).click()

  await expect(dialog(page, "Note")).toContainText(post)

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

  const feed = page.getByRole("region", {name: "Recent"})

  await feed.getByRole("button", {name: "Create post"}).click()

  await expect(topDialog(page).getByText("Create a Public Post")).toBeVisible()
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
    .getByPlaceholder("Search for profiles or paste a pubkey...")
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

  // The page is about one person, so it says he is muted rather than listing his notes collapsed.
  await expect(pageContent(page).getByText("You have muted this person.")).toBeVisible()
  await expect(list).toHaveCount(0)

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
