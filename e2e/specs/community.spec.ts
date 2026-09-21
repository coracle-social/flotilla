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
  Comment,
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

// A shelf is a card and its menu button side by side, so the menu is reached through the wrapper
// the two share.
const shelfCard = (page: Page, title: string) =>
  page.getByRole("button", {name: new RegExp(title)}).locator("xpath=..")

// A list item is one big link, but Button swallows both the default and the propagation of every
// click it handles, and the middle of a card is usually one of those — a poll's radio, a goal's
// zap button, a listing's image. Opening a card by its title lands on inert text instead.
const openCard = (card: Locator, title: string) => card.getByText(title).click()

// One option of a poll, which PollOption renders as a small card carrying its label, its count and
// its progress bar.
const pollOption = (page: Page, label: string) => page.locator(".card-sm").filter({hasText: label})

// The selections of every poll response this page put on the wire, oldest first. A multiple choice
// vote goes out once the delay window closes, so this is where "both publish" is visible.
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

    const addEvent = (title: string, start: number) =>
      space.event(
        user.bob,
        () =>
          space
            .kind(TimeEvent)
            .writer()
            .setIdentifier(title.toLowerCase().replace(/\W+/g, "-"))
            .setTitle(title)
            .setStart(start)
            .setEnd(start + int(1, HOUR))
            .setContent(`${title} happens here.`)
            .renderTemplate(),
        at(1, HOUR),
      )

    // Ten events that have already happened, so the list is taller than the viewport and "opens
    // scrolled to the next upcoming event" is a statement about where it sits rather than about a
    // list that fits on one screen anyway.
    for (let i = 1; i <= 10; i++) {
      addEvent(`Past Meetup ${String(i).padStart(2, "0")}`, at((11 - i) * 4, DAY))
    }

    // at() counts backwards from the moment the test started, so a negative count is the future.
    addEvent("Autumn Fair", at(-3, DAY))
    addEvent("Winter Solstice", at(-10, DAY))
  })

  const {url} = scenario.space("space")
  const page = await as(users.alice, `${spacePath(url)}/calendar`)

  // This story is about the scrollable list spanning past and future events, not the default view
  await page.getByRole("button", {name: "Agenda", exact: true}).click()

  const cards = page.getByRole("link").filter({hasText: "Posted by"})
  const card = (title: string) => page.getByRole("link").filter({hasText: title})

  await expect(cards).toHaveCount(12)

  // The calendar opens on the first event that hasn't happened yet, with the oldest one scrolled
  // out of the way above it.
  await expect(card("Autumn Fair")).toBeInViewport()
  await expect(card("Past Meetup 01")).not.toBeInViewport()

  await page.getByRole("button", {name: "Create", exact: true}).click()

  const composer = modalForm(page, "Create an Event")

  // Field renders its label and its input as siblings rather than wiring them together, so the
  // form's two writable text fields are taken in document order: title, then location. The date
  // range's own input is readonly, which is what leaves those two.
  const textInputs = composer.locator('input[type="text"]:not([readonly])')
  const title = textInputs.first()
  const location = textInputs.last()
  const dates = composer.getByPlaceholder("Select dates")

  await expect(composer).toBeVisible()

  await composer.getByRole("button", {name: "Save Event"}).click()
  await expect(page.getByRole("alert")).toContainText("Please provide a title.")

  await title.fill("Winter Market")
  await location.fill("Town Hall")
  await composer.getByRole("button", {name: "Save Event"}).click()
  await expect(page.getByRole("alert")).toContainText("Please provide start and end times.")

  // The picker takes two clicks for a range: the first is the start, the second the end, each at
  // the time its own time input carries — noon and one, for a range that starts empty.
  const target = new Date()

  target.setMonth(target.getMonth() + 1, 15)
  target.setHours(12, 0, 0, 0)

  await dates.click()
  await composer.getByRole("button", {name: "Next month"}).click()
  await composer.getByRole("button", {name: "15", exact: true}).click()
  await composer.getByRole("button", {name: "15", exact: true}).click()

  await expect(dates).not.toHaveValue("")

  await composer.getByRole("button", {name: "Save Event"}).click()

  await expect(page.getByRole("alert")).toContainText("Your event has been saved!")
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

  const {at} = scenario
  const {url} = scenario.space("space")
  const calendarPath = `${spacePath(url)}/calendar`
  const page = await as(users.alice, calendarPath)

  await openCard(page.getByRole("link").filter({hasText: "Harvest Supper"}), "Harvest Supper")

  // The hero card (date, header, meta, actions) is always the first feature card on the page;
  // the About tab renders its own feature card below it for the description.
  const eventCard = page.locator(".card.z-feature").first()

  await expect(page.getByRole("heading", {name: "Harvest Supper", exact: true})).toBeVisible()
  await expect(eventCard).toContainText(await longDate(page, at(-2, DAY)))
  await expect(eventCard).toContainText("The Old Mill")
  await expect(eventCard).toContainText("Alice Anderson")

  await menuButton(eventCard).click()
  await page.getByRole("button", {name: "Edit Event"}).click()

  const composer = modalForm(page, "Edit this Event")
  const textInputs = composer.locator('input[type="text"]:not([readonly])')

  await expect(textInputs.first()).toHaveValue("Harvest Supper")
  await expect(textInputs.last()).toHaveValue("The Old Mill")
  await expect(composer.getByPlaceholder("Select dates")).not.toHaveValue("")

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

  // The badge is an optimistic local write, so it says nothing about the relay. The confirmation
  // stays up until the retraction has been published, which is what makes it safe to reload.
  await expect(eventCard.getByText("Deleted", {exact: true})).toBeVisible()
  await expect(confirmDelete).toHaveCount(0)

  await page.goto(calendarPath)

  await expect(page.getByRole("link").filter({hasText: "Quiz Night"})).toBeVisible()
  await expect(page.getByRole("link").filter({hasText: "Harvest Supper"})).toHaveCount(0)
})

