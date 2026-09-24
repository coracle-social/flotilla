import {HOUR, spec} from "@welshman/lib"
import type {TrustedEvent} from "@welshman/util"
import {RelayMessageType} from "@welshman/net"
import {Article} from "@welshman/domain"
import type {Page} from "@playwright/test"
import {
  dialog,
  expect,
  getTranscript,
  message,
  pathPattern,
  profilePath,
  roomPath,
  spacePath,
  test,
  users,
} from "../harness"

// Every page in a space renders one PageContent, so the count is how often the page was built.
const watchPageBuilds = (page: Page) =>
  page.evaluate(() => {
    const selector = "[data-component='PageContent']"

    let builds = 0

    document.documentElement.dataset.pageBuilds = "0"

    new MutationObserver(records => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (node instanceof Element && (node.matches(selector) || node.querySelector(selector))) {
            document.documentElement.dataset.pageBuilds = String(++builds)
          }
        }
      }
    }).observe(document.body, {childList: true, subtree: true})
  })

const expectPageBuilds = (page: Page, builds: number) =>
  expect(page.locator("html")).toHaveAttribute("data-page-builds", String(builds))

test("keeps two spaces' contents on their own relays", async ({seed, as}) => {
  const scenario = await seed(({relay, user}) => {
    const space = relay("space")
    const other = relay("other")

    // Same room id on both relays, so anything that keys rooms by id alone conflates them.
    space.room("lounge", {name: "Space Lounge"})
    other.room("lounge", {name: "Other Lounge"})
    space.join(user.alice, "lounge")
    other.join(user.alice, "lounge")
    space.message(user.alice, "lounge", "only in space")
    other.message(user.alice, "lounge", "only in other")
  })

  const space = scenario.space("space")
  const other = scenario.space("other")
  const page = await as(users.alice, roomPath(space.url, "lounge"))

  const deliveredByOther = (match: (event: TrustedEvent) => boolean) =>
    getTranscript(page.context()).some(
      ({url, direction, message}) =>
        url === other.url &&
        direction === "toClient" &&
        message[0] === RelayMessageType.Event &&
        match(message[2]),
    )

  await expect(page.getByText("only in space")).toBeVisible()
  await expect(page.getByRole("link", {name: "Space Lounge"})).toBeVisible()

  // toHaveCount(0) is equally satisfied by an element that has not loaded yet, so wait for both.
  await expect.poll(() => deliveredByOther(event => event.content === "only in other")).toBe(true)
  await expect
    .poll(() => deliveredByOther(event => event.tags.some(spec(["name", "Other Lounge"]))))
    .toBe(true)

  await expect(page.getByText("only in other")).toHaveCount(0)
  await expect(page.getByRole("link", {name: "Other Lounge"})).toHaveCount(0)

  const strays = getTranscript(page.context()).filter(
    ({url, direction, message}) =>
      direction === "toClient" &&
      message[0] === RelayMessageType.Event &&
      message[2].content === "only in space" &&
      url !== space.url,
  )

  expect(strays).toEqual([])
})

test("goes back to the room you left when you switch spaces", async ({seed, as}) => {
  const scenario = await seed(({relay, user}) => {
    const space = relay("space")
    const other = relay("other")

    space.room("lounge", {name: "Space Lounge"})
    other.room("lounge", {name: "Other Lounge"})
    space.join(user.alice, "lounge")
    other.join(user.alice, "lounge")
  })

  const space = scenario.space("space")
  const other = scenario.space("other")
  const page = await as(users.alice, roomPath(space.url, "lounge"))

  await expect(page.getByRole("link", {name: "Space Lounge"})).toBeVisible()

  await page.locator('.primary-nav [data-tip^="other"]').click()
  await expect(page).toHaveURL(new RegExp(spacePath(other.url)))

  await page.getByRole("link", {name: "Other Lounge"}).click()
  await expect(page).toHaveURL(new RegExp(`${roomPath(other.url, "lounge")}$`))

  // Two entries back: the other space's landing page, then the room this started on.
  await page.goBack()
  await page.goBack()

  await expect(page).toHaveURL(new RegExp(`${roomPath(space.url, "lounge")}$`))
})

