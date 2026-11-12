import {MINUTE} from "@welshman/lib"
import {Note} from "@welshman/domain"
import {
  dialog,
  expect,
  message,
  profilePath,
  roomPath,
  spacePath,
  test,
  topDialog,
  users,
} from "../harness"

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

test("goes back to the note another note was opened from", async ({seed, as}) => {
  const note = "the lighthouse has been dark since tuesday"
  const answer = "the keeper is on holiday"

  await seed(({open, user, at}) => {
    const indexer = open("indexer")
    const outbox = open("outbox")

    indexer.relayList(user.alice, {
      read: [indexer.url, outbox.url],
      write: [indexer.url, outbox.url],
    })
    outbox.profile(user.alice, {name: "Alice Anderson"})

    const posted = outbox.note(user.alice, note, at(30, MINUTE))

    outbox.event(
      user.alice,
      () => outbox.kind(Note).writer().setParent(posted.event).setContent(answer).renderTemplate(),
      at(20, MINUTE),
    )
  })

  const page = await as(users.alice, profilePath(users.alice.pubkey))

  // Her answer hangs off her note, so the feed draws it under the note it answers.
  const entry = page.locator('[data-component="NoteEntry"]')

  await expect(entry.getByText(answer)).toBeVisible()

  await entry.getByText(answer).click()
  await expect(topDialog(page)).toContainText(answer)

  // The note on screen is in the url, which is what tells the two dialogs apart.
  const answered = page.url()

  await topDialog(page).getByRole("button", {name: "View parent"}).click()

  await expect(page).not.toHaveURL(answered)
  await expect(topDialog(page)).toContainText(note)

  // Opening a note from a note takes an entry of its own, so back is the note it came from.
  await page.goBack()

  await expect(page).toHaveURL(answered)
  await expect(topDialog(page)).toContainText(answer)
})
