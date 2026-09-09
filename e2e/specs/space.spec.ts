import {HOUR, MINUTE} from "@welshman/lib"
import {expect, roomPath, test, users} from "../harness"

test("renders a seeded space, its rooms and its messages", async ({seed, as}) => {
  const scenario = await seed(({relay, user, at}) => {
    const space = relay("space")

    space.room("general", {name: "General"})
    space.room("random", {name: "Random"})
    space.join(user.alice, "general")
    space.join(user.bob, "general")
    space.message(user.bob, "general", "morning all", at(2, HOUR))
    space.message(user.alice, "general", "morning!", at(90, MINUTE))
  })

  const {url} = scenario.space("space")
  const page = await as(users.alice, roomPath(url, "general"))

  // The room the user belongs to and the one they don't are both advertised by the relay, so
  // both appear in the space menu.
  await expect(page.getByRole("link", {name: "General"})).toBeVisible()
  await expect(page.getByRole("link", {name: "Random"})).toBeVisible()

  await expect(page.getByText("morning all")).toBeVisible()
  await expect(page.getByText("morning!")).toBeVisible()
})

test("opens the space menu in a drawer on a phone", async ({seed, as}) => {
  const scenario = await seed(({relay, user}) => {
    const space = relay("space")

    space.room("general", {name: "General"})
    space.join(user.alice, "general")
  })

  const {url} = scenario.space("space")
  const page = await as(users.alice, roomPath(url, "general"), {
    context: {viewport: {width: 390, height: 844}, hasTouch: true},
  })

  const drawer = page.locator(".drawer")

  await expect(drawer).toHaveCount(0)

  await page.getByRole("button", {name: "Open space menu"}).click()

  await expect(drawer.getByRole("link", {name: "General"})).toBeVisible()

  // The space rail sits beside the menu inside the panel, so the menu gets what the rail leaves.
  // Sized to the panel instead, it runs off the right of the screen.
  await expect(drawer.locator(".space-menu")).toBeInViewport({ratio: 1})

  // The panel is full width, so the only way back out is the bottom bar, which the drawer stops
  // short of rather than covering. Playwright's hit-target check is what proves it: a drawer over
  // the bar would take the click itself.
  const closeButton = page.getByRole("button", {name: "Close space menu"})

  await closeButton.click()

  await expect(drawer).toHaveCount(0)

  await page.getByRole("button", {name: "Open space menu"}).click()

  await expect(drawer.getByRole("link", {name: "General"})).toBeVisible()

  // The modal stack lives in the url hash, so the drawer is a history entry and back closes it.
  await page.goBack()

  await expect(drawer).toHaveCount(0)

  // The button is the bottom bar's rather than the page's, so it still opens the menu from a page
  // that is in no space at all, on the last space the reader was in.
  await page.goto("/chat")

  await page.getByRole("button", {name: "Open space menu"}).click()

  await expect(drawer.getByRole("link", {name: "General"})).toBeVisible()
})

test("keeps the drawer's space rail free of a horizontal scrollbar", async ({seed, as}) => {
  const scenario = await seed(({relay, user}) => {
    const space = relay("space")

    space.room("general", {name: "General"})
    space.join(user.alice, "general")
  })

  const {url} = scenario.space("space")

  // No touch, so the app is not in mobile mode and hover tooltips are live. The rail scrolls
  // vertically, which makes it scroll horizontally too, and a tooltip is 140px wider than it is.
  const page = await as(users.alice, roomPath(url, "general"), {
    context: {viewport: {width: 390, height: 844}},
  })

  await page.getByRole("button", {name: "Open space menu"}).click()

  const rail = page.locator(".drawer .primary-nav")

  await expect(rail).toBeVisible()

  const overflow = await rail.evaluate(el => el.scrollWidth - el.clientWidth)

  expect(overflow).toBe(0)
})