test("US-048 create a poll and vote on it", async ({seed, as}) => {
  let snacks!: Seeded
  let drinks!: Seeded

  const scenario = await seed(({relay, user, at}) => {
    const space = relay("space")

    space.room("general", {name: "General"})
    space.join(user.alice, "general")
    space.join(user.bob, "general")
    space.profile(user.alice, {name: "Alice Anderson"})
    space.profile(user.bob, {name: "Bob Barker"})

    // The multiple choice half of the story is about voting rather than about creating, and a
    // wire assertion needs option ids known up front, so these two are fixtures.
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

    drinks = space.event(
      user.alice,
      () =>
        space
          .kind(Poll)
          .writer()
          .setTitle("Which drinks should we order?")
          .setPollType("multiplechoice")
          .addOption("Coffee", "drink-coffee")
          .addOption("Tea", "drink-tea")
          .setUrls([space.url])
          .renderTemplate(),
      at(2, HOUR),
    )
  })

  const {url} = scenario.space("space")
  const alice = await as(users.alice, `${spacePath(url)}/polls`)

  await alice.getByRole("button", {name: "Create", exact: true}).click()

  const composer = modalForm(alice, "Create a Poll")
  const question = composer.getByPlaceholder("What would you like to ask?")

  await composer.getByRole("button", {name: "Create Poll"}).click()
  await expect(alice.getByRole("alert")).toContainText("Please provide a title for your poll.")

  await question.fill("Where should we meet?")
  await composer.getByPlaceholder("Option 2").fill("")
  await composer.getByRole("button", {name: "Create Poll"}).click()
  await expect(alice.getByRole("alert")).toContainText("Please provide at least two options.")

  await composer.getByPlaceholder("Option 1").fill("The park")
  await composer.getByPlaceholder("Option 2").fill("The pub")
  await composer.getByRole("button", {name: "Add option"}).click()
  await composer.getByPlaceholder("Option 3").fill("The pier")

  // Dragging the third option onto the second puts it there and pushes the pub down.
  const rows = composer.getByRole("listitem")

  await rows.nth(2).dragTo(rows.nth(1))

  await expect(composer.getByPlaceholder("Option 1")).toHaveValue("The park")
  await expect(composer.getByPlaceholder("Option 2")).toHaveValue("The pier")
  await expect(composer.getByPlaceholder("Option 3")).toHaveValue("The pub")

  await composer.getByRole("button", {name: "Create Poll"}).click()

  await expect(alice.getByRole("heading", {name: "Create a Poll"})).toHaveCount(0)

  const meetup = alice.getByRole("link").filter({hasText: "Where should we meet?"})

  await expect(meetup).toBeVisible()

  await openCard(meetup, "Where should we meet?")

  await expect(alice.getByRole("heading", {name: "Where should we meet?"})).toBeVisible()
  await expect(alice.locator(".card-sm")).toContainText(["The park", "The pier", "The pub"])

  await pollOption(alice, "The park").getByRole("radio").check()

  await expect(pollOption(alice, "The park")).toContainText("1 vote")
  await expect(pollOption(alice, "The park").locator("progress")).toHaveJSProperty("value", 1)

  const pollPath = new URL(alice.url()).pathname
  const bob = await as(users.bob, pollPath)

  // Alice's vote reached bob over the wire, and his comes back to her without a reload.
  await expect(pollOption(bob, "The park")).toContainText("1 vote")

  await pollOption(bob, "The pub").getByRole("radio").check()

  await expect(pollOption(alice, "The pub")).toContainText("1 vote")
  await expect(alice.getByText("2 votes")).toBeVisible()

  // Two boxes checked inside the delay window go out as one vote for both.
  await alice.goto(`${spacePath(url)}/polls/${snacks.id}`)

  await pollOption(alice, "Chips").getByRole("checkbox").check()
  await pollOption(alice, "Salsa").getByRole("checkbox").check()

  await expect(pollOption(alice, "Chips")).toContainText("1 vote")
  await expect(pollOption(alice, "Salsa")).toContainText("1 vote")
  await expect(pollOption(alice, "Olives")).toContainText("0 votes")
  await expect.poll(() => pollResponses(alice, snacks.id)).toEqual([["snack-chips", "snack-salsa"]])

  // Unchecking one before the delay elapses keeps it out of the vote that is finally sent.
  await alice.goto(`${spacePath(url)}/polls/${drinks.id}`)

  await pollOption(alice, "Coffee").getByRole("checkbox").check()
  await pollOption(alice, "Tea").getByRole("checkbox").check()
  await pollOption(alice, "Tea").getByRole("checkbox").uncheck()

  await expect(pollOption(alice, "Coffee")).toContainText("1 vote")
  await expect(pollOption(alice, "Tea")).toContainText("0 votes")
  await expect.poll(() => pollResponses(alice, drinks.id)).toEqual([["drink-coffee"]])
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

  const blue = pollOption(page, "Blue")
  const green = pollOption(page, "Green")

  await expect(page.getByRole("heading", {name: "What colour should the shed be?"})).toBeVisible()

  // Voting is over, and the poll says so in place of the controls that would have taken a vote.
  await expect(page.getByText(/Ended 3 hours ago/)).toBeVisible()
  await expect(page.locator("input[type=radio]")).toHaveCount(0)
  await expect(page.locator("input[type=checkbox]")).toHaveCount(0)

  // The votes already cast still count and still draw.
  await expect(blue).toContainText("2 votes")
  await expect(green).toContainText("0 votes")
  await expect(blue.locator("progress")).toHaveJSProperty("value", 2)
  await expect(blue.locator("progress")).toHaveJSProperty("max", 2)
  await expect(green.locator("progress")).toHaveJSProperty("value", 0)
})

