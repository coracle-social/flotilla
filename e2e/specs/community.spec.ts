import * as nip19 from "nostr-tools/nip19"
import {DAY, HOUR, MINUTE, bech32ToHex, int} from "@welshman/lib"
import {
  MESSAGE,
  POLL_RESPONSE,
  getAddress,
  getLnUrl,
  tagSpec,
  tagValues,
  toMsats,
} from "@welshman/util"
import type {SignedEvent} from "@welshman/util"
import {ClientMessageType} from "@welshman/net"
import {
  Pin,
  Pinboard,
  Poll,
  PollResponse,
  Profile,
  TimeEvent,
  ZapGoal,
  ZapReceipt,
  ZapRequest,
} from "@welshman/domain"
import type {Locator, Page} from "@playwright/test"
import {
  GIF,
  dialog,
  emojiButton,
  expect,
  getTranscript,
  longDate,
  makeTestUser,
  menuButton,
  mockDufflepud,
  modalForm,
  noteEditor,
  pickEmoji,
  roomPath,
  spacePath,
  test,
  users,
} from "../harness"
import type {TestUser} from "../harness"

// A handle to a seeded event, which only reads once seed() has drained its queue.
type Seeded = {readonly id: string; readonly event: SignedEvent}

// A shelf card carries its cover, its counts and its menu, so the menu is reached through it.
const shelfCard = (page: Page, title: string) =>
  page.locator('[data-component="PinboardItem"]').filter({hasText: title})

// Button swallows both the default and the propagation of a click, and the middle of a card is one.
const openCard = (card: Locator, title: string) => card.getByText(title).click()

// PollOption renders an option as a small card carrying its label, its count and its progress bar.
const pollOption = (page: Page, label: string) => page.locator(".card-sm").filter({hasText: label})

// A multiple choice vote goes out once the delay window closes, so "both publish" is visible here.
const pollResponses = (page: Page, pollId: string) =>
  getTranscript(page.context())
    .filter(
      ({direction, message}) =>
        direction === "toRelay" &&
        message[0] === ClientMessageType.Event &&
        message[1].kind === POLL_RESPONSE &&
        tagValues(tagSpec("e"), message[1].tags).includes(pollId),
    )
    .map(({message}) => tagValues(tagSpec("response"), message[1].tags))

const PARTY = "🎉"

const pickParty = (page: Page, opener: Locator) => pickEmoji(page, opener, "party popper")

test("US-046 create and browse a calendar event", async ({seed, as}) => {
  const scenario = await seed(({relay, user, at}) => {
    const space = relay("space")

    space.room("general", {name: "General"})
    space.join(user.alice, "general")
    space.join(user.bob, "general")
    space.profile(user.alice, {name: "Alice Anderson"})
    space.profile(user.bob, {name: "Bob Barker"})

    // at() counts backwards from the moment the test started, so a negative count is the future.
    space.event(
      user.bob,
      () =>
        space
          .kind(TimeEvent)
          .writer()
          .setIdentifier("autumn-fair")
          .setTitle("Autumn Fair")
          .setStart(at(-3, DAY))
          .setEnd(at(-3, DAY) + int(1, HOUR))
          .setContent("Autumn Fair happens here.")
          .renderTemplate(),
      at(1, HOUR),
    )
  })

  const {url} = scenario.space("space")
  const page = await as(users.alice, `${spacePath(url)}/calendar`)

  await page.getByRole("button", {name: "Agenda", exact: true}).click()

  const card = (title: string) => page.getByRole("link").filter({hasText: title})

  await expect(card("Autumn Fair")).toBeVisible()

  await page.getByRole("button", {name: "Create", exact: true}).click()

  const composer = modalForm(page, "Create an Event")

  // Field renders its label and input as siblings, so the writable fields are taken in document order.
  const textInputs = composer.locator('input[type="text"]:not([readonly])')
  const title = textInputs.first()
  const location = textInputs.last()
  const dates = composer.getByPlaceholder("Select dates")

  await title.fill("Winter Market")
  await location.fill("Town Hall")

  // The picker takes two clicks for a range, each at the time its own time input carries.
  const target = new Date()

  target.setMonth(target.getMonth() + 1, 15)
  target.setHours(12, 0, 0, 0)

  await dates.click()
  await composer.getByRole("button", {name: "Next month"}).click()
  await composer.getByRole("button", {name: "15", exact: true}).click()
  await composer.getByRole("button", {name: "15", exact: true}).click()

  await expect(dates).not.toHaveValue("")

  await composer.getByRole("button", {name: "Save Event"}).click()

  await expect(page.getByRole("heading", {name: "Create an Event"})).toHaveCount(0)

  const market = card("Winter Market")

  await expect(market).toBeVisible()
  await expect(market).toContainText(await longDate(page, Math.floor(target.getTime() / 1000)))
})

