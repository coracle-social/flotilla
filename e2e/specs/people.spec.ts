import {createHash} from "node:crypto"
import type {Locator, Page} from "@playwright/test"
import {nprofileEncode, npubEncode} from "nostr-tools/nip19"
import {HOUR, MINUTE, MONTH} from "@welshman/lib"
import {NOTE, makeEvent} from "@welshman/util"
import type {SignedEvent} from "@welshman/util"
import {FollowList, Note, PinList, Profile, RelayList} from "@welshman/domain"
import {expect, makeTestUser, mockBlossom, spacePath, test, users} from "../harness"
import type {SeededSpace, TestUser} from "../harness"

// A handle to a seeded event, which only reads once seed() has drained its queue.
type Seeded = {readonly id: string; readonly event: SignedEvent}

// The profile page keeps its Reputation and Spaces panels in a sidebar that only exists above
// tailwind's xl breakpoint, and the default 1280 viewport sits exactly on it.
const DESKTOP = {viewport: {width: 1440, height: 900}}

const CLIPBOARD = {...DESKTOP, permissions: ["clipboard-read", "clipboard-write"]}

// Where an upload lands. Both the avatar picker and the banner picker call into uploadFile with no
// relay of their own, so the blossom probe is skipped and VITE_DEFAULT_BLOSSOM_SERVERS is used.
const BLOSSOM_ORIGIN = "https://blossom.primal.net"

// A 1x1 gif and a 1x1 webp. compressFileForUpload passes both formats through untouched rather
// than re-encoding them through a canvas, so the bytes the server hashes are the bytes chosen
// here and the url an upload resolves to is predictable from node.
const GIF = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64")
const WEBP = Buffer.from("UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==", "base64")

// uploadFile appends the extension when the descriptor's url carries none, which the mock's never
// does.
const uploadedUrl = (body: Buffer, extension: string) =>
  `${BLOSSOM_ORIGIN}/${createHash("sha256").update(body).digest("hex")}.${extension}`

const profilePath = (user: TestUser) => `/people/${npubEncode(user.pubkey)}`

// displayPubkey in @welshman/domain: the npub with its middle taken out.
const shortNpub = (user: TestUser) => {
  const npub = npubEncode(user.pubkey)

  return npub.slice(0, 8) + "…" + npub.slice(-5)
}

// The page's own region, so an assertion about an avatar isn't satisfied by the copy of it the
// nav renders.
const pageContent = (page: Page) => page.locator(".page__content")

// ProfileTrust and ProfileSharedSpaces are rendered twice — stacked for narrow viewports, and in
// the sidebar — so anything said about them is scoped to the copy that is actually on screen.
const sidebar = (page: Page) => page.locator("aside")

// A modal is a `.dialog` overlay wrapping a `.dialog` card, and the card is the one with the
// content in it.
const dialog = (page: Page) => page.locator(".dialog").last()

// Search is a dialog the nav opens rather than a page of its own.
const openSearch = (page: Page) => page.locator('.primary-nav button[data-tip="Search"]').click()

const searchTerm = (page: Page) => page.getByPlaceholder("Search your spaces...")

const searchResults = (page: Page) => dialog(page).locator(".card.card-interactive")

const notes = (page: Page) => pageContent(page).locator(".cv.card")

const readClipboard = (page: Page) => page.evaluate(() => navigator.clipboard.readText())

// The "..." menu on a profile header, which is the only ghost circle button the page renders.
const profileMenu = (page: Page) => page.locator("button.button-circle.button-ghost")

// PeopleItem renders its link twice, once for each breakpoint; the wide one comes first.
const viewProfile = (card: Locator) => card.getByRole("link", {name: "View Profile"}).first()

// Outbox routing resolves everything about a person through their relay list, so a seeded fixture
// is only loadable by somebody else once its author has one.
const seedRelayList = (space: SeededSpace, user: TestUser) =>
  space.event(user, () =>
    space
      .kind(RelayList)
      .writer()
      .setReadUrls([space.url])
      .setWriteUrls([space.url])
      .renderTemplate(),
  )

