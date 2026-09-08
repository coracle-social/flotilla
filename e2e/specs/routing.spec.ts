import {spec} from "@welshman/lib"
import type {TrustedEvent} from "@welshman/util"
import {RelayMessageType} from "@welshman/net"
import {expect, getTranscript, roomPath, spacePath, test, users} from "../harness"

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

  // Alice belongs to both spaces, so the client is talking to the other relay at the same time —
  // its room and its messages just don't belong in this one. It syncs independently, so wait until
  // both have actually reached this page: `toHaveCount(0)` is equally satisfied by an element that
  // has not loaded yet, which would pass against a client that does conflate them.
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

  // Two entries back: the other space's landing page, then the room this started on. The switch
  // used to replace that room's entry rather than push one, so the second step overshot it.
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

  // The space's entry page is the room you are on, so this navigates nowhere and should replace
  // rather than push. One step back is the room this started on, not the one it never left.
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
  })

  const space = scenario.space("space")
  const page = await as(users.alice, roomPath(space.url, "lounge"), {
    context: {viewport: {width: 390, height: 844}, hasTouch: true},
  })

  const drawer = page.locator(".drawer")

  await page.getByRole("button", {name: "Open space menu"}).click()
  await drawer.getByRole("link", {name: "Space Garden"}).click()

  await expect(page).toHaveURL(new RegExp(`${roomPath(space.url, "garden")}$`))
  await expect(drawer).toHaveCount(0)

  // The menu held the entry the room it opened now holds, so one step back is the room it opened
  // over. Stacked instead, this lands on the menu again.
  await page.goBack()

  await expect(page).toHaveURL(new RegExp(`${roomPath(space.url, "lounge")}$`))
  await expect(drawer).toHaveCount(0)
})
