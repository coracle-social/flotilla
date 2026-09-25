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

  await searchPicker(picker, "heart hands")
  await searchPicker(picker, "flag: India")

  await alice.keyboard.press("Escape")
  expect(cdnRequests).toEqual([])
})

test("reaction picker preserves skin tone", async ({seed, as}) => {
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

  await picker.locator("input.search").fill("party popper")
  await picker.getByRole("option", {name: /party popper/}).click()

  await expect(composer(alice)).toContainText("🎉")
})
