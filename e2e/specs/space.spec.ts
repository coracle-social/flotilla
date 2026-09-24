import {expect, roomPath, test, users} from "../harness"

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
  await expect(drawer.locator(".space-menu")).toBeInViewport({ratio: 1})

  // The drawer stops short of the bottom bar, and playwright's hit-target check is what proves it.
  const closeButton = page.getByRole("button", {name: "Close space menu"})

  await closeButton.click()

  await expect(drawer).toHaveCount(0)

  await page.getByRole("button", {name: "Open space menu"}).click()

  await expect(drawer.getByRole("link", {name: "General"})).toBeVisible()

  // The modal stack lives in the url hash, so the drawer is a history entry and back closes it.
  await page.goBack()

  await expect(drawer).toHaveCount(0)

  // The button is the bottom bar's rather than the page's, so it opens on the last space visited.
  await page.goto("/chat")

  await page.getByRole("button", {name: "Open space menu"}).click()

  await expect(drawer.getByRole("link", {name: "General"})).toBeVisible()
})
