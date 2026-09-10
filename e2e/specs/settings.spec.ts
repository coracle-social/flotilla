import {MINUTE} from "@welshman/lib"
import type {Locator, Page} from "@playwright/test"
import {dialog, expect, roomPath, settingToggle, test, toast, topDialog, users} from "../harness"

// A handle to a seeded event, which only reads once seed() has drained its queue.
type Seeded = {readonly id: string}

// The relay picker, which has no heading of its own — and is pushed over the list modal rather
// than alongside it, so it is the only dialog in the dom while it is open.
const relayPicker = (page: Page) => topDialog(page)

const relayCard = (scope: Locator, name: string) => scope.locator(".card").filter({hasText: name})

// A saved setting reaches indexeddb in batches, and a settings page reads its values once when it
// mounts — so a reload only sees the new value after the batch has been flushed. A toast clears
// itself after five seconds, which is longer than the batch window, so waiting it out is what
// makes the assertion that follows about persistence rather than about timing.
const waitForToastToClear = (page: Page) => expect(toast(page)).toHaveCount(0)

test("US-084 block a relay you never want used", async ({seed, as}) => {
  await seed(({relay, user}) => {
    const space = relay("space")

    // A second relay for the picker to offer. Nobody is a member of it — what puts a relay in the
    // suggestion pool is its nip-11 document having been fetched, and every scenario relay is an
    // indexer, so bob's client reads this one at startup.
    relay("other")

    space.room("general", {name: "General"})
    space.join(user.bob, "general")

    space.relayList(user.bob)
  })

  const page = await as(users.bob, "/settings/privacy")
  const blocked = page.getByRole("button", {name: /Blocked$/})

  await expect(blocked).toContainText("0 Blocked")

  await blocked.click()

  await expect(dialog(page, "Blocked Relays").getByText("No relay selections found.")).toBeVisible()

  await dialog(page, "Blocked Relays").getByRole("button", {name: "Add Relays"}).click()
  await relayCard(relayPicker(page), "other.test").getByRole("button", {name: "Add Relay"}).click()
  await page.getByRole("button", {name: "Done"}).click()

  await expect(dialog(page, "Blocked Relays").getByText("other.test")).toBeVisible()

  await dialog(page, "Blocked Relays").getByRole("button", {name: "Go back"}).click()

  await expect(blocked).toContainText("1 Blocked")

  // A blocked relay is one bob never wants used, so it stops being offered as a suggestion. It was
  // the picker's only offer a moment ago, which is what makes its absence about the block.
  await blocked.click()
  await dialog(page, "Blocked Relays").getByRole("button", {name: "Add Relays"}).click()

  await expect(relayPicker(page).getByText("space.test")).toBeVisible()
  await expect(relayPicker(page).getByText("other.test")).toHaveCount(0)
})

test("US-086 configure alerts", async ({seed, as}) => {
  await seed(({relay, user}) => {
    const space = relay("space")

    space.room("general", {name: "General"})
    space.join(user.alice, "general")

    space.relayList(user.alice)
  })

  const page = await as(users.alice, "/settings/alerts")

  const sound = settingToggle(page, "Play sound for new activity")
  const push = settingToggle(page, "Enable push notifications")
  const alertTypes = page.locator("div.card").filter({has: page.getByText("Alert Types")})

  await expect(sound).toBeChecked()
  await expect(push).not.toBeChecked()
  await expect(alertTypes).not.toHaveClass(/opacity-50/)

  // With nothing left to be alerted through, there is nothing to be alerted about.
  await sound.uncheck()

  await expect(alertTypes).toHaveClass(/opacity-50/)

  await page.getByRole("button", {name: "Discard Changes"}).click()

  await expect(sound).toBeChecked()
  await expect(alertTypes).not.toHaveClass(/opacity-50/)

  // Push asks the browser for permission, and this context was never granted it.
  await push.check()
  await page.getByRole("button", {name: "Save Changes"}).click()

  await expect(page.getByRole("alert")).toContainText("Failed to request notification permissions")
  await expect(push).not.toBeChecked()
  await expect(sound).toBeChecked()

  await waitForToastToClear(page)

  await sound.uncheck()
  await page.getByRole("button", {name: "Save Changes"}).click()

  await expect(page.getByRole("alert")).toContainText("Your settings have been saved!")

  await waitForToastToClear(page)
  await page.reload()

  await expect(settingToggle(page, "Play sound for new activity")).not.toBeChecked()
})