test("US-047 manage your own calendar event", async ({seed, as}) => {
  const scenario = await seed(({relay, user, at}) => {
    const space = relay("space")

    space.room("general", {name: "General"})
    space.join(user.alice, "general")
    space.join(user.bob, "general")
    space.profile(user.alice, {name: "Alice Anderson"})
    space.profile(user.bob, {name: "Bob Barker"})

    const addEvent = (author: TestUser, d: string, name: string, place: string) =>
      space.event(
        author,
        () =>
          space
            .kind(TimeEvent)
            .writer()
            .setIdentifier(d)
            .setTitle(name)
            .setLocation(place)
            .setStart(at(-2, DAY))
            .setEnd(at(-2, DAY) + int(2, HOUR))
            .setContent("Bring a dish to share.")
            .renderTemplate(),
        at(1, HOUR),
      )

    addEvent(user.alice, "harvest-supper", "Harvest Supper", "The Old Mill")
    addEvent(user.bob, "quiz-night", "Quiz Night", "The Anchor")
  })

  const {url} = scenario.space("space")
  const calendarPath = `${spacePath(url)}/calendar`
  const page = await as(users.alice, calendarPath)

  await openCard(page.getByRole("link").filter({hasText: "Harvest Supper"}), "Harvest Supper")

  // The hero card is always the first feature card on the page; the About tab renders one below it.
  const eventCard = page.locator(".card.z-feature").first()

  await expect(page.getByRole("heading", {name: "Harvest Supper", exact: true})).toBeVisible()
  await expect(eventCard).toContainText("The Old Mill")

  await menuButton(eventCard).click()
  await page.getByRole("button", {name: "Edit Event"}).click()

  const composer = modalForm(page, "Edit this Event")
  const textInputs = composer.locator('input[type="text"]:not([readonly])')

  await expect(textInputs.first()).toHaveValue("Harvest Supper")

  await textInputs.first().fill("Harvest Supper & Ceilidh")
  await textInputs.last().fill("The Village Hall")
  await composer.getByRole("button", {name: "Save Event"}).click()

  await expect(page.getByRole("heading", {name: "Edit this Event"})).toHaveCount(0)
  await expect(page.getByRole("heading", {name: "Harvest Supper & Ceilidh"})).toBeVisible()
  await expect(eventCard).toContainText("The Village Hall")

  await menuButton(eventCard).click()
  await page.getByRole("button", {name: "Delete Event"}).click()

  const confirmDelete = page.getByRole("button", {name: "Confirm"})

  await confirmDelete.click()

  // The confirmation stays up until the retraction is out.
  await expect(confirmDelete).toHaveCount(0)

  await page.goto(calendarPath)

  await expect(page.getByRole("link").filter({hasText: "Quiz Night"})).toBeVisible()
  await expect(page.getByRole("link").filter({hasText: "Harvest Supper"})).toHaveCount(0)
})

test("US-048 create a poll and vote on it", async ({seed, as}) => {
  let snacks!: Seeded

  const scenario = await seed(({relay, user, at}) => {
    const space = relay("space")

    space.room("general", {name: "General"})
    space.join(user.alice, "general")
    space.join(user.bob, "general")
    space.profile(user.alice, {name: "Alice Anderson"})
    space.profile(user.bob, {name: "Bob Barker"})

    // A wire assertion needs option ids known up front, so this one is a fixture.
    snacks = space.event(
      user.alice,
      () =>
        space
          .kind(Poll)
          .writer()
          .setTitle("Which snacks should we order?")
          .setPollType("multiplechoice")
          .addOption("Chips", "snack-chips")
          .addOption("Salsa", "snack-salsa")
          .addOption("Olives", "snack-olives")
          .setUrls([space.url])
          .renderTemplate(),
      at(2, HOUR),
    )
  })

  const {url} = scenario.space("space")
  const alice = await as(users.alice, `${spacePath(url)}/polls`)

  await alice.getByRole("button", {name: "Create", exact: true}).click()

  const composer = modalForm(alice, "Create a Poll")

  await composer.getByPlaceholder("What would you like to ask?").fill("Where should we meet?")
  await composer.getByPlaceholder("Option 1").fill("The park")
  await composer.getByPlaceholder("Option 2").fill("The pub")
  await composer.getByRole("button", {name: "Create Poll"}).click()

  await expect(alice.getByRole("heading", {name: "Create a Poll"})).toHaveCount(0)

  const meetup = alice.getByRole("link").filter({hasText: "Where should we meet?"})

  await expect(meetup).toBeVisible()

  await openCard(meetup, "Where should we meet?")

  await expect(alice.getByRole("heading", {name: "Where should we meet?"})).toBeVisible()

  await pollOption(alice, "The park").getByRole("radio").check()

  await expect(pollOption(alice, "The park")).toContainText("1 vote")

  const pollPath = new URL(alice.url()).pathname
  const bob = await as(users.bob, pollPath)

  // Alice's vote reached bob over the wire, and his comes back to her without a reload.
  await expect(pollOption(bob, "The park")).toContainText("1 vote")

  await pollOption(bob, "The pub").getByRole("radio").check()

  await expect(pollOption(alice, "The pub")).toContainText("1 vote")

  // Two boxes checked inside the delay window go out as one vote for both.
  await alice.goto(`${spacePath(url)}/polls/${snacks.id}`)

  await pollOption(alice, "Chips").getByRole("checkbox").check()
  await pollOption(alice, "Salsa").getByRole("checkbox").check()

  await expect(pollOption(alice, "Chips")).toContainText("1 vote")
  await expect(pollOption(alice, "Salsa")).toContainText("1 vote")
  await expect.poll(() => pollResponses(alice, snacks.id)).toEqual([["snack-chips", "snack-salsa"]])
})

