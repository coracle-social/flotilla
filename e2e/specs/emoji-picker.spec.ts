import {HOUR} from "@welshman/lib"
import type {Locator, Page} from "@playwright/test"
import {composer, emojiButton, expect, message, roomPath, test, users} from "../harness"

const openReactionPicker = async (page: Page, opener: Locator) => {
  await opener.click()

  const picker = page.locator("emoji-picker").filter({visible: true})

  await expect(picker).toHaveCount(1)

  return picker
}

const openComposerEmojiPicker = async (page: Page) => {
  await page.getByRole("button", {name: "Add emoji"}).click()

  const shell = page.locator('[data-component="EmojiPicker"]').filter({visible: true})

  await expect(shell).toHaveCount(1)

  return shell
}

const searchPicker = async (picker: Locator, annotation: string) => {
  await picker.locator("input.search").fill(annotation)
  await expect(picker.getByRole("option", {name: new RegExp(annotation)}).first()).toBeVisible()
}

test("Tippy reaction picker shows gestures and flags without CDN fetches", async ({seed, as}) => {
  const scenario = await seed(({relay, user, at}) => {
    const space = relay("space")

    space.room("general", {name: "General"})
    space.join(user.alice, "general")
    space.join(user.bob, "general")
    space.message(user.bob, "general", "coverage check", at(2, HOUR))
  })

  const alice = await as(users.alice, roomPath(scenario.space("space").url, "general"))
  const cdnRequests: string[] = []

  await alice.context().route(/jsdelivr|skypack|fonts\.googleapis|fonts\.gstatic/i, route => {
    cdnRequests.push(route.request().url())
    return route.continue()
  })

  const opener = emojiButton(message(alice, "coverage check"))
  const picker = await openReactionPicker(alice, opener)

  for (const annotation of [
    "heart hands",
    "pinched fingers",
    "flag: India",
    "flag: United States",
  ]) {
    await searchPicker(picker, annotation)
  }

  await alice.keyboard.press("Escape")
  expect(cdnRequests).toEqual([])
})

test("reaction picker has no kaomoji and preserves skin tone", async ({seed, as}) => {
  const scenario = await seed(({relay, user, at}) => {
    const space = relay("space")

    space.room("general", {name: "General"})
    space.join(user.alice, "general")
    space.join(user.bob, "general")
    space.message(user.bob, "general", "skin tone check", at(2, HOUR))
  })

  const alice = await as(users.alice, roomPath(scenario.space("space").url, "general"))
  const opener = emojiButton(message(alice, "skin tone check"))
  const picker = await openReactionPicker(alice, opener)

  await expect(alice.getByRole("button", {name: "Kaomoji", exact: true})).toHaveCount(0)

  await picker.getByRole("button", {name: /Choose a skin tone/}).click()
  await picker.getByRole("option", {name: "Medium-Dark"}).click()
  await searchPicker(picker, "thumbs up")
  await picker
    .getByRole("option", {name: /thumbs up/})
    .first()
    .click()

  await expect(message(alice, "skin tone check").getByRole("button", {name: "👍🏾"})).toBeVisible()
})

test("composer inserts emoji and kaomoji at the caret and closes the popover", async ({
  seed,
  as,
}) => {
  const scenario = await seed(({relay, user}) => {
    const space = relay("space")

    space.room("general", {name: "General"})
    space.join(user.alice, "general")
  })

  const alice = await as(users.alice, roomPath(scenario.space("space").url, "general"))
  const editor = composer(alice)

  await expect(editor).toBeVisible()
  await editor.click()
  await editor.pressSequentially("Hello world")

  await editor.evaluate(node => {
    const paragraph = node.querySelector("p")
    const textNode = paragraph?.firstChild

    if (!(textNode instanceof Text)) {
      return
    }

    const range = document.createRange()
    range.setStart(textNode, "Hello ".length)
    range.collapse(true)
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)
  })

  const shell = await openComposerEmojiPicker(alice)
  const picker = shell.locator("emoji-picker")

  await picker.locator("input.search").fill("grinning face")
  await picker
    .getByRole("option", {name: /grinning face/})
    .first()
    .click()

  await expect(shell).toHaveCount(0)
  await expect(editor).toBeFocused()
  await expect(editor).toHaveText("Hello 😀world")

  const kaomojiShell = await openComposerEmojiPicker(alice)

  await kaomojiShell.getByRole("button", {name: "Kaomoji", exact: true}).click()
  await kaomojiShell.getByRole("button", {name: "Shrug", exact: true}).click()

  await expect(kaomojiShell).toHaveCount(0)
  await expect(editor).toBeFocused()
  await expect(editor).toContainText("¯\\_(ツ)_/¯")
})

test("Emoji → Kaomoji → Emoji still selects emoji", async ({seed, as}) => {
  const scenario = await seed(({relay, user}) => {
    const space = relay("space")

    space.room("general", {name: "General"})
    space.join(user.alice, "general")
  })

  const alice = await as(users.alice, roomPath(scenario.space("space").url, "general"))
  const shell = await openComposerEmojiPicker(alice)

  await shell.getByRole("button", {name: "Kaomoji", exact: true}).click()
  await expect(shell.getByRole("button", {name: "Shrug", exact: true})).toBeVisible()
  await shell.getByRole("button", {name: "Emoji", exact: true}).click()

  const picker = shell.locator("emoji-picker")

  await expect(picker).toBeVisible()
  await picker.locator("input.search").fill("party popper")
  await picker.getByRole("option", {name: /party popper/}).click()

  await expect(composer(alice)).toContainText("🎉")
})

test("mobile picker keeps a reduced column count", async ({seed, as}) => {
  const scenario = await seed(({relay, user, at}) => {
    const space = relay("space")

    space.room("general", {name: "General"})
    space.join(user.alice, "general")
    space.join(user.bob, "general")
    space.message(user.bob, "general", "mobile picker", at(2, HOUR))
  })

  const alice = await as(users.alice, roomPath(scenario.space("space").url, "general"), {
    context: {viewport: {width: 390, height: 844}, hasTouch: true},
  })

  // Hover reaction buttons are desktop-only; phones open the picker from the message menu.
  await expect(alice.getByRole("button", {name: "Open space menu"})).toBeVisible()
  await message(alice, "mobile picker").click()
  await alice.getByRole("button", {name: "React"}).click()

  const picker = alice.locator("emoji-picker").filter({visible: true})

  await expect(picker).toHaveCount(1)
  await expect
    .poll(() =>
      picker.evaluate(el => getComputedStyle(el).getPropertyValue("--num-columns").trim()),
    )
    .toBe("6")

  await searchPicker(picker, "party popper")
  await picker.getByRole("option", {name: /party popper/}).click()
  await expect(message(alice, "mobile picker")).toContainText("🎉")
})