test("US-087 configure content display", async ({seed, as}) => {
  let picture!: Seeded
  let link!: Seeded

  const scenario = await seed(({relay, user, at}) => {
    const space = relay("space")

    space.room("general", {name: "General"})
    space.join(user.alice, "general")
    space.join(user.bob, "general")

    picture = space.message(user.bob, "general", "https://images.test/sunset.png", at(40, MINUTE))
    link = space.message(user.bob, "general", "https://example.test/announcement", at(35, MINUTE))

    space.relayList(user.alice)
  })

  const {url} = scenario.space("space")
  const page = await as(users.alice, "/settings/content")

  const hideSensitive = settingToggle(page, "Hide sensitive content?")
  const showMedia = settingToggle(page, "Show media?")

  await expect(hideSensitive).toBeChecked()
  await expect(showMedia).toBeChecked()

  await hideSensitive.uncheck()
  await showMedia.uncheck()
  await page.getByRole("button", {name: "Save Changes"}).click()

  await expect(page.getByRole("alert")).toContainText("Your settings have been saved!")

  await waitForToastToClear(page)
  await page.goto(roomPath(url, "general"))

  const pictureMessage = page.locator(`[data-event="${picture.id}"]`)
  const linkMessage = page.locator(`[data-event="${link.id}"]`)

  await expect(pictureMessage.getByRole("link", {name: "images.test/sunset.png"})).toBeVisible()
  await expect(pictureMessage.locator('img[src="https://images.test/sunset.png"]')).toHaveCount(0)

  await expect(linkMessage.getByRole("link", {name: "example.test/announcement"})).toBeVisible()
  await expect(linkMessage.locator(".spinner")).toHaveCount(0)
  await expect(linkMessage.getByText("Unable to load a preview")).toHaveCount(0)

  await page.goto("/settings/content")

  await expect(settingToggle(page, "Hide sensitive content?")).not.toBeChecked()
})

test("US-088 adjust send delay and media servers", async ({seed, as}) => {
  await seed(({relay, user}) => {
    const space = relay("space")

    space.room("general", {name: "General"})
    space.join(user.alice, "general")

    space.relayList(user.alice)
  })

  const page = await as(users.alice, "/settings/content")

  // The send delay is the only slider on this page.
  const sendDelay = page.locator('input[type="range"]')
  const servers = page.getByRole("listitem")

  await expect(page.getByText("Delay sending chat messages for 0 seconds.")).toBeVisible()

  await sendDelay.fill("3000")

  await expect(page.getByText("Delay sending chat messages for 3 seconds.")).toBeVisible()

  await expect(servers).toHaveCount(0)

  await page.getByRole("button", {name: "Add Server"}).click()

  await expect(servers).toHaveCount(1)

  await servers.first().locator("input").fill("https://media.test/")

  await page.getByRole("button", {name: "Add Server"}).click()

  await expect(servers).toHaveCount(2)

  // Each row leads with its own remove button; the drag handle is the one with a label.
  await servers.nth(1).getByRole("button").first().click()

  await expect(servers).toHaveCount(1)
  await expect(servers.first().locator("input")).toHaveValue("https://media.test/")

  await page.getByRole("button", {name: "Save Changes"}).click()

  await expect(page.getByRole("alert")).toContainText("Your settings have been saved!")

  await waitForToastToClear(page)
  await page.reload()

  await expect(page.getByText("Delay sending chat messages for 3 seconds.")).toBeVisible()
  await expect(page.locator('input[type="range"]')).toHaveValue("3000")
})

test("US-089 configure privacy preferences", async ({seed, as}) => {
  await seed(({relay, user}) => {
    const space = relay("space")

    space.room("general", {name: "General"})
    space.join(user.alice, "general")

    space.relayList(user.alice)
  })

  const page = await as(users.alice, "/settings/privacy")

  const auth = settingToggle(page, "Authenticate with unknown relays?")
  const usage = settingToggle(page, "Report usage?")

  await expect(auth).not.toBeChecked()
  await expect(usage).toBeChecked()

  await auth.check()
  await usage.uncheck()
  await page.getByRole("button", {name: "Discard Changes"}).click()

  await expect(auth).not.toBeChecked()
  await expect(usage).toBeChecked()

  await auth.check()
  await usage.uncheck()
  await page.getByRole("button", {name: "Save Changes"}).click()

  await expect(page.getByRole("alert")).toContainText("Your settings have been saved!")

  await waitForToastToClear(page)
  await page.reload()

  await expect(settingToggle(page, "Authenticate with unknown relays?")).toBeChecked()
  await expect(settingToggle(page, "Report usage?")).not.toBeChecked()
})