test("US-049 a closed poll shows final results only", async ({seed, as}) => {
  let closed!: Seeded

  const scenario = await seed(({relay, user, at}) => {
    const space = relay("space")

    space.room("general", {name: "General"})
    space.join(user.alice, "general")
    space.join(user.bob, "general")
    space.join(user.carol, "general")
    space.profile(user.alice, {name: "Alice Anderson"})
    space.profile(user.bob, {name: "Bob Barker"})
    space.profile(user.carol, {name: "Carol Chen"})

    const poll = space.event(
      user.alice,
      () =>
        space
          .kind(Poll)
          .writer()
          .setTitle("What colour should the shed be?")
          .setPollType("singlechoice")
          .addOption("Blue", "shed-blue")
          .addOption("Green", "shed-green")
          .setEndsAt(at(3, HOUR))
          .setUrls([space.url])
          .renderTemplate(),
      at(5, HOUR),
    )

    for (const voter of [user.bob, user.carol]) {
      space.event(
        voter,
        () =>
          space
            .kind(PollResponse)
            .writer()
            .setPollId(poll.id)
            .addSelection("shed-blue")
            .renderTemplate(),
        at(4, HOUR),
      )
    }

    closed = poll
  })

  const {url} = scenario.space("space")
  const page = await as(users.alice, `${spacePath(url)}/polls/${closed.id}`)

  // The votes already cast still count, and there is nothing left to vote with.
  await expect(pollOption(page, "Blue")).toContainText("2 votes")
  await expect(page.locator("input[type=radio]")).toHaveCount(0)
})

test("US-050 create a funding goal and track its progress", async ({seed, as}) => {
  // A receipt is only counted once the lnurl endpoint answers with the zapper that signed it.
  const lud16 = "bob@zap.test"
  const lnurl = getLnUrl(lud16)!
  // A zap receipt is signed by the recipient's lightning provider rather than by either party.
  const provider = makeTestUser("zapper")

  let soundproofing!: Seeded

  const scenario = await seed(({relay, user, at}) => {
    const space = relay("space")

    space.room("general", {name: "General"})
    space.join(user.alice, "general")
    space.join(user.bob, "general")
    space.member(provider)
    space.profile(user.alice, {name: "Alice Anderson"})
    space.event(user.bob, () =>
      space.kind(Profile).writer().update({name: "Bob Barker", lud16}).renderTemplate(),
    )

    soundproofing = space.event(
      user.bob,
      () =>
        space
          .kind(ZapGoal)
          .writer()
          .setTitle("Soundproofing")
          .setSummary("The neighbours have opinions about band practice.")
          .setAmount(toMsats(20000))
          .setUrls([space.url])
          .renderTemplate(),
      at(30, HOUR),
    )

    // A receipt whose invoice disagrees with the amount its request asked for is thrown away.
    const contribute = (from: TestUser, sats: number, createdAt: number) =>
      space.event(
        provider,
        async () => {
          const request = await from.signer.sign({
            ...(await space
              .kind(ZapRequest)
              .writer()
              .setAmount(toMsats(sats))
              .setLnurl(lnurl)
              .setRecipient(user.bob.pubkey)
              .setEvent(soundproofing.event)
              .renderTemplate()),
            created_at: createdAt,
          })

          // What was paid is read out of the invoice's human-readable part, where an `n` is a tenth of a sat.
          return space
            .kind(ZapReceipt)
            .writer()
            .setBolt11(`lnbc${sats * 10}n1p${from.name}`)
            .setDescription(JSON.stringify(request))
            .setRecipient(user.bob.pubkey)
            .setEventId(soundproofing.id)
            .renderTemplate()
        },
        createdAt,
      )

    contribute(user.alice, 1000, at(20, HOUR))
    contribute(user.carol, 500, at(10, HOUR))
  })

  const {url} = scenario.space("space")
  const page = await as(users.alice, `${spacePath(url)}/goals`)

  await page.getByRole("button", {name: "Create", exact: true}).click()

  const composer = modalForm(page, "Create a Funding Goal")

  await composer.getByPlaceholder("What do funds go towards?").fill("Repair the roof")
  await noteEditor(composer).pressSequentially("Three tiles came off in the storm.")
  await composer.locator('input[type="number"]').fill("5000")
  await composer.getByRole("button", {name: "Create Goal"}).click()

  await expect(page.getByRole("heading", {name: "Create a Funding Goal"})).toHaveCount(0)

  const roof = page.getByRole("link").filter({hasText: "Repair the roof"})

  await expect(roof).toBeVisible()

  await openCard(roof, "Repair the roof")

  // Amounts are localized, so the thousands separator is the environment's to decide.
  await expect(page.locator(".card.z-feature").filter({hasText: /of 5,?000 sats/})).toBeVisible()

  // Registered after the page opened, so it answers ahead of the empty dufflepud `as()` installs.
  await mockDufflepud(page.context(), {
    zappers: [
      {
        lnurl: bech32ToHex(lnurl),
        info: {pubkey: users.bob.pubkey, nostrPubkey: provider.pubkey, allowsNostr: true},
      },
    ],
  })

  await page.goto(`${spacePath(url)}/goals/${soundproofing.id}`)

  const soundCard = page.locator(".card.z-feature").filter({hasText: /of 20,?000 sats/})

  await expect(soundCard.getByText(/^1,?500$/)).toBeVisible()
  await expect(soundCard.getByText("backers", {exact: true}).locator("xpath=..")).toContainText("2")
})