test("US-074 find a person", async ({seed, as}) => {
  // Sixty of them, so that the ten the dialog lists are visibly the best matches rather than
  // everyone who matched.
  const searchers = Array.from({length: 60}, (_, i) => makeTestUser(`searcher-${i}`))
  const searcherName = (i: number) => `Searcher ${String(i).padStart(2, "0")}`
  const searcherAvatar = (i: number) => `https://images.test/searcher-${i}.png`
  const about = [
    "Deck crew on the northern run.",
    "Splices rope, keeps the log, argues about knots.",
    "Ask about the time the compass froze solid.",
    "Answers to a whistle and to nothing else.",
  ].join("\n")

  const scenario = await seed(({relay, user}) => {
    const space = relay("space")

    space.room("general", {name: "General"})
    space.join(user.alice, "general")
    space.join(user.bob, "general")

    // Bob is the one person whose name shares no token with the others, so narrowing the term is
    // visibly a filter rather than a reordering.
    space.profile(user.bob, {
      name: "Bob Barnacle",
      about: "Dockside cook and keeper of the ship's cat.",
    })

    seedRelayList(space, user.bob)

    for (const [i, searcher] of searchers.entries()) {
      space.member(searcher)
      space.profile(searcher, {name: searcherName(i), about, picture: searcherAvatar(i)})
    }
  })

  const page = await as(users.alice, spacePath(scenario.space("space").url), {context: DESKTOP})
  const term = searchTerm(page)
  const cards = searchResults(page)

  await openSearch(page)
  await term.fill("Searcher")

  // Which of them ranks first is fuse's business, so a result is described by what every
  // result carries rather than by which one it turned out to be.
  const first = cards.first()

  await expect(first).toBeVisible()
  await expect(first.locator('img[src^="https://images.test/searcher-"]')).toBeVisible()
  await expect(first).toContainText(/Searcher \d\d/)
  await expect(first).toContainText("Deck crew on the northern run.")

  await expect.poll(() => cards.count()).toBe(10)

  // Narrowing the term filters the list rather than reordering it.
  await term.fill("Barnacle")

  const bobCard = cards.filter({hasText: "Bob Barnacle"})

  await expect(bobCard).toHaveCount(1)
  await expect(cards.filter({hasText: /Searcher \d\d/})).toHaveCount(0)

  await viewProfile(bobCard).click()

  await expect(page).toHaveURL(new RegExp(`${profilePath(users.bob)}$`))
  await expect(page.getByRole("heading", {name: "Bob Barnacle"})).toBeVisible()
})