test("does not stack a history entry for the space you are already in", async ({seed, as}) => {
  const scenario = await seed(({relay, user}) => {
    const space = relay("space")

    space.room("lounge", {name: "Space Lounge"})
    space.room("garden", {name: "Space Garden"})
    space.join(user.alice, "lounge")
    space.join(user.alice, "garden")
  })

  const space = scenario.space("space")
  const page = await as(users.alice, roomPath(space.url, "lounge"))

  await page.getByRole("link", {name: "Space Garden"}).click()
  await expect(page).toHaveURL(new RegExp(`${roomPath(space.url, "garden")}$`))

  // The space's entry page is the room you are on, so this navigates nowhere and replaces.
  await page.locator('.primary-nav [data-tip^="space"]').click()
  await expect(page).toHaveURL(new RegExp(`${roomPath(space.url, "garden")}$`))

  await page.goBack()

  await expect(page).toHaveURL(new RegExp(`${roomPath(space.url, "lounge")}$`))
})

test("takes over the space menu's history entry when you navigate out of it", async ({
  seed,
  as,
}) => {
  const scenario = await seed(({relay, user}) => {
    const space = relay("space")

    space.room("lounge", {name: "Space Lounge"})
    space.room("garden", {name: "Space Garden"})
    space.join(user.alice, "lounge")
    space.join(user.alice, "garden")
    space.message(user.alice, "lounge", "the lounge is this way")
  })

  const space = scenario.space("space")
  const page = await as(users.alice, roomPath(space.url, "lounge"), {
    context: {viewport: {width: 390, height: 844}, hasTouch: true},
  })

  const drawer = page.locator(".drawer")

  await expect(message(page, "the lounge is this way")).toBeVisible()

  await page.getByRole("button", {name: "Open space menu"}).click()
  await drawer.getByRole("link", {name: "Space Garden"}).click()

  await expect(page).toHaveURL(new RegExp(`${roomPath(space.url, "garden")}$`))
  await expect(drawer).toHaveCount(0)

  // The content is asserted as well as the url, since a back that only rewrites the url would pass.
  await page.goBack()

  await expect(page).toHaveURL(new RegExp(`${roomPath(space.url, "lounge")}$`))
  await expect(drawer).toHaveCount(0)
  await expect(message(page, "the lounge is this way")).toBeVisible()
})

test("switches spaces inside the space menu, and out of one it has a page for", async ({
  seed,
  as,
}) => {
  const scenario = await seed(({relay, user}) => {
    const space = relay("space")
    const other = relay("other")

    space.room("lounge", {name: "Space Lounge"})
    other.room("garden", {name: "Other Garden"})
    space.join(user.alice, "lounge")
    other.join(user.alice, "garden")
  })

  const space = scenario.space("space")
  const other = scenario.space("other")
  const page = await as(users.alice, roomPath(space.url, "lounge"), {
    context: {viewport: {width: 390, height: 844}, hasTouch: true},
  })

  const drawer = page.locator(".drawer")

  await page.getByRole("button", {name: "Open space menu"}).click()

  await expect(drawer.getByRole("link", {name: "Space Lounge"})).toBeVisible()

  // The rail is in the menu on a phone, and navigating out from under it would close it.
  await drawer.locator('.primary-nav [data-tip^="other"]').click()

  await expect(page).toHaveURL(new RegExp(spacePath(other.url)))
  await expect(drawer.getByRole("link", {name: "Other Garden"})).toBeVisible()

  await drawer.getByRole("link", {name: "Other Garden"}).click()

  await expect(page).toHaveURL(new RegExp(`${roomPath(other.url, "garden")}$`))
  await expect(drawer).toHaveCount(0)

  // The space she started in has a page behind it now, so picking it needs no second tap.
  await page.getByRole("button", {name: "Open space menu"}).click()
  await drawer.locator('.primary-nav [data-tip^="space"]').click()

  await expect(page).toHaveURL(new RegExp(`${roomPath(space.url, "lounge")}$`))
  await expect(drawer).toHaveCount(0)
})