test("US-051 post, edit, and close out a classified listing", async ({seed, as}) => {
  const scenario = await seed(({relay, user}) => {
    const space = relay("space")

    space.room("general", {name: "General"})
    space.join(user.alice, "general")
    space.profile(user.alice, {name: "Alice Anderson"})
  })

  const {url} = scenario.space("space")
  const classifiedsPath = `${spacePath(url)}/classifieds`
  const page = await as(users.alice, classifiedsPath, {
    blossom: {server: url.replace(/^wss:/, "https:")},
  })

  await page.getByRole("button", {name: "Create", exact: true}).click()

  const composer = modalForm(page, "Create a Classified Listing")
  const topics = composer.getByPlaceholder("Add topics...")

  await composer.getByPlaceholder("What is this listing for?").fill("Vintage Road Bike")
  await noteEditor(composer).pressSequentially("Steel frame, new tires, barely ridden.")
  await composer.locator('input[type="number"]').fill("1200")
  await topics.fill("bicycles")
  await topics.press("Enter")

  await composer
    .locator('input[type="file"]')
    .setInputFiles({name: "bike.gif", mimeType: "image/gif", buffer: GIF})

  await expect(composer.getByAltText("Upload preview")).toBeVisible()

  await composer.getByRole("button", {name: "Save Listing"}).click()

  await expect(page.getByRole("heading", {name: "Create a Classified Listing"})).toHaveCount(0)

  const listing = page.getByRole("link").filter({hasText: "Vintage Road Bike"})

  await expect(listing).toBeVisible()
  // The card groups thousands, and which separator depends on the browser locale.
  await expect(listing).toContainText(/1[,.\s]?200/)
  await expect(listing).toContainText("#bicycles")
  await expect(listing.locator('img[src^="https://space.test/"]')).toBeVisible()

  await openCard(listing, "Vintage Road Bike")

  const detail = page.locator(".card.z-feature").filter({hasText: "Vintage Road Bike"})

  await menuButton(detail).click()
  await page.getByRole("button", {name: "Edit Listing"}).click()

  const editor = modalForm(page, "Edit this Listing")

  await expect(editor.getByPlaceholder("What is this listing for?")).toHaveValue(
    "Vintage Road Bike",
  )

  await editor.getByRole("combobox").selectOption("sold")
  await editor.getByRole("button", {name: "Save Listing"}).click()

  await expect(page.getByRole("heading", {name: "Edit this Listing"})).toHaveCount(0)

  await expect(detail.getByText("Sold", {exact: true})).toBeVisible()

  await page.goto(classifiedsPath)

  await expect(listing.getByText("Sold", {exact: true})).toBeVisible()
})

test("US-052 comment on and react to community posts", async ({seed, as}) => {
  const scenario = await seed(({relay, user, at}) => {
    const space = relay("space")

    space.room("general", {name: "General"})
    space.join(user.alice, "general")
    space.join(user.bob, "general")
    space.profile(user.alice, {name: "Alice Anderson"})
    space.profile(user.bob, {name: "Bob Barker"})

    space.event(
      user.alice,
      () =>
        space
          .kind(TimeEvent)
          .writer()
          .setIdentifier("autumn-fair")
          .setTitle("Autumn Fair")
          .setLocation("The Green")
          .setStart(at(-4, DAY))
          .setEnd(at(-4, DAY) + int(4, HOUR))
          .setContent("Stalls, cider and a tug of war.")
          .renderTemplate(),
      at(3, HOUR),
    )
  })

  const {url} = scenario.space("space")
  const calendarPath = `${spacePath(url)}/calendar`
  const bob = await as(users.bob, calendarPath)

  await openCard(bob.getByRole("link").filter({hasText: "Autumn Fair"}), "Autumn Fair")

  // The hero card carries reactions; the description sits in its own card under the About tab.
  const heroCard = bob.locator(".card.z-feature").first()

  await expect(bob.getByText("Stalls, cider and a tug of war.")).toBeVisible()

  await pickParty(bob, emojiButton(heroCard))

  await expect(heroCard.getByRole("button", {name: PARTY})).toBeVisible()

  await bob.getByRole("button", {name: /^Discussion/}).click()
  await bob.getByRole("button", {name: "Add a comment"}).click()

  const reply = bob.locator("form").filter({has: bob.locator(".note-editor")})

  await noteEditor(reply).pressSequentially("Is there parking at The Green?")
  await reply.getByRole("button", {name: "Comment"}).click()

  // The composer holds what was typed until the relay confirms it, so match the comment itself.
  await expect(
    bob.locator('[data-component="Comment"]').filter({hasText: "Is there parking at The Green?"}),
  ).toBeVisible()

  const alice = await as(users.alice, calendarPath)

  await openCard(alice.getByRole("link").filter({hasText: "Autumn Fair"}), "Autumn Fair")

  const alicesHeroCard = alice.locator(".card.z-feature").first()

  await expect(alicesHeroCard.getByRole("button", {name: PARTY})).toBeVisible()

  await alice.getByRole("button", {name: /^Discussion/}).click()

  await expect(alice.getByText("Is there parking at The Green?")).toBeVisible()

  await alice.getByRole("button", {name: "Add a comment"}).click()

  const alicesReply = alice.locator("form").filter({has: alice.locator(".note-editor")})

  await noteEditor(alicesReply).pressSequentially("Yes, in the field behind the pub.")
  await alicesReply.getByRole("button", {name: "Comment"}).click()

  await expect(
    alice
      .locator('[data-component="Comment"]')
      .filter({hasText: "Yes, in the field behind the pub."}),
  ).toBeVisible()
})

