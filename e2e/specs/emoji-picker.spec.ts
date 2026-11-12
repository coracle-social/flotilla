import type {Page} from "@playwright/test"
import {composer, expect, roomPath, test, users} from "../harness"

const openComposerEmojiPicker = async (page: Page) => {
  await page.getByRole("button", {name: "Add emoji"}).click()

  const shell = page.locator('[data-component="EmojiPicker"]').filter({visible: true})

  await expect(shell).toHaveCount(1)

  return shell
}

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