test("US-075 view someone's profile", async ({seed, as}) => {
  const avatar = "https://images.test/bob-avatar.png"
  const banner = "https://images.test/bob-banner.png"

  const scenario = await seed(({relay, user}) => {
    const space = relay("space")
    const other = relay("other")

    space.room("general", {name: "General"})
    space.join(user.alice, "general")
    space.join(user.bob, "general")

    // A second space alice does not belong to, so "Member" is a claim about the overlap rather
    // than about every space bob is in.
    other.room("lounge", {name: "Lounge"})
    other.join(user.bob, "lounge")

    space.event(user.bob, () =>
      space
        .kind(Profile)
        .writer()
        .setName("Bob Barnacle")
        .setAbout("Deckhand, dockside cook, and keeper of the ship's cat.")
        .setPicture(avatar)
        .setBanner(banner)
        .setWebsite("bobbarnacle.example")
        .renderTemplate(),
    )

    seedRelayList(space, user.bob)

    // Carol belongs to no space at all, which is what the panel's empty state is about.
    space.member(user.carol)
    space.profile(user.carol, {name: "Carol Cutter"})
    seedRelayList(space, user.carol)
  })

  const space = scenario.space("space")
  const other = scenario.space("other")
  const page = await as(users.alice, profilePath(users.bob), {context: CLIPBOARD})
  const region = pageContent(page)

  await expect(page.getByRole("heading", {name: "Bob Barnacle"})).toBeVisible()
  // The header renders the avatar twice, one size per breakpoint; the wide one is second.
  await expect(region.locator(`img[src="${avatar}"]`).last()).toBeVisible()
  await expect(region.locator(`img[src="${banner}"]`)).toBeVisible()
  await expect(region.getByText("Deckhand, dockside cook")).toBeVisible()

  const npub = region.getByText(shortNpub(users.bob))

  await expect(npub).toBeVisible()

  await npub.locator("xpath=following-sibling::button").click()

  await expect(page.getByRole("alert")).toContainText("Copied to clipboard!")
  await expect.poll(() => readClipboard(page)).toBe(npubEncode(users.bob.pubkey))

  await expect(region.getByRole("link", {name: "bobbarnacle.example"})).toHaveAttribute(
    "href",
    "https://bobbarnacle.example",
  )

  const spaces = sidebar(page).locator(".card.card-sm").filter({hasText: "Spaces"})
  const spaceLink = spaces.locator(`a[href="${spacePath(space.url)}"]`)
  const otherLink = spaces.locator(`a[href="${spacePath(other.url)}"]`)

  await expect(spaces.locator(".badge").first()).toHaveText("2")
  await expect(spaceLink).toContainText("Member")
  await expect(otherLink).toBeVisible()
  await expect(otherLink.locator(".badge").filter({hasText: "Member"})).toHaveCount(0)

  await spaceLink.click()

  await expect(page).toHaveURL(new RegExp(spacePath(space.url)))

  await page.goto(profilePath(users.carol))

  await expect(page.getByRole("heading", {name: "Carol Cutter"})).toBeVisible()
  await expect(sidebar(page).getByText("No spaces found.")).toBeVisible()
})

test("US-076 follow and unfollow", async ({seed, as}) => {
  await seed(({relay, user}) => {
    const space = relay("space")

    space.room("general", {name: "General"})
    space.join(user.alice, "general")
    space.join(user.bob, "general")
    space.profile(user.bob, {name: "Bob Barnacle"})
    seedRelayList(space, user.alice)
    seedRelayList(space, user.bob)
  })

  const page = await as(users.alice, profilePath(users.bob), {context: DESKTOP})
  const follow = page.getByRole("button", {name: "Follow", exact: true})
  const unfollow = page.getByRole("button", {name: "Unfollow", exact: true})

  await expect(follow).toBeVisible()

  await follow.click()

  // The same page, still on the same url: the label flips where it stands.
  await expect(unfollow).toBeVisible()
  await expect(follow).toHaveCount(0)
  await expect(page).toHaveURL(new RegExp(`${profilePath(users.bob)}$`))

  await unfollow.click()

  await expect(follow).toBeVisible()
  await expect(unfollow).toHaveCount(0)
})