test("US-053 browse and search the library", async ({seed, as}) => {
  let gettingStarted!: Seeded

  const scenario = await seed(({relay, user, at}) => {
    const space = relay("space")

    space.room("general", {name: "General"})
    space.join(user.admin, "general")
    space.join(user.alice, "general")
    space.profile(user.admin, {name: "Ada Admin"})
    space.profile(user.alice, {name: "Alice Anderson"})

    gettingStarted = space.event(
      user.admin,
      () =>
        space
          .kind(Pinboard)
          .writer()
          .setIdentifier()
          .setTitle("Getting Started")
          .setDescription("Reading for new members")
          .setCollaborative(true)
          .renderTemplate(),
      at(2, HOUR),
    )

    space.event(
      user.admin,
      () =>
        space
          .kind(Pinboard)
          .writer()
          .setIdentifier()
          .setTitle("Recipes")
          .setDescription("Food and drink from the kitchen")
          .setCollaborative(true)
          .renderTemplate(),
      at(2, HOUR),
    )

    space.event(
      user.admin,
      () =>
        space
          .kind(Pin)
          .writer()
          .setIdentifier()
          .addBoard(getAddress(gettingStarted.event))
          .setTitle("The Handbook")
          .setExternal("https://handbook.test/start-here")
          .renderTemplate(),
      at(1, HOUR),
    )
  })

  const {url} = scenario.space("space")
  const libraryPath = `${spacePath(url)}/library`

  const alice = await as(users.alice, libraryPath)
  const term = alice.getByPlaceholder("Search library...")

  await expect(shelfCard(alice, "Getting Started")).toBeVisible()
  await expect(shelfCard(alice, "Recipes")).toBeVisible()

  // A card says how much is on a shelf before anyone opens it.
  await expect(shelfCard(alice, "Getting Started")).toContainText("1 link")
  await expect(shelfCard(alice, "Recipes")).toContainText("0 links")

  // A term matches a shelf on its description as well as its title.
  await term.fill("new members")

  await expect(shelfCard(alice, "Getting Started")).toBeVisible()
  await expect(shelfCard(alice, "Recipes")).toHaveCount(0)

  // A term also reaches past the shelves into the links on them.
  await term.fill("handbook")

  await expect(alice.getByRole("heading", {name: "1 link matches that"})).toBeVisible()

  await term.fill("")

  await alice.getByRole("link", {name: "Getting Started", exact: true}).click()

  await expect(alice.getByRole("heading", {name: "Getting Started"})).toBeVisible()
  await expect(alice.getByText("The Handbook")).toBeVisible()

  // A shelf that already holds a link still offers a way to add another.
  await expect(alice.getByRole("button", {name: "Add a link"})).toBeVisible()

  await alice.goto(libraryPath)

  // An empty shelf says so rather than drawing a blank page.
  await alice.getByRole("link", {name: "Recipes", exact: true}).click()

  await expect(alice.getByText("This shelf doesn't have any links yet.")).toBeVisible()

  // The library is the whole space's, so an ordinary member is offered the same controls.
  await alice.goto(libraryPath)

  await expect(alice.getByRole("button", {name: "Create Shelf"})).toBeVisible()

  // A shelf is edited from its own page, and someone else's is hers to add to and not to rewrite.
  await alice.getByRole("link", {name: "Recipes", exact: true}).click()
  await alice.getByRole("button", {name: "Shelf options"}).click()

  await expect(alice.getByRole("button", {name: "Edit shelf"})).toHaveCount(0)

  // Deleting is offered and says why it is refused, rather than going missing.
  await alice.getByRole("button", {name: "Delete shelf"}).click()

  await expect(dialog(alice, "You can't delete this shelf")).toContainText(
    "or an admin of this space, can delete it",
  )
})

