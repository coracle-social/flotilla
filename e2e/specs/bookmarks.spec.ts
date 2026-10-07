import {HOUR} from "@welshman/lib"
import {dialog, expect, openMessageMenu, roomPath, test, users} from "../harness"

test("US-143 keep a message in a bookmark folder", async ({seed, as}) => {
  const scenario = await seed(({relay, user, at}) => {
    const space = relay("space")

    space.room("general", {name: "General"})
    space.join(user.alice, "general")
    space.join(user.bob, "general")
    space.profile(user.bob, {name: "Bob Brightly"})
    space.message(user.bob, "general", "the one worth keeping", at(1, HOUR))
  })

  const {url} = scenario.space("space")
  const page = await as(users.alice, roomPath(url, "general"))

  await openMessageMenu(page, "the one worth keeping")
  await page.getByRole("button", {name: "Add Bookmark"}).click()
  await page.getByRole("link", {name: "Bookmarks"}).click()

  const uncategorized = page.getByRole("group", {name: "Uncategorized"})

  await expect(uncategorized.getByText("Bob Brightly")).toBeVisible()
  await expect(uncategorized.getByText("the one worth keeping")).toBeVisible()

  await page.getByRole("button", {name: "New folder"}).click()
  await dialog(page, "New Folder").getByPlaceholder("Folder name").fill("Reading")
  await dialog(page, "New Folder").getByRole("button", {name: "Save changes"}).click()

  await uncategorized.getByRole("button", {name: "Bookmark actions"}).click()
  await page.getByRole("button", {name: "Move Bookmark", exact: true}).click()
  await dialog(page, "Move Bookmark").getByRole("button", {name: "Reading"}).click()

  const reading = page.getByRole("group", {name: "Reading"})

  await expect(reading.getByText("the one worth keeping")).toBeVisible()
  await expect(uncategorized.getByText("Nothing in this folder yet.")).toBeVisible()

  await page.getByPlaceholder("Search bookmarks...").fill("worth keeping")

  await expect(reading.getByText("the one worth keeping")).toBeVisible()
  await expect(uncategorized).toHaveCount(0)

  await page.getByPlaceholder("Search bookmarks...").fill("a book nobody kept")

  await expect(page.getByText("No bookmarks match your search.")).toBeVisible()

  await page.getByPlaceholder("Search bookmarks...").fill("")

  await reading.getByRole("button", {name: "Bookmark actions"}).click()
  await page.getByRole("button", {name: "Remove Bookmark"}).click()

  await expect(reading.getByText("Nothing in this folder yet.")).toBeVisible()
})