test("US-077 see web-of-trust standing build up", async ({seed, as}) => {
  const carolAvatar = "https://images.test/carol-avatar.png"

  const scenario = await seed(({relay, user}) => {
    const space = relay("space")

    space.room("general", {name: "General"})
    space.join(user.alice, "general")
    space.join(user.bob, "general")
    space.join(user.carol, "general")
    space.profile(user.bob, {name: "Bob Barnacle", about: "Dockside cook."})
    space.profile(user.carol, {name: "Carol Cutter", about: "Sailmaker.", picture: carolAvatar})
    seedRelayList(space, user.alice)
    seedRelayList(space, user.bob)
    seedRelayList(space, user.carol)

    // Carol already follows bob, so alice following carol is the one thing that has to happen
    // through the ui for his standing to move.
    space.event(user.carol, () =>
      space.kind(FollowList).writer().follow(user.bob.pubkey).renderTemplate(),
    )
  })

  // Every hop here is a link click rather than a navigation, so the follow alice publishes stays
  // in the client that published it.
  const page = await as(users.alice, spacePath(scenario.space("space").url), {context: DESKTOP})
  const term = searchTerm(page)
  const cards = searchResults(page)
  const bobCard = cards.filter({hasText: "Bob Barnacle"})
  const carolCard = cards.filter({hasText: "Carol Cutter"})
  const reputation = () => sidebar(page).locator(".card.card-sm").filter({hasText: "Reputation"})

  // The trust ring beside a name: a circle whose dash offset shrinks as the ring fills in.
  const ring = async () =>
    Number(await bobCard.locator("circle.wot-highlight").getAttribute("stroke-dashoffset"))

  await openSearch(page)
  await term.fill("Barnacle")

  await expect(bobCard).toHaveCount(1)
  await expect(bobCard.locator("circle.wot-highlight")).toBeAttached()

  const emptyRing = await ring()

  await viewProfile(bobCard).click()

  await expect(page).toHaveURL(new RegExp(`${profilePath(users.bob)}$`))
  // Word-bounded: a plain "0 / 100" is also a substring of "10 / 100" and "20 / 100", which are
  // exactly the readings this is supposed to rule out.
  await expect(reputation()).toContainText(/\b0 \/ 100\b/)
  await expect(reputation()).toContainText("This user is not well known in your network.")

  await openSearch(page)
  await term.fill("Cutter")

  await expect(carolCard).toHaveCount(1)

  await viewProfile(carolCard).click()

  await expect(page).toHaveURL(new RegExp(`${profilePath(users.carol)}$`))

  await page.getByRole("button", {name: "Follow", exact: true}).click()

  await expect(page.getByRole("button", {name: "Unfollow", exact: true})).toBeVisible()

  await openSearch(page)
  await term.fill("Barnacle")

  await expect(bobCard).toHaveCount(1)
  await expect.poll(ring).toBeLessThan(emptyRing)

  await viewProfile(bobCard).click()

  await expect(reputation()).toContainText("Followed by 1+ people in your network.")
  await expect(reputation()).toContainText("1 person you follow also follows Bob Barnacle.")
  await expect(reputation().locator(`img[src="${carolAvatar}"]`)).toBeVisible()
})