test("US-054 curate the library", async ({seed, as}) => {
  let poll!: Seeded
  let message!: Seeded

  const scenario = await seed(({relay, user, at}) => {
    const space = relay("space")

    space.room("general", {name: "General"})
    space.join(user.admin, "general")
    space.join(user.bob, "general")
    space.profile(user.admin, {name: "Ada Admin"})
    space.profile(user.bob, {name: "Bob Barker"})

    message = space.message(user.bob, "general", "the deploy broke again", at(30, MINUTE))

    poll = space.event(
      user.bob,
      () =>
        space
          .kind(Poll)
          .writer()
          .setTitle("Should we move standup to 10?")
          .setPollType("singlechoice")
          .addOption("Yes", "standup-yes")
          .addOption("No", "standup-no")
          .setUrls([space.url])
          .renderTemplate(),
      at(2, HOUR),
    )
  })

  const {url} = scenario.space("space")
  const libraryPath = `${spacePath(url)}/library`
  const pollPath = `${spacePath(url)}/polls/${poll.id}`

  // An ordinary member curates, signing through an extension, which clones what it is handed.
  const page = await as(users.bob, libraryPath, {nip07: users.bob})

  const pollCard = page
    .locator(".card.z-feature")
    .filter({hasText: "Should we move standup to 10?"})

  await page.getByRole("button", {name: "Create Shelf"}).click()

  const shelfForm = dialog(page, "Create Shelf")

  await shelfForm.getByPlaceholder("Shelf title").fill("Reading List")
  await shelfForm.getByPlaceholder("What's this shelf about?").fill("Things worth reading")
  await shelfForm.getByPlaceholder("Add a topic...").fill("reading")
  await shelfForm.getByPlaceholder("Add a topic...").press("Enter")
  await shelfForm.getByRole("button", {name: "Save changes"}).click()

  // Creating a shelf drops its author straight onto it.
  await expect(page.getByRole("heading", {name: "Reading List"})).toBeVisible()
  await expect(page.getByText("#reading")).toBeVisible()

  // Each link goes in on its own and becomes a card of its own.
  const nevent = nip19.neventEncode({id: message.id, kind: MESSAGE, relays: [url]})

  for (const link of ["https://handbook.test/style-guide", `nostr:${nevent}`]) {
    await page.getByRole("button", {name: "Add a link"}).click()

    const links = dialog(page, "Add a Link")

    await links.getByLabel("Link", {exact: true}).fill(link)
    await links.getByRole("button", {name: "Add link"}).click()
    await expect(links).toHaveCount(0)
  }

  await expect(page.locator('a[href="https://handbook.test/style-guide"]')).toBeVisible()
  await expect(page.getByText("the deploy broke again")).toBeVisible()

  // Renaming a link republishes the pin the menu was opened from.
  const styleGuide = page
    .locator('[data-component="PinItem"]')
    .filter({hasText: "handbook.test/style-guide"})

  await menuButton(styleGuide).click()
  await page.getByRole("button", {name: "Edit Link"}).click()

  const linkEdit = dialog(page, "Edit Link")

  await linkEdit.getByLabel("Title", {exact: true}).fill("House style guide")
  await linkEdit.getByRole("button", {name: "Save changes"}).click()

  await expect(page.getByRole("alert")).toContainText("Link updated!")
  await expect(page.getByText("House style guide")).toBeVisible()

  // Editing the shelf from its menu updates the page it was edited from.
  await page.getByRole("button", {name: "Shelf options"}).click()
  await page.getByRole("button", {name: "Edit shelf"}).click()

  const shelfEdit = dialog(page, "Edit Shelf")

  await shelfEdit.getByPlaceholder("What's this shelf about?").fill("Things worth reading twice")
  await shelfEdit.getByRole("button", {name: "Save changes"}).click()

  await expect(page.getByText("Things worth reading twice")).toBeVisible()

  // A post filed from its own menu lands on the shelf that was picked for it.
  await page.goto(pollPath)
  await menuButton(pollCard).click()
  await page.getByRole("button", {name: "Add to Library"}).click()
  await page.getByRole("button", {name: /Reading List/}).click()

  const fromPoll = dialog(page, "Add a Link")

  await fromPoll.getByLabel("Title", {exact: true}).fill("Standup poll")
  await fromPoll.getByRole("button", {name: "Add link"}).click()

  await expect(page.getByRole("alert")).toContainText("Link added!")

  await page.goto(libraryPath)

  await expect(shelfCard(page, "Reading List")).toContainText("3 links")

  await page.getByRole("link", {name: "Reading List", exact: true}).click()

  await expect(page.getByText("Standup poll")).toBeVisible()
  await expect(page.getByText("Should we move standup to 10?")).toBeVisible()

  // Deleting a shelf from its own page takes it off the library and puts its curator back there.
  await page.getByRole("button", {name: "Shelf options"}).click()
  await page.getByRole("button", {name: "Delete shelf"}).click()
  await page.getByRole("button", {name: "Confirm"}).click()

  await expect(page).toHaveURL(libraryPath)
  await expect(shelfCard(page, "Reading List")).toHaveCount(0)
})