test("US-050 create a funding goal and track its progress", async ({seed, as}) => {
  // The lightning address on bob's profile, and the lnurl endpoint the client resolves it to. A
  // receipt is only counted once that endpoint answers with the zapper that signed it.
  const lud16 = "bob@zap.test"
  const lnurl = getLnUrl(lud16)!
  // A zap receipt is signed by the recipient's lightning provider rather than by either party to
  // the zap, so the provider is an identity of its own — and one zooid will take a write from.
  const provider = makeTestUser("zapper")

  let running!: Seeded
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

    // Two and a half days old, so "how long it has been running" rounds to three whatever second
    // of the run this renders on.
    running = space.event(
      user.bob,
      () =>
        space
          .kind(ZapGoal)
          .writer()
          .setTitle("New PA system")
          .setSummary("The old one hums through every song.")
          .setAmount(toMsats(50000))
          .setUrls([space.url])
          .renderTemplate(),
      at(60, HOUR),
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

    // What a wallet publishes once an invoice is paid: the payer's own zap request carried as the
    // receipt's description, signed by the provider the recipient's lnurl names. A receipt whose
    // invoice disagrees with the amount its request asked for is thrown away by the client, so the
    // two are rendered from the same number.
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

          // What was paid is read straight out of the invoice's human-readable part, where an `n`
          // is a tenth of a sat, so that prefix is all of a bolt11 that has to be real.
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
  const title = composer.getByPlaceholder("What do funds go towards?")
  const amount = composer.locator('input[type="number"]')
  const slider = composer.locator('input[type="range"]')

  await expect(amount).toHaveValue("1000")
  await expect(slider).toHaveValue("1000")

  await composer.getByRole("button", {name: "Create Goal"}).click()
  await expect(page.getByRole("alert")).toContainText(
    "Please provide a title for your funding goal.",
  )

  await title.fill("Repair the roof")
  await composer.getByRole("button", {name: "Create Goal"}).click()
  await expect(page.getByRole("alert")).toContainText(
    "Please provide details about your funding goal.",
  )

  await noteEditor(composer).pressSequentially("Three tiles came off in the storm.")

  // The target answers to the field and to the slider alike.
  await amount.fill("5000")
  await expect(slider).toHaveValue("5000")

  await slider.press("ArrowRight")
  await expect(amount).toHaveValue("6000")

  await composer.getByRole("button", {name: "Create Goal"}).click()

  await expect(page.getByRole("heading", {name: "Create a Funding Goal"})).toHaveCount(0)

  const roof = page.getByRole("link").filter({hasText: "Repair the roof"})

  await expect(roof).toBeVisible()

  await openCard(roof, "Repair the roof")

  // The space bar names the goal alongside the hero, so both carry it as a heading.
  await expect(page.getByRole("heading", {name: "Repair the roof"}).first()).toBeVisible()

  // Amounts are localized, so the thousands separator is the environment's to decide.
  const goalCard = page.locator(".card.z-feature").filter({hasText: /of 6,?000 sats/})

  await expect(goalCard.getByText("0%", {exact: true})).toBeVisible()
  await expect(goalCard.getByText("sats to go", {exact: true}).locator("xpath=..")).toContainText(
    /6,?000/,
  )

  await page.goto(`${spacePath(url)}/goals/${running.id}`)

  const paCard = page.locator(".card.z-feature").filter({hasText: /of 50,?000 sats/})

  await expect(paCard.getByText("backers", {exact: true}).locator("xpath=..")).toContainText("0")
  await expect(paCard.getByText("days running", {exact: true}).locator("xpath=..")).toContainText(
    "3",
  )

  // Registered after the page was opened, so it answers ahead of the empty dufflepud `as()`
  // installs, and before the navigation below, since a zapper is looked up once per page load.
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
  await expect(soundCard.getByText("8%", {exact: true})).toBeVisible()
  await expect(soundCard.getByText("backers", {exact: true}).locator("xpath=..")).toContainText("2")
  await expect(
    soundCard.getByText("days running", {exact: true}).locator("xpath=.."),
  ).toContainText("2")

  // Each backer is named and ranked by what they gave, biggest first.
  const supporters = page
    .locator(".card")
    .filter({has: page.getByRole("heading", {name: "Supporters"})})
    .last()

  await expect(supporters).toContainText("Alice Anderson")
  await expect(supporters.getByText(/^1,?000$/)).toBeVisible()
  await expect(supporters.getByText(/^500$/)).toBeVisible()
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
  const title = composer.getByPlaceholder("What is this listing for?")
  const price = composer.locator('input[type="number"]')
  const currency = composer.locator("button.input")
  const topics = composer.getByPlaceholder("Add topics...")

  await expect(price).toHaveValue("0")
  await expect(currency).toHaveText("SAT (Satoshi)")

  await composer.getByRole("button", {name: "Save Listing"}).click()
  await expect(page.getByRole("alert")).toContainText("Please provide a title for your listing.")

  await title.fill("Vintage Road Bike")
  await composer.getByRole("button", {name: "Save Listing"}).click()
  await expect(page.getByRole("alert")).toContainText(
    "Please provide a description for your listing.",
  )

  await noteEditor(composer).pressSequentially("Steel frame, new tires, barely ridden.")

  await currency.click()
  await currency.locator("input").fill("USD")
  await page.locator('.tiptap-suggestions__item[aria-label="USD"]').click()
  await expect(currency).toHaveText("USD (United States Dollar)")

  await price.fill("1200")

  await topics.fill("bicycles")
  await topics.press("Enter")

  await expect(composer.getByText("#bicycles")).toBeVisible()

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

  await expect(detail).toContainText("1200")

  await menuButton(detail).click()
  await page.getByRole("button", {name: "Edit Listing"}).click()

  const editor = modalForm(page, "Edit this Listing")

  await expect(editor.getByPlaceholder("What is this listing for?")).toHaveValue(
    "Vintage Road Bike",
  )
  await expect(editor.locator('input[type="number"]')).toHaveValue("1200")
  await expect(editor.locator("button.input")).toHaveText("USD (United States Dollar)")
  await expect(editor.getByText("#bicycles")).toBeVisible()
  await expect(editor.getByRole("combobox")).toHaveValue("active")

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
    space.join(user.carol, "general")
    space.profile(user.alice, {name: "Alice Anderson"})
    space.profile(user.bob, {name: "Bob Barker"})
    space.profile(user.carol, {name: "Carol Chen"})

    const fair = space.event(
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

    // Three comments already there, so bob's fills the four the page shows without asking and
    // alice's tips it past them.
    for (let i = 1; i <= 3; i++) {
      space.event(
        user.carol,
        () =>
          space
            .kind(Comment)
            .writer()
            .setRootFromEvent(fair.event)
            .setParentFromEvent(fair.event)
            .setContent(`Question ${String(i).padStart(2, "0")} for the organisers`)
            .renderTemplate(),
        at(3, HOUR) + i * 60,
      )
    }
  })

  const {url} = scenario.space("space")
  const calendarPath = `${spacePath(url)}/calendar`
  const bob = await as(users.bob, calendarPath)

  await openCard(bob.getByRole("link").filter({hasText: "Autumn Fair"}), "Autumn Fair")

  // The hero card carries reactions; the description sits in its own card under the About tab.
  const heroCard = bob.locator(".card.z-feature").first()

  await expect(bob.getByText("Stalls, cider and a tug of war.")).toBeVisible()

  await pickParty(bob, emojiButton(heroCard))

  const bobsPill = heroCard.getByRole("button", {name: PARTY})

  await expect(bobsPill).toHaveCount(1)
  await expect(bobsPill).toHaveClass(/button-primary/)
  await expect(bobsPill).toHaveAttribute("data-tip", "Bob Barker reacted")

  await bob.getByRole("button", {name: /^Discussion/}).click()
  await bob.getByRole("button", {name: "Leave comment"}).click()

  const reply = bob.locator("form").filter({has: bob.locator(".note-editor")})

  await noteEditor(reply).pressSequentially("Is there parking at The Green?")
  await reply.getByRole("button", {name: "Post Reply"}).click()

  await expect(bob.getByText("Is there parking at The Green?")).toBeVisible()

  const alice = await as(users.alice, calendarPath)

  await openCard(alice.getByRole("link").filter({hasText: "Autumn Fair"}), "Autumn Fair")

  const alicesHeroCard = alice.locator(".card.z-feature").first()

  await expect(alicesHeroCard.getByRole("button", {name: PARTY})).toHaveAttribute(
    "data-tip",
    "Bob Barker reacted",
  )

  await alice.getByRole("button", {name: /^Discussion/}).click()

  await expect(alice.getByText("Is there parking at The Green?")).toBeVisible()

  await alice.getByRole("button", {name: "Leave comment"}).click()

  const alicesReply = alice.locator("form").filter({has: alice.locator(".note-editor")})

  await noteEditor(alicesReply).pressSequentially("Yes, in the field behind the pub.")
  await alicesReply.getByRole("button", {name: "Post Reply"}).click()

  // Past four replies the rest are folded away behind a control that names how many there are.
  const showAll = alice.getByRole("button", {name: "Show all 5 replies"})

  await expect(showAll).toBeVisible()
  await expect(alice.getByText("Yes, in the field behind the pub.")).toHaveCount(0)

  await showAll.click()

  await expect(alice.getByText("Question 01 for the organisers")).toBeVisible()
  await expect(alice.getByText("Is there parking at The Green?")).toBeVisible()
  await expect(alice.getByText("Yes, in the field behind the pub.")).toBeVisible()
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
    space.message(user.admin, "general", "welcome to the space", at(2, HOUR))

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

  await expect(alice.getByRole("button", {name: /Getting Started/})).toBeVisible()
  await expect(alice.getByRole("button", {name: /Recipes/})).toBeVisible()

  // A term matches a shelf on its title...
  await term.fill("recipes")

  await expect(alice.getByRole("button", {name: /Recipes/})).toBeVisible()
  await expect(alice.getByRole("button", {name: /Getting Started/})).toHaveCount(0)

  // ...or on its description.
  await term.fill("new members")

  await expect(alice.getByRole("button", {name: /Getting Started/})).toBeVisible()
  await expect(alice.getByRole("button", {name: /Recipes/})).toHaveCount(0)

  await term.fill("")

  await alice.getByRole("button", {name: /Getting Started/}).click()

  await expect(alice.getByText("The Handbook")).toBeVisible()

  await alice.getByRole("button", {name: /Recipes/}).click()

  await expect(alice.getByText("This shelf doesn't have any links yet.")).toBeVisible()

  // The library is the whole space's, so an ordinary member is offered the same controls the
  // shelves were made with.
  await expect(alice.getByRole("button", {name: "Create Shelf"})).toBeVisible()
  await expect(alice.getByRole("button", {name: "Add a link"})).toBeVisible()

  // Someone else's shelf is hers to add to and not to rewrite.
  await shelfCard(alice, "Recipes").getByRole("button", {name: "More options"}).click()

  await expect(alice.getByRole("button", {name: "Add link", exact: true})).toBeVisible()
  await expect(alice.getByRole("button", {name: "Edit shelf"})).toHaveCount(0)
  await expect(alice.getByRole("button", {name: "Delete shelf"})).toHaveCount(0)
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

  // Curating is nobody's privilege here, so this is an ordinary member doing all of it.
  const page = await as(users.bob, pollPath)

  const pollCard = page
    .locator(".card.z-feature")
    .filter({hasText: "Should we move standup to 10?"})

  // With nothing on the shelves yet, the dialog says so and points at where one is made.
  await menuButton(pollCard).click()
  await page.getByRole("button", {name: "Add to Library"}).click()

  await expect(page.getByText("This space doesn't have any shelves yet.")).toBeVisible()
  await expect(page.getByRole("link", {name: "Go to Library"})).toBeVisible()

  await page.goto(libraryPath)

  await page.getByRole("button", {name: "Create Shelf"}).click()

  const shelfForm = dialog(page, "Create Shelf")

  await shelfForm.getByPlaceholder("Shelf title").fill("Reading List")
  await shelfForm.getByPlaceholder("What's this shelf about?").fill("Things worth reading")
  await shelfForm.getByRole("button", {name: "Save changes"}).click()

  // Creating a shelf lists it and drops its author straight into it.
  await expect(page.getByRole("alert")).toContainText("Shelf created!")
  await expect(page).toHaveURL(/[?&]board=/)
  await expect(page.getByRole("button", {name: /Reading List/})).toHaveAttribute(
    "aria-pressed",
    "true",
  )
  await expect(page.getByText("This shelf doesn't have any links yet.")).toBeVisible()

  // An external url becomes a card of its own...
  await page.getByRole("button", {name: "Add a link"}).click()

  const externalLink = dialog(page, "Add Link")

  await externalLink.getByPlaceholder("URL or nevent...").fill("https://handbook.test/style-guide")
  await externalLink.getByPlaceholder("Optional title").fill("The Style Guide")
  await externalLink.getByRole("button", {name: "Add link"}).click()

  await expect(page.getByRole("alert")).toContainText("Link added!")

  const styleGuide = page.locator(".card").filter({hasText: "The Style Guide"})

  await expect(styleGuide).toBeVisible()
  await expect(styleGuide.locator('a[href="https://handbook.test/style-guide"]')).toBeVisible()

  // ...and a nostr link becomes the note it points at.
  const nevent = nip19.neventEncode({id: message.id, kind: MESSAGE, relays: [url]})

  await shelfCard(page, "Reading List").getByRole("button", {name: "More options"}).click()
  await page.getByRole("button", {name: "Add link", exact: true}).click()

  const nostrLink = dialog(page, "Add Link")

  await nostrLink.getByPlaceholder("URL or nevent...").fill(`nostr:${nevent}`)
  await nostrLink.getByPlaceholder("Optional title").fill("Yesterday's incident")
  await nostrLink.getByRole("button", {name: "Add link"}).click()

  const incident = page.locator(".card").filter({hasText: "Yesterday's incident"})

  await expect(incident).toContainText("the deploy broke again")
  await expect(incident).toContainText("Bob Barker")

  // Editing the shelf from its menu updates the list.
  await shelfCard(page, "Reading List").getByRole("button", {name: "More options"}).click()
  await page.getByRole("button", {name: "Edit shelf"}).click()

  const shelfEdit = dialog(page, "Edit Shelf")

  await shelfEdit.getByPlaceholder("What's this shelf about?").fill("Things worth reading twice")
  await shelfEdit.getByRole("button", {name: "Save changes"}).click()

  await expect(page.getByRole("alert")).toContainText("Shelf updated!")
  await expect(page.getByRole("button", {name: /Reading List/})).toContainText(
    "Things worth reading twice",
  )

  // A post filed from its own menu lands on the shelf that was picked for it.
  await page.goto(pollPath)
  await menuButton(pollCard).click()
  await page.getByRole("button", {name: "Add to Library"}).click()
  await page.getByRole("button", {name: /Reading List/}).click()

  const fromPoll = dialog(page, "Add Link")

  await expect(fromPoll.getByPlaceholder("URL or nevent...")).not.toHaveValue("")

  await fromPoll.getByPlaceholder("Optional title").fill("Standup poll")
  await fromPoll.getByRole("button", {name: "Add link"}).click()

  await expect(page.getByRole("alert")).toContainText("Link added!")

  await page.goto(libraryPath)
  await page.getByRole("button", {name: /Reading List/}).click()

  await expect(page.getByText("Standup poll")).toBeVisible()
  await expect(page.getByText("Should we move standup to 10?")).toBeVisible()

  // Deleting the shelf from its menu takes it off the list.
  await shelfCard(page, "Reading List").getByRole("button", {name: "More options"}).click()
  await page.getByRole("button", {name: "Delete shelf"}).click()
  await page.getByRole("button", {name: "Confirm"}).click()

  await expect(page.getByRole("alert")).toContainText("Shelf deleted!")
  await expect(page.getByRole("button", {name: /Reading List/})).toHaveCount(0)
  await expect(page.getByText("No shelves found.")).toBeVisible()
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

  // Everything the room can be given from the composer, named as the menu names it.
  for (const name of [
    "Funding Goal",
    "Calendar Event",
    "Classified Listing",
    "Create Thread",
    "Write an Article",
    "Ask a Question",
  ]) {
    await expect(page.getByRole("button", {name, exact: true})).toBeVisible()
  }

  await page.getByRole("button", {name: "Ask a Question", exact: true}).click()

  const composer = modalForm(page, "Create a Poll")

  await composer.getByPlaceholder("What would you like to ask?").fill("Pizza or tacos?")
  await composer.getByPlaceholder("Option 1").fill("Pizza")
  await composer.getByPlaceholder("Option 2").fill("Tacos")
  await composer.getByRole("button", {name: "Create Poll"}).click()

  await expect(page.getByRole("heading", {name: "Create a Poll"})).toHaveCount(0)

  // The room gets a quote of the poll rather than a second post written by hand. A room item is
  // itself a role=button tap target wrapping its content, so the quote is the inner of the two.
  const quote = page.getByRole("button").filter({hasText: "Pizza or tacos?"}).last()

  await expect(quote).toBeVisible()

  await quote.click()

  await expect(page).toHaveURL(new RegExp(`${spacePath(url)}/polls/[0-9a-f]{64}$`))
  await expect(page.getByRole("heading", {name: "Pizza or tacos?"})).toBeVisible()
  await expect(pollOption(page, "Pizza")).toBeVisible()
  await expect(pollOption(page, "Tacos")).toBeVisible()
})