test("enters a space on its details page whatever its relay advertises", async ({seed, as}) => {
  const scenario = await seed(({relay, user}) => {
    const space = relay("space")

    space.room("lounge", {name: "Space Lounge"})
    space.join(user.alice, "lounge")
  })

  const space = scenario.space("space")

  // A relay whose document claims no nip-29. The document arrives after the first navigation.
  const relayInfo = {[space.url]: {supported_nips: [1, 11, 42]}}
  const page = await as(users.alice, spacePath(space.url), {relayInfo})

  await expect(page).toHaveURL(pathPattern(spacePath(space.url) + "/about"))
  await expect(page.locator('[data-component="PageBar"]')).toContainText("Space Details")
})

test("builds a page once when it opens and again when its params change", async ({seed, as}) => {
  const scenario = await seed(({relay, user, at}) => {
    const space = relay("space")

    space.room("general", {name: "General"})
    space.join(user.alice, "general")
    space.join(user.bob, "general")
    space.profile(user.alice, {name: "Alice Anderson"})
    space.relayList(user.alice)

    const article = (identifier: string, title: string, hours: number) =>
      space.event(
        user.alice,
        () =>
          space
            .kind(Article)
            .writer()
            .setIdentifier(identifier)
            .setTitle(title)
            .setPublishedAt(at(hours, HOUR))
            .setContent("Gardens are worth the trouble.")
            .renderTemplate(),
        at(hours, HOUR),
      )

    article("tending-the-garden", "Tending the Garden", 4)
    article("repotting-in-winter", "Repotting in Winter", 3)
  })

  const {url} = scenario.space("space")
  const page = await as(users.bob, `${spacePath(url)}/articles`)

  await watchPageBuilds(page)

  await page
    .locator('[data-component="ArticleItem"]')
    .filter({hasText: "Tending the Garden"})
    .getByRole("link", {name: "Tending the Garden", exact: true})
    .click({position: {x: 20, y: 20}})

  await expect(
    page.locator("article header").getByRole("heading", {name: "Tending the Garden"}),
  ).toBeVisible()

  // The rebuild this guards against landed 20ms after the first build.
  await page.waitForTimeout(250)
  await expectPageBuilds(page, 1)

  // Another article is the same route with different params, which SvelteKit answers by keeping the page.
  await page.getByRole("link", {name: "Repotting in Winter"}).click()

  await expect(
    page.locator("article header").getByRole("heading", {name: "Repotting in Winter"}),
  ).toBeVisible()

  await expectPageBuilds(page, 2)
})

test("goes back to the room a profile modal was opened over", async ({seed, as}) => {
  const scenario = await seed(({relay, user}) => {
    const space = relay("space")

    space.room("lounge", {name: "Space Lounge"})
    space.join(user.alice, "lounge")
    space.join(user.bob, "lounge")
    space.profile(user.bob, {name: "Bob Barnacle"})
    space.message(user.bob, "lounge", "anyone seen the anchor")
  })

  const space = scenario.space("space")
  const page = await as(users.alice, roomPath(space.url, "lounge"))

  await expect(message(page, "anyone seen the anchor")).toBeVisible()

  // The whole message is a button too, and its accessible name carries the author's.
  await message(page, "anyone seen the anchor")
    .getByRole("button", {name: "Bob Barnacle", exact: true})
    .click()
  await expect(dialog(page, "Profile details")).toBeVisible()

  await page.getByRole("button", {name: "View Full Profile"}).click()
  await expect(page).toHaveURL(new RegExp(`${profilePath(users.bob.pubkey)}$`))

  // The modal gave its entry back before the profile page pushed its own, so one step back is the room.
  await page.goBack()

  await expect(page).toHaveURL(new RegExp(`${roomPath(space.url, "lounge")}$`))
  await expect(message(page, "anyone seen the anchor")).toBeVisible()
})