test("US-137 discuss a shelf and a link on it", async ({seed, as}) => {
  let shelf!: Seeded

  const scenario = await seed(({relay, user, at}) => {
    const space = relay("space")

    space.room("general", {name: "General"})
    space.join(user.admin, "general")
    space.join(user.alice, "general")
    space.profile(user.admin, {name: "Ada Admin"})
    space.profile(user.alice, {name: "Alice Anderson"})

    shelf = space.event(
      user.admin,
      () =>
        space
          .kind(Pinboard)
          .writer()
          .setIdentifier()
          .setTitle("Getting Started")
          .setDescription("Reading for new members")
          .setCollaborative(true)
          .renderTemplate(),
      at(2, HOUR),
    )

    space.event(
      user.admin,
      () =>
        space
          .kind(Pin)
          .writer()
          .setIdentifier()
          .addBoard(getAddress(shelf.event))
          .setTitle("The Handbook")
          .setExternal("https://handbook.test/start-here")
          .renderTemplate(),
      at(1, HOUR),
    )
  })

  const {url} = scenario.space("space")
  const alice = await as(users.alice, `${spacePath(url)}/library`)

  await alice.getByRole("link", {name: "Getting Started", exact: true}).click()

  // A link carries a discussion of its own, so asking about one happens where it sits.
  await alice.getByRole("button", {name: "Discuss"}).click()

  const detail = dialog(alice, "Link")

  // The link's own title stands where the heading was, so nothing says "Link" twice.
  await expect(detail.getByText("The Handbook")).toBeVisible()

  await detail.getByRole("button", {name: "Comment"}).click()

  const linkComment = detail.locator("form")

  await noteEditor(linkComment).pressSequentially("Is this still the current version?")
  await linkComment.getByRole("button", {name: "Comment"}).click()

  await expect(
    detail
      .locator('[data-component="Comment"]')
      .filter({hasText: "Is this still the current version?"}),
  ).toBeVisible()

  await detail.getByRole("button", {name: "Close dialog"}).click()

  // The card counts it, so the next person can see there is something to read.
  await expect(alice.getByRole("button", {name: "1 comment"})).toBeVisible()

  // The shelf has one too, for anything about the collection rather than about one link.
  await alice.getByRole("button", {name: "Add a comment"}).click()

  const shelfComment = alice.locator("form").filter({has: alice.locator(".note-editor")})

  await noteEditor(shelfComment).pressSequentially("Should we split this in two?")
  await shelfComment.getByRole("button", {name: "Comment"}).click()

  await expect(
    alice.locator('[data-component="Comment"]').filter({hasText: "Should we split this in two?"}),
  ).toBeVisible()
})

test("US-138 manage a shelf as a list", async ({seed, as}) => {
  let readingList!: Seeded

  const scenario = await seed(({relay, user, at}) => {
    const space = relay("space")

    space.room("general", {name: "General"})
    space.join(user.bob, "general")
    space.profile(user.bob, {name: "Bob Barker"})

    readingList = space.event(
      user.bob,
      () =>
        space
          .kind(Pinboard)
          .writer()
          .setIdentifier()
          .setTitle("Reading List")
          .setCollaborative(true)
          .renderTemplate(),
      at(3, HOUR),
    )

    space.event(
      user.bob,
      () =>
        space
          .kind(Pinboard)
          .writer()
          .setIdentifier()
          .setTitle("Archive")
          .setCollaborative(true)
          .renderTemplate(),
      at(3, HOUR),
    )

    for (const [title, href] of [
      ["The Handbook", "https://handbook.test/start-here"],
      ["The Style Guide", "https://handbook.test/style-guide"],
    ]) {
      space.event(
        user.bob,
        () =>
          space
            .kind(Pin)
            .writer()
            .setIdentifier()
            .addBoard(getAddress(readingList.event))
            .setTitle(title)
            .setExternal(href)
            .renderTemplate(),
        at(1, HOUR),
      )
    }
  })

  const {url} = scenario.space("space")
  const libraryPath = `${spacePath(url)}/library`
  const page = await as(users.bob, libraryPath)

  await page.getByRole("link", {name: "Reading List", exact: true}).click()
  await page.getByRole("button", {name: "List"}).click()

  await page.getByRole("checkbox", {name: "Select The Handbook"}).check()
  await page.getByRole("checkbox", {name: "Select The Style Guide"}).check()

  await expect(page.getByText("2 selected")).toBeVisible()

  // Moving files them on the destination and takes them off here, in one action.
  await page.getByRole("button", {name: "Bulk actions"}).click()
  await page.getByRole("button", {name: "Move to Archive"}).click()

  await expect(page.getByRole("alert")).toContainText("2 moved.")
  await expect(page.getByRole("button", {name: "The Handbook"})).toHaveCount(0)

  await page.goto(libraryPath)

  await expect(shelfCard(page, "Reading List")).toContainText("0 links")
  await expect(shelfCard(page, "Archive")).toContainText("2 links")

  // Select all reaches everything on the shelf, and deleting for everyone asks first.
  await page.getByRole("link", {name: "Archive", exact: true}).click()
  await page.getByRole("button", {name: "List"}).click()
  await page.getByRole("checkbox", {name: "Select all"}).check()

  await expect(page.getByText("2 selected")).toBeVisible()

  await page.getByRole("button", {name: "Bulk actions"}).click()
  await page.getByRole("button", {name: "Delete links"}).click()
  await page.getByRole("button", {name: "Confirm"}).click()

  await expect(page.getByRole("alert")).toContainText("2 deleted.")
})