test("US-090 change the app's appearance", async ({seed, as}) => {
  await seed(({relay, user}) => {
    const space = relay("space")

    space.room("general", {name: "General"})
    space.join(user.alice, "general")

    space.relayList(user.alice)
  })

  const page = await as(users.alice, "/settings/theme", {context: {colorScheme: "light"}})
  const body = page.locator("body")

  await expect(body).toHaveAttribute("data-theme", "light")

  await page.getByRole("button", {name: "Dark", exact: true}).click()

  await expect(body).toHaveAttribute("data-theme", "dark")

  await page.getByRole("button", {name: "System", exact: true}).click()

  await expect(body).toHaveAttribute("data-theme", "light")

  // System means the device's, so changing the device's changes the app's.
  await page.emulateMedia({colorScheme: "dark"})

  await expect(body).toHaveAttribute("data-theme", "dark")

  await page.getByLabel("Style").selectOption("navy")

  await expect(body).toHaveAttribute("data-fl-theme", "navy")

  await page.reload()

  await expect(body).toHaveAttribute("data-fl-theme", "navy")
  await expect(page.getByLabel("Style")).toHaveValue("navy")

  // Font size is the only slider on this page, and the only setting here that is published.
  const fontSize = page.locator('input[type="range"]')

  await expect(page.getByText("110%")).toBeVisible()
  await expect(page.getByRole("button", {name: "Save Changes"})).toHaveCount(0)

  await fontSize.fill("1.25")

  await expect(page.getByText("125%")).toBeVisible()
  await expect(page.locator("html")).toHaveAttribute("style", /font-size:\s*1\.25rem/)

  // Moving the slider is the save, so the size the document is rendered at survives a reload
  // without anything else having been pressed.
  await page.reload()

  await expect(page.locator("html")).toHaveAttribute("style", /font-size:\s*1\.25rem/)
})

test("US-091 set up how people zap you", async ({seed, as}) => {
  await seed(({relay, user}) => {
    const space = relay("space")

    space.room("general", {name: "General"})
    space.join(user.alice, "general")
    space.profile(user.alice, {name: "Alice Anders"})

    space.relayList(user.alice)
  })

  const page = await as(users.alice, "/settings/wallet")

  await expect(page.getByText("Not set")).toBeVisible()

  await page.getByRole("button", {name: "Update"}).click()

  const address = page
    .locator(".dialog")
    .filter({has: page.getByRole("heading", {name: "Update Lightning Address"})})
    .last()

  await address.getByPlaceholder("user@domain.com").fill("alice@example.test")
  await address.getByRole("button", {name: "Save Changes"}).click()

  // The dialog closes itself once the profile has gone out, and the page behind it carries its own
  // "Save Changes" — so wait it out rather than leaving that name ambiguous.
  await expect(address).toHaveCount(0)
  await expect(page.getByText("alice@example.test")).toBeVisible()
  await expect(page.getByText("Not set")).toHaveCount(0)

  await page.getByRole("button", {name: "Update"}).click()
  await address.getByPlaceholder("user@domain.com").fill("")
  await address.getByRole("button", {name: "Save Changes"}).click()

  await expect(address).toHaveCount(0)
  await expect(page.getByText("Not set")).toBeVisible()

  // Each preset is a row with a remove button and an amount input. The same utility classes land on
  // other rows (a button's spinner), so pin it to the zap-amounts form's rows that hold an input.
  const zapForm = page.locator("form").filter({hasText: "Zap Amounts"})
  const presets = zapForm.locator("div.items-center.gap-2:has(input)")

  await expect(presets).toHaveCount(4)

  await page.getByRole("button", {name: "Add amount"}).click()

  await expect(presets).toHaveCount(5)

  // A preset has to be worth something, so saving a zero is refused with an error.
  await presets.nth(4).locator("input").fill("0")
  await page.getByRole("button", {name: "Save Changes"}).click()

  await expect(page.getByRole("alert")).toContainText("Zap amounts must be greater than zero.")

  await waitForToastToClear(page)

  // Discarding puts back the last saved values, which are still alice's original four — the zero
  // never reached them.
  await page.getByRole("button", {name: "Discard Changes"}).click()

  await expect(presets).toHaveCount(4)

  await presets.nth(3).getByRole("button").click()
  await presets.nth(2).getByRole("button").click()
  await presets.nth(1).getByRole("button").click()

  await expect(presets).toHaveCount(1)
  await expect(presets.first().getByRole("button")).toBeDisabled()

  await presets.first().locator("input").fill("500")
  await page.getByRole("button", {name: "Save Changes"}).click()

  await expect(page.getByRole("alert")).toContainText("Your zap amounts have been saved!")

  await waitForToastToClear(page)
  await page.reload()

  const saved = page
    .locator("form")
    .filter({hasText: "Zap Amounts"})
    .locator("div.items-center.gap-2:has(input)")

  await expect(saved).toHaveCount(1)
  await expect(saved.first().locator("input")).toHaveValue("500")
})
