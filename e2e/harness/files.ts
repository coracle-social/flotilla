import type {Locator, Page} from "@playwright/test"
import {composerAddButton} from "./ui"

// A file as the browser's own chooser takes one.
export type TestFile = {
  name: string
  mimeType: string
  buffer: Buffer
}

// Gif rather than png, since compressFileForUpload passes it through instead of re-encoding it.
export const GIF_BASE64 = "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"

export const GIF = Buffer.from(GIF_BASE64, "base64")

// A 1x1 webp, which the compressor passes through for the same reason.
export const WEBP = Buffer.from("UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==", "base64")

export const gifFile = (name: string): TestFile => ({name, mimeType: "image/gif", buffer: GIF})

// Every picker opens the browser's own chooser, and the input behind it is never on screen.
export const chooseFile = async (page: Page, button: Locator, file: TestFile) => {
  const chooser = page.waitForEvent("filechooser")

  await button.click()
  await (await chooser).setFiles(file)
}

// The composer's picker sits behind the + button, and in a room behind the create menu under it.
export const attachFile = async (page: Page, file: TestFile) => {
  const add = composerAddButton(page)
  const inMenu = (await add.getAttribute("aria-label")) === "Attach or create"
  const chooser = page.waitForEvent("filechooser")

  await add.click()

  if (inMenu) {
    await page.getByRole("button", {name: "Photo or File"}).click()
  }

  await (await chooser).setFiles(file)
}