test("US-139 see who built a shelf and where its links point", async ({seed, as}) => {
  let shelf!: Seeded
  let message!: Seeded

  const scenario = await seed(({relay, user, at}) => {
    const space = relay("space")

    space.room("general", {name: "General"})
    space.join(user.admin, "general")
    space.join(user.alice, "general")
    space.profile(user.admin, {name: "Ada Admin"})
    space.profile(user.alice, {name: "Alice Anderson"})

    message = space.message(user.alice, "general", "the anchor came loose again", at(30, MINUTE))

    shelf = space.event(
      user.admin,
      () =>
        space
          .kind(Pinboard)
          .writer()
          .setIdentifier()
          .setTitle("Field Notes")
          .setCollaborative(true)
          .renderTemplate(),
      at(3, HOUR),
    )

    space.event(
      user.admin,
      () =>
        space
          .kind(Pin)
          .writer()
          .setIdentifier()
          .addBoard(getAddress(shelf.event))
          .setTitle("The Handbook")
          .setExternal("https://handbook.test/start-here")
          .renderTemplate(),
      at(2, HOUR),
    )

    // A link to a post carries no words of its own, so the post is all the row has to show.
    space.event(
      user.alice,
      () =>
        space
          .kind(Pin)
          .writer()
          .setIdentifier()
          .addBoard(getAddress(shelf.event))
          .setEvent(message.id, space.url)
          .renderTemplate(),
      at(1, HOUR),
    )
  })

  const {url} = scenario.space("space")
  const libraryPath = `${spacePath(url)}/library`
  const alice = await as(users.alice, libraryPath)

  await alice.getByRole("link", {name: "Field Notes", exact: true}).click()

  // A card embeds the post it points at, which is also proof the post has loaded.
  await expect(alice.getByText("the anchor came loose again")).toBeVisible()

  await alice.getByRole("button", {name: "List"}).click()

  const untitled = alice
    .locator('[data-component="PinList"] > div')
    .filter({hasText: "Untitled link"})
  const pointer = untitled.getByRole("button", {name: /^nevent1/})

  // A row names a post the way the rest of the app does, rather than printing its bech32.
  await expect(pointer).toHaveText(/^nevent1[a-z0-9]{9}…$/)

  await pointer.click()

  await expect(alice).toHaveURL(new RegExp(`${roomPath(url, "general")}\\?`))
  await expect(alice.getByText("the anchor came loose again")).toBeVisible()

  await alice.goBack()

  // Whoever made the shelf or added to it is a contributor, and the header opens the roster.
  await alice.getByRole("button", {name: /2 contributors/}).click()

  const contributors = dialog(alice, "Contributors")

  await expect(contributors.getByText("Ada Admin")).toBeVisible()
  await expect(contributors.getByText("Alice Anderson")).toBeVisible()

  // A name in the roster is a way through to that person.
  await contributors.getByRole("button", {name: "Ada Admin", exact: true}).click()

  await expect(dialog(alice, "Profile details")).toBeVisible()
})

test("US-055 create community content from a room", async ({seed, as}) => {
  const scenario = await seed(({relay, user}) => {
    const space = relay("space")

    space.room("lounge", {name: "Lounge"})
    space.join(user.alice, "lounge")
    space.profile(user.alice, {name: "Alice Anderson"})
  })

  const {url} = scenario.space("space")
  const page = await as(users.alice, roomPath(url, "lounge"))

  const compose = page.locator("form").filter({has: page.locator(".chat-editor")})

  await compose.locator(".join").getByRole("button").nth(1).click()
  await page.getByRole("button", {name: "Ask a Question", exact: true}).click()

  const composer = modalForm(page, "Create a Poll")

  await composer.getByPlaceholder("What would you like to ask?").fill("Pizza or tacos?")
  await composer.getByPlaceholder("Option 1").fill("Pizza")
  await composer.getByPlaceholder("Option 2").fill("Tacos")
  await composer.getByRole("button", {name: "Create Poll"}).click()

  await expect(page.getByRole("heading", {name: "Create a Poll"})).toHaveCount(0)

  // A room item is itself a role=button wrapping its content, so the quote is the inner of the two.
  const quote = page.getByRole("button").filter({hasText: "Pizza or tacos?"}).last()

  await expect(quote).toBeVisible()

  await quote.click()

  await expect(page).toHaveURL(new RegExp(`${spacePath(url)}/polls/[0-9a-f]{64}$`))
  await expect(page.getByRole("heading", {name: "Pizza or tacos?"})).toBeVisible()
})
