import type {Locator, Page} from "@playwright/test"

// A file as the browser's own chooser takes one.
export type TestFile = {
  name: string
  mimeType: string
  buffer: Buffer
}

// A real 1x1 gif. Gif rather than png because compressFileForUpload passes it through untouched
// instead of re-encoding it through a canvas, so the bytes the server hashes are the bytes chosen
// here and the url an upload resolves to is predictable from node. The base64 is what a spec hands
// to the page, since a Buffer does not survive the trip into evaluate().
export const GIF_BASE64 = "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"

export const GIF = Buffer.from(GIF_BASE64, "base64")

// A 1x1 webp, which the compressor passes through for the same reason.
export const WEBP = Buffer.from("UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==", "base64")

export const gifFile = (name: string): TestFile => ({name, mimeType: "image/gif", buffer: GIF})

// Every picker in the app opens the browser's own chooser, which is the only place a spec can hand
// it a file: the input behind it is never on screen.
export const chooseFile = async (page: Page, button: Locator, file: TestFile) => {
  const chooser = page.waitForEvent("filechooser")

  await button.click()
  await (await chooser).setFiles(file)
}
