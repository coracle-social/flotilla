import {MINUTE} from "@welshman/lib"
import type {Page} from "@playwright/test"
import {
  dialog,
  expect,
  relayCard,
  roomPath,
  settingToggle,
  test,
  toast,
  topDialog,
  users,
} from "../harness"

// A handle to a seeded event, which only reads once seed() has drained its queue.
type Seeded = {readonly id: string}

// The relay picker is pushed over the list modal, so it is the only dialog in the dom.
const relayPicker = (page: Page) => topDialog(page)

// A toast clears after five seconds, which outlasts the batch a saved setting reaches disk in.
const waitForToastToClear = (page: Page) => expect(toast(page)).toHaveCount(0)

test("US-084 block a relay you never want used", async ({seed, as}) => {
  await seed(({relay, user}) => {
    const space = relay("space")

    // A relay is offered as a suggestion once its nip-11 document has been fetched.
    relay("other")

    space.room("general", {name: "General"})
    space.join(user.bob, "general")

    space.relayList(user.bob)
  })

  const page = await as(users.bob, "/settings/privacy")
  const blocked = page.getByRole("button", {name: /Blocked$/})

  await blocked.click()
  await dialog(page, "Blocked Relays").getByRole("button", {name: "Add Relays"}).click()
  await relayCard(relayPicker(page), "other.test").getByRole("button", {name: "Add Relay"}).click()
  await page.getByRole("button", {name: "Done"}).click()

  await expect(dialog(page, "Blocked Relays").getByText("other.test")).toBeVisible()

  await dialog(page, "Blocked Relays").getByRole("button", {name: "Go back"}).click()

  await expect(blocked).toContainText("1 Blocked")

  // It was the picker's only offer a moment ago, which is what makes its absence about the block.
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

  const sound = settingToggle(page, "Play notification sounds")
  const alertTypes = page.locator("div.card").filter({has: page.getByText("Alert Types")})

  await expect(sound).toBeChecked()

  const reminders = alertTypes.locator("div.items-center.gap-2:has(input[type=number])")

  await expect(reminders).toHaveCount(1)
  await expect(reminders.first().locator("input")).toHaveValue("5")

  // A reminder has to come before the event, so saving a zero is refused with an error.
  await page.getByRole("button", {name: "Add reminder"}).click()
  await reminders.nth(1).locator("input").fill("0")
  await page.getByRole("button", {name: "Save Changes"}).click()

  await expect(page.getByRole("alert")).toContainText("at least a minute")

  await waitForToastToClear(page)

  await reminders.nth(1).locator("input").fill("1440")
  await page.getByRole("button", {name: "Add reminder"}).click()
  await reminders.nth(2).getByRole("button").click()

  await expect(reminders).toHaveCount(2)

  await sound.uncheck()
  await page.getByRole("button", {name: "Save Changes"}).click()

  await expect(page.getByRole("alert")).toContainText("Your settings have been saved!")

  await waitForToastToClear(page)
  await page.reload()

  await expect(settingToggle(page, "Play notification sounds")).not.toBeChecked()
  await expect(reminders).toHaveCount(2)
  await expect(reminders.nth(1).locator("input")).toHaveValue("1440")
})

test("US-087 configure content display", async ({seed, as}) => {
  let picture!: Seeded

  const scenario = await seed(({relay, user, at}) => {
    const space = relay("space")

    space.room("general", {name: "General"})
    space.join(user.alice, "general")
    space.join(user.bob, "general")

    picture = space.message(user.bob, "general", "https://images.test/sunset.png", at(40, MINUTE))

    space.relayList(user.alice)
  })

  const {url} = scenario.space("space")
  const page = await as(users.alice, "/settings/content")

  const hideSensitive = settingToggle(page, "Hide sensitive content?")
  const showMedia = settingToggle(page, "Show media?")

  await hideSensitive.uncheck()
  await showMedia.uncheck()
  await page.getByRole("button", {name: "Save Changes"}).click()

  await expect(page.getByRole("alert")).toContainText("Your settings have been saved!")

  await waitForToastToClear(page)
  await page.goto(roomPath(url, "general"))

  const pictureMessage = page.locator(`[data-event="${picture.id}"]`)

  await expect(pictureMessage.getByRole("link", {name: "images.test/sunset.png"})).toBeVisible()
  await expect(pictureMessage.locator('img[src="https://images.test/sunset.png"]')).toHaveCount(0)

  await page.goto("/settings/content")

  await expect(settingToggle(page, "Hide sensitive content?")).not.toBeChecked()
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

  const page = await as(users.alice, "/settings/content", {context: {colorScheme: "light"}})
  const body = page.locator("body")

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

  // Font size is a setting, so it goes out with the rest of the page.
  await page.getByLabel("Font size").fill("1.25")
  await page.getByRole("button", {name: "Save Changes"}).click()

  await expect(page.getByRole("alert")).toContainText("Your settings have been saved!")
  await expect(page.locator("html")).toHaveAttribute("style", /font-size:\s*1\.25rem/)

  await waitForToastToClear(page)
  await page.reload()

  await expect(page.locator("html")).toHaveAttribute("style", /font-size:\s*1\.25rem/)
})