test("US-078 edit your own profile", async ({seed, as}) => {
  const oldAvatar = "https://images.test/alice-avatar.png"
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
        .setPicture(oldAvatar)
        .setNip05("alice@flotilla.test")
        .renderTemplate(),
    )
    seedRelayList(space, user.alice)
  })

  const page = await as(users.alice, profilePath(users.alice), {context: DESKTOP})

  await mockBlossom(page.context(), {server: BLOSSOM_ORIGIN})

  const region = pageContent(page)
  const edit = page.getByRole("button", {name: "Edit profile"})

  await expect(edit).toBeVisible()
  await expect(page.getByRole("button", {name: "Follow", exact: true})).toHaveCount(0)
  // Exact, or this would match the nav's "Messages".
  await expect(page.getByRole("button", {name: "Message", exact: true})).toHaveCount(0)

  await edit.click()

  // ProfileEditForm's text inputs, in the order it renders them: nickname, website, nostr address.
  const form = page.locator("form").first()
  const nickname = form.locator('input[type="text"]').first()
  const about = form.locator("textarea")
  const nostrAddress = form.locator('input[type="text"]').nth(2)
  const picker = page.locator('label[aria-label="Drag and drop files here."]')

  await expect(nickname).toHaveValue("Alice Anderson")
  await expect(about).toHaveValue("Ship's navigator.")
  await expect(nostrAddress).toHaveValue("alice@flotilla.test")
  await expect.poll(() => picker.getAttribute("style")).toContain(oldAvatar)

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
  const avatar = "https://images.test/alice-avatar.png"

  let carolNote!: Seeded
  let pinned!: Seeded

  const scenario = await seed(({relay, user, at}) => {
    const space = relay("space")

    space.room("general", {name: "General"})
    space.join(user.alice, "general")
    space.join(user.bob, "general")
    space.join(user.carol, "general")
    space.profile(user.alice, {name: "Alice Anderson", picture: avatar})
    space.profile(user.carol, {name: "Carol Cutter"})
    seedRelayList(space, user.alice)
    seedRelayList(space, user.carol)

    carolNote = space.event(
      user.carol,
      makeEvent(NOTE, {content: "Anyone seen the tide charts?", created_at: at(4, HOUR)}),
    )

    pinned = space.event(
      user.alice,
      makeEvent(NOTE, {content: "PINNED how to read a tide chart", created_at: at(3, HOUR)}),
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

  const {url} = scenario.space("space")
  const page = await as(users.bob, profilePath(users.alice), {context: DESKTOP})
  const list = notes(page)
  const newest = list.filter({hasText: "NEWEST"})

  await expect(newest).toBeVisible()
  await expect(newest.getByText("Alice Anderson")).toBeVisible()
  await expect(newest.locator(`img[src="${avatar}"]`)).toBeVisible()
  // The story asks for a relative timestamp; the app renders formatTimestamp — a short date plus a
  // clock time — the same way every other content item does (thread items, chat items), so that
  // shared convention is what a note's stamp reads as here.
  await expect(newest).toContainText(/\d{1,2}\/\d{1,2}\/\d{2,4}/)

  await expect(list.filter({hasText: "REPLY"})).toHaveCount(0)

  // The pin outranks the newer notes; the rest are newest first.
  await expect(list.first()).toContainText("PINNED")
  await expect(list.nth(1)).toContainText("NEWEST")
  await expect(list.nth(2)).toContainText("MIDDLE")

  // Nothing is scrolled here: the feed keeps widening its window until the page is full, which is
  // what "loads older notes automatically" means.
  await expect(list.filter({hasText: "OLDEST"})).toBeVisible()

  // A note alice publishes while bob is looking. Flotilla has no composer for a kind-1 note, so
  // it goes out through the app's own primitives in her signed-in session, over her socket to the
  // space — which is the half of this the story is about.
  const alice = await as(users.alice, spacePath(url), {context: DESKTOP})

  await alice.evaluate(
    async ([relayUrl, content]) => {
      const {
        app,
        network,
        makeEvent: make,
      } = window as unknown as {
        app: {get(): {user: {sign(template: object): Promise<object>}}}
        network: {get(): {publish(options: {event: object; relays: string[]}): Promise<unknown>}}
        makeEvent(kind: number, values: {content: string}): object
      }

      await network.get().publish({
        event: await app.get().user.sign(make(1, {content})),
        relays: [relayUrl],
      })
    },
    [url, "LIVE straight off the deck"] as const,
  )

  // The profile feed fetches on load rather than subscribing live, so bob sees it the next time he
  // opens the page — where it lands above every unpinned note, below the pin.
  await page.reload()

  await expect(list.filter({hasText: "LIVE"})).toBeVisible()
  await expect(list.nth(1)).toContainText("LIVE")

  // Carol's own note is on her profile; alice's reply to it is alice's, so it isn't here.
  await page.goto(profilePath(users.carol))

  await expect(notes(page).filter({hasText: "Anyone seen the tide charts?"})).toBeVisible()
  await expect(notes(page).filter({hasText: "REPLY"})).toHaveCount(0)
})

test("US-080 preview a profile from anywhere", async ({seed, as}) => {
  const avatar = "https://images.test/bob-avatar.png"

  const scenario = await seed(({relay, user, at}) => {
    const space = relay("space")

    space.room("general", {name: "General"})
    space.join(user.alice, "general")
    space.join(user.bob, "general")
    space.profile(user.bob, {
      name: "Bob Barnacle",
      about: "Deckhand, dockside cook, and keeper of the ship's cat.",
      picture: avatar,
    })
    space.message(user.bob, "general", "the cat has the helm", at(1, HOUR))
    seedRelayList(space, user.bob)
  })

  const {url} = scenario.space("space")
  const page = await as(users.alice, `${spacePath(url)}/directory`, {context: DESKTOP})
  // SpaceMember covers its whole card with one button, whose aria-label is interpolated from
  // `$profiles.display(pubkey).get()` — a plain call, so the label keeps whatever the name was at
  // first render, which is the npub the card falls back to before the profile has loaded. The
  // name it *displays* comes from a store and does update, so the card is found by that.
  const preview = page
    .locator(".card.card-interactive")
    .filter({hasText: "Bob Barnacle"})
    .locator("button[aria-label]")
    .first()

  await expect(preview).toBeVisible()

  await preview.click()

  await expect(dialog(page).getByText("Bob Barnacle")).toBeVisible()
  await expect(dialog(page).locator(`img[src="${avatar}"]`)).toBeVisible()
  await expect(dialog(page).getByText("Deckhand, dockside cook")).toBeVisible()
  await expect(dialog(page).getByText(/Last active/)).toBeVisible()

  await page.keyboard.press("Escape")

  await expect(page.locator(".dialog")).toHaveCount(0)
  await expect(page).toHaveURL(new RegExp(`${spacePath(url)}/directory$`))
  await expect(preview).toBeVisible()

  await preview.click()

  await dialog(page).getByRole("button", {name: "Go back"}).click()

  // Closed, and alice is exactly where she opened it from.
  await expect(page.locator(".dialog")).toHaveCount(0)
  await expect(page).toHaveURL(new RegExp(`${spacePath(url)}/directory$`))
  await expect(preview).toBeVisible()

  await preview.click()
  await page.getByRole("button", {name: "View Full Profile"}).click()

  await expect(page).toHaveURL(new RegExp(`${profilePath(users.bob)}$`))
  await expect(page.getByRole("heading", {name: "Bob Barnacle"})).toBeVisible()
})

test("US-081 inspect and share a profile", async ({seed, as}) => {
  await seed(({relay, user}) => {
    const space = relay("space")

    space.room("general", {name: "General"})
    space.join(user.alice, "general")
    space.join(user.bob, "general")
    space.profile(user.bob, {name: "Bob Barnacle", about: "Dockside cook."})
    seedRelayList(space, user.bob)
  })

  const page = await as(users.alice, profilePath(users.bob), {context: CLIPBOARD})

  await profileMenu(page).click()
  await page.getByRole("button", {name: "Profile Info"}).click()

  await expect(page.getByRole("heading", {name: "Profile Details"})).toBeVisible()

  const info = dialog(page)
  // Each of these is an input and its copy button inside one bordered label, in dialog order.
  const linkField = info.locator("label.input").first()
  const pubkeyField = info.locator("label.input").nth(1)
  const link = linkField.locator('input[type="text"]')
  const pubkey = pubkeyField.locator('input[type="text"]')

  // The profile was signed during this test, so the creation date is today's. A FieldInline puts
  // its value in the div right after its label, which keeps this a claim about the date rather
  // than about anything else in the dialog that happens to carry four digits.
  const createdAt = info
    .locator("label")
    .filter({hasText: "Created At"})
    .locator("xpath=following-sibling::div")

  await expect(createdAt).toContainText(String(new Date().getFullYear()))

  await expect(link).toHaveValue(/^nostr:nprofile1/)
  await expect(pubkey).toHaveValue(npubEncode(users.bob.pubkey))
  await expect(info.locator("pre code")).toContainText("Bob Barnacle")

  await linkField.getByRole("button").click()

  await expect(page.getByRole("alert")).toContainText("Copied to clipboard!")
  await expect.poll(() => readClipboard(page)).toBe(await link.inputValue())

  await pubkeyField.getByRole("button").click()

  await expect.poll(() => readClipboard(page)).toBe(npubEncode(users.bob.pubkey))

  await info.getByRole("button", {name: "Copy"}).click()

  await expect.poll(() => readClipboard(page)).toContain("Bob Barnacle")

  await page.getByRole("button", {name: "Got it"}).click()

  await profileMenu(page).click()
  await page.getByRole("button", {name: "Share"}).click()

  // The menu that opened it is still mounted behind the dialog, and its own items run together as
  // "Share Profile Info", so the dialog's heading is matched exactly.
  await expect(page.getByText("Share Profile", {exact: true})).toBeVisible()

  const share = dialog(page)
  const qr = share.locator("canvas")
  const shareLink = share.locator("input")

  await expect(qr).toBeVisible()
  expect((await qr.boundingBox())?.width ?? 0).toBeGreaterThan(0)

  // pubkeyLink in src/app/env.ts, which shares a profile without relay hints.
  await expect(shareLink).toHaveValue(
    `https://coracle.social/${nprofileEncode({pubkey: users.bob.pubkey, relays: []})}`,
  )

  await share.locator("label.input").getByRole("button").click()

  await expect.poll(() => readClipboard(page)).toBe(await shareLink.inputValue())
})

test("US-082 mute an account", async ({seed, as}) => {
  await seed(({relay, user, at}) => {
    const space = relay("space")

    space.room("general", {name: "General"})
    space.join(user.alice, "general")
    space.join(user.bob, "general")
    space.profile(user.bob, {name: "Bob Barnacle", about: "Dockside cook."})
    seedRelayList(space, user.alice)
    seedRelayList(space, user.bob)

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

  // Typed rather than filled, and slower than the search's own debounce: the suggestion list is
  // rebuilt per keystroke, and the profile it is searching for only arrives from the relay once a
  // pause in the typing has let the query go out.
  await page
    .getByPlaceholder("Search for profiles...")
    .pressSequentially("Bob Barnacle", {delay: 700})

  const suggestion = page.locator(".tiptap-suggestions__item").filter({hasText: "Bob Barnacle"})

  await expect(suggestion).toBeVisible()

  await suggestion.click()

  await expect(badge).toBeVisible()

  await save.click()

  await expect(page.getByRole("alert")).toContainText("Your settings have been saved!")

  // Through the nav rather than a fresh navigation, so what is on screen is what the client that
  // just published the mute believes.
  const openBobsProfile = async () => {
    await openSearch(page)
    await searchTerm(page).fill("Barnacle")

    const card = searchResults(page).filter({hasText: "Bob Barnacle"})

    await expect(card).toHaveCount(1)
    await viewProfile(card).click()
    await expect(page).toHaveURL(new RegExp(`${profilePath(users.bob)}$`))
  }

  await openBobsProfile()

  const list = notes(page)

  await expect(list).toHaveCount(2)
  await expect(list.first()).toContainText("You have muted this person.")
  await expect(list.last()).toContainText("You have muted this person.")
  await expect(pageContent(page).getByText("Salt on the rigging")).toHaveCount(0)

  await list.first().getByRole("button", {name: "Show anyway"}).click()

  await expect(list.first()).toContainText("The gulls have taken the mainsail")
  await expect(list.last()).toContainText("You have muted this person.")

  await page.locator('.primary-nav a[href="/settings/profile"]').click()
  await page.getByRole("link", {name: "Content"}).click()

  await expect(badge).toBeVisible()

  await page.reload()

  await expect(badge).toBeVisible()

  await badge.getByRole("button").first().click()

  await expect(badge).toHaveCount(0)

  await save.click()

  await expect(page.getByRole("alert")).toContainText("Your settings have been saved!")

  await openBobsProfile()

  await expect(list).toHaveCount(2)
  await expect(pageContent(page).getByText("Salt on the rigging this morning")).toBeVisible()
  await expect(pageContent(page).getByText("The gulls have taken the mainsail")).toBeVisible()
  await expect(pageContent(page).getByText("You have muted this person.")).toHaveCount(0)
})
