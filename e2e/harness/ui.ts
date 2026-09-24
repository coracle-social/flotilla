import {expect} from "@playwright/test"
import type {Locator, Page} from "@playwright/test"

/** What a spec names on screen. A locator more than one spec reaches for belongs here. */

export const dialog = (page: Page, title: string) =>
  page.getByRole("dialog", {name: title, exact: true})

// The modal on top, for one with no heading of its own or one pushed over another.
export const topDialog = (page: Page) => page.getByRole("dialog").last()

// A modal is mounted alongside the page it covers, so both forms are in the dom at once.
export const modalForm = (page: Page, title: string) =>
  page.locator("form").filter({has: page.getByRole("heading", {name: title})})

// Named rather than counted, since a card is free to put a join of its own above it.
export const emojiButton = (scope: Locator) => scope.getByRole("button", {name: "Add a reaction"})

// The menu is the one action with no accessible name, and the last thing in a card's last join.
export const menuButton = (scope: Locator) => scope.locator(".join").getByRole("button").last()

// The picker is a web component with an open shadow root, and searching avoids its category tabs.
export const pickEmoji = async (page: Page, opener: Locator, annotation: string) => {
  await opener.click()

  const picker = page.locator("emoji-picker").filter({visible: true})

  // Tippy keeps a hidden popover mounted through its fade, so the last card's picker is still up.
  await expect(picker).toHaveCount(1)

  // A result's label joins the emoji's name, its annotation and every shortcode.
  await picker.locator("input.search").fill(annotation)
  await picker
    .getByRole("option", {name: new RegExp(annotation)})
    .first()
    .click()
}

export const pageBar = (page: Page) => page.locator('[data-component="PageBar"]')

export const openRoomDetail = (page: Page) =>
  pageBar(page).getByRole("button", {name: "Room details"}).click()

export const roomLink = (page: Page, name: string) =>
  page.locator(".space-menu__scroll").getByRole("link", {name})

// One toast at a time — src/app/toast.ts holds a single writable — so this is the toast.
export const toast = (page: Page) => page.getByRole("alert")

// FieldInline, RoomDetail and EventInfo all lay a labelled control out as a single row.
export const settingRow = (page: Page, label: string) =>
  page.locator("div.items-center.justify-between").filter({hasText: label})

export const settingToggle = (page: Page, label: string) =>
  settingRow(page, label).getByRole("checkbox")

export const composer = (page: Page) => page.locator(".chat-editor [contenteditable=true]")

// Only the conversation composer has a disabled state; a room's is usable as soon as it renders.
export const composerEnabled = (page: Page) =>
  expect(page.locator(".room__compose .chat-editor")).toHaveAttribute("aria-disabled", "false")

export const composerDisabled = (page: Page) =>
  expect(page.locator(".room__compose .chat-editor")).toHaveAttribute("aria-disabled", "true")

// The send button carries the shortcut it advertises, which differs by platform.
export const sendButton = (page: Page) => page.locator("button[data-tip$='enter to send']")

export const timeline = (page: Page) => page.locator(".room__content")

// .room__content is column-reverse, so the message at the bottom of the room is first in the dom.
export const messages = (page: Page) => page.locator(".room__item")

export const message = (page: Page, text: string) => messages(page).filter({hasText: text})

export const messageActions = (page: Page, text: string) =>
  message(page, text).locator(".room__item-actions button")

export const openMessageMenu = (page: Page, text: string) =>
  message(page, text).getByRole("button", {name: "More options"}).click()

export const bubble = (page: Page, text: string) =>
  page.locator(".chat-bubble").filter({hasText: text})

// Clicking a composer that already holds the caret would collapse the selection an edit types over.
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

// The comment and thread composers are rich text rather than chat editors.
export const noteEditor = (scope: Locator | Page) =>
  scope.locator(".note-editor [contenteditable=true]")

// A date as the browser formatted it. The options mirror dateFormatter in @welshman/lib.
export const longDate = (page: Page, seconds: number) =>
  page.evaluate(
    ts =>
      new Intl.DateTimeFormat(undefined, {year: "numeric", month: "long", day: "numeric"}).format(
        new Date(ts * 1000),
      ),
    seconds,
  )
