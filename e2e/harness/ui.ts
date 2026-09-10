import {expect} from "@playwright/test"
import type {Locator, Page} from "@playwright/test"

/**
 * What a spec names on screen. A locator more than one spec reaches for belongs here, so a class or
 * a label the app renames is one edit rather than six — and so the comment explaining why a
 * locator is shaped the way it is has one copy to keep true.
 */

// The panel of the modal carrying a given title. `.dialog` is on both the backdrop wrapper and the
// panel inside it, so the last match is the panel.
export const dialog = (page: Page, title: string) =>
  page
    .locator(".dialog")
    .filter({has: page.getByRole("heading", {name: title, exact: true})})
    .last()

// The modal on top, for one with no heading of its own or one pushed over another rather than
// alongside it.
export const topDialog = (page: Page) => page.locator(".dialog").last()

// A modal is mounted alongside the page it covers, so a page's own "Create" and the modal's submit
// are both in the dom at once. Anything said about the form is scoped to the modal's own to say
// which one is meant.
export const modalForm = (page: Page, title: string) =>
  page.locator("form").filter({has: page.getByRole("heading", {name: title})})

// EventActions renders zap, emoji and menu into one join, in that order, and every one of them is
// an icon with no accessible name.
export const emojiButton = (scope: Locator) => scope.locator(".join").getByRole("button").nth(1)

export const menuButton = (scope: Locator) => scope.locator(".join").getByRole("button").last()

// The picker is a web component with an open shadow root, so its search field and its results are
// reachable through it. Searching rather than browsing avoids depending on which category tab an
// emoji happens to live under.
export const pickEmoji = async (page: Page, opener: Locator, annotation: string) => {
  await opener.click()

  const picker = page.locator("emoji-picker").filter({visible: true})

  // Tippy keeps a hidden popover mounted through its fade — a quarter of a second during which the
  // picker from the last card is still visible alongside this one — so wait for there to be one
  // rather than reaching into whichever resolves first.
  await expect(picker).toHaveCount(1)

  // A result's label is the emoji's name, its annotation and every shortcode joined together, so
  // the annotation is matched rather than the whole of it.
  await picker.locator("input.search").fill(annotation)
  await picker
    .getByRole("option", {name: new RegExp(annotation)})
    .first()
    .click()
}

export const pageBar = (page: Page) => page.locator('[data-component="PageBar"]')

// The room's page bar carries a search button and the detail button, in that order.
export const openRoomDetail = (page: Page) => pageBar(page).getByRole("button").last().click()

export const roomLink = (page: Page, name: string) =>
  page.locator(".space-menu__scroll").getByRole("link", {name})

// One toast at a time — src/app/toast.ts holds a single writable — so this is the toast.
export const toast = (page: Page) => page.getByRole("alert")

// FieldInline, RoomDetail and EventInfo all lay a labelled control out as a single row, with the
// label at one end and the control at the other.
export const settingRow = (page: Page, label: string) =>
  page.locator("div.items-center.justify-between").filter({hasText: label})

export const settingToggle = (page: Page, label: string) =>
  settingRow(page, label).getByRole("checkbox")

export const composer = (page: Page) => page.locator(".chat-editor [contenteditable=true]")

// The editor is where the composer says whether it is ready. The send button is not there to ask
// while the composer is empty, since a dictation button stands in its place. Only the conversation
// composer has a disabled state; a room's is usable as soon as it renders.
export const composerEnabled = (page: Page) =>
  expect(page.locator(".room__compose .chat-editor")).toHaveAttribute("aria-disabled", "false")

export const composerDisabled = (page: Page) =>
  expect(page.locator(".room__compose .chat-editor")).toHaveAttribute("aria-disabled", "true")

// The send button carries the shortcut it advertises, which differs by platform.
export const sendButton = (page: Page) => page.locator("button[data-tip$='enter to send']")

export const timeline = (page: Page) => page.locator(".room__content")

// .room__content is column-reverse, so the message at the bottom of the room is the first one in
// the dom.
export const messages = (page: Page) => page.locator(".room__item")

export const message = (page: Page, text: string) => messages(page).filter({hasText: text})

// RoomItem gives its hover actions no accessible names — every one is an icon. Their order is
// fixed by the component: zap, emoji, reply, edit (only on your own recent message), menu.
export const messageActions = (page: Page, text: string) =>
  message(page, text).locator(".room__item-actions button")

export const openMessageMenu = (page: Page, text: string) =>
  messageActions(page, text).last().click()

export const bubble = (page: Page, text: string) =>
  page.locator(".chat-bubble").filter({hasText: text})

// Typing into a room's composer and sending it. The composer is waited for rather than assumed,
// since a room still rendering has none, and clicked into when the caret is somewhere else, since
// typing goes wherever it is. One that already holds the caret is typed into as it stands: clicking
// would collapse the selection, and selecting the whole of it is how an edit types over the message
// it replaces.
export const send = async (page: Page, content: string) => {
  const editor = composer(page)

  await expect(editor).toBeVisible()

  const elsewhere = await editor.evaluate(el => el !== document.activeElement)

  if (elsewhere) {
    await editor.click()
  }

  await editor.pressSequentially(content)
  await editor.press("Enter")
}

export const chatList = (page: Page) => page.locator(".secondary-nav .overflow-auto")

// One conversation in the sidebar list is one button; nothing inside it is one.
export const chatItems = (page: Page) => chatList(page).locator("button")

// The comment and thread composers are rich text rather than chat editors, so they carry a
// different one.
export const noteEditor = (scope: Locator | Page) =>
  scope.locator(".note-editor [contenteditable=true]")

// A date as the browser formatted it rather than as node would, so the locale and the timezone are
// the ones the app rendered with. The options mirror dateFormatter in @welshman/lib.
export const longDate = (page: Page, seconds: number) =>
  page.evaluate(
    ts =>
      new Intl.DateTimeFormat(undefined, {year: "numeric", month: "long", day: "numeric"}).format(
        new Date(ts * 1000),
      ),
    seconds,
  )
