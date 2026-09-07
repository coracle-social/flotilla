import {mkdtemp, rm} from "node:fs/promises"
import {createRequire} from "node:module"
import {tmpdir} from "node:os"
import {join, resolve} from "node:path"
import {_electron, expect, test} from "@playwright/test"

test("the desktop baseline renders, navigates, and keeps external pages outside", async () => {
  const profile = await mkdtemp(join(tmpdir(), "flotilla-desktop-"))

  try {
    const executablePath: string = createRequire(import.meta.url)(
      resolve("electron/node_modules/electron"),
    )
    const app = await _electron.launch({
      executablePath,
      // Chromium refuses to start as root with its sandbox on, which is what a CI container is.
      chromiumSandbox: process.getuid?.() !== 0,
      args: [resolve("electron")],
      env: {...process.env, XDG_CONFIG_HOME: profile},
    })

    try {
      const mainWindows = () =>
        app.windows().filter(page => page.url().startsWith("capacitor-electron://"))
      await expect.poll(() => mainWindows().length).toBe(1)
      const [page] = mainWindows()
      const errors: string[] = []

      page.on("pageerror", error => errors.push(error.message))

      await page.reload()
      await expect(page.getByRole("heading")).toBeVisible()
      const origin = await page.evaluate(() => location.origin)
      expect(origin).toMatch(/^capacitor-electron:\/\//)

      await page.getByRole("button", {name: "Log in", exact: true}).click()
      await expect(page.getByTestId("login")).toBeVisible()

      await page.goto(`${origin}/settings/profile`)
      await expect(page.getByRole("heading")).toBeVisible()
      await page.reload()
      await expect(page.getByRole("heading")).toBeVisible()
      expect(new URL(page.url()).pathname).toBe("/settings/profile")

      expect(
        await page.evaluate(async () => {
          const url = URL.createObjectURL(
            new Blob(["onmessage = event => postMessage(event.data)"], {type: "text/javascript"}),
          )
          const worker = new Worker(url)

          try {
            return await new Promise<string>((resolve, reject) => {
              worker.onmessage = event => resolve(event.data)
              worker.onerror = event => reject(new Error(event.message))
              worker.postMessage("desktop worker ready")
            })
          } finally {
            worker.terminate()
            URL.revokeObjectURL(url)
          }
        }),
      ).toBe("desktop worker ready")

      const externalUrls = await app.evaluateHandle(({shell}) => {
        const urls: string[] = []
        shell.openExternal = async (url: string) => {
          urls.push(url)
        }
        return urls
      })
      const externalLink = page.locator('a[target="_blank"][href^="https:"]').first()
      const externalUrl = await externalLink.evaluate((link: HTMLAnchorElement) => link.href)
      await externalLink.click()
      await expect.poll(() => externalUrls.jsonValue()).toContain(externalUrl)
      expect(await page.evaluate(() => location.origin)).toBe(origin)
      expect(app.windows()).toHaveLength(1)

      expect(errors).toEqual([])

      await page.evaluate(() => {
        document.addEventListener(
          "securitypolicyviolation",
          ({effectiveDirective}) => {
            document.documentElement.dataset.cspViolation = effectiveDirective
          },
          {once: true},
        )
        const script = document.createElement("script")
        script.textContent = "document.documentElement.dataset.inlineScriptExecuted = 'true'"
        document.head.appendChild(script)
        script.remove()
      })
      await expect(page.locator("html")).toHaveAttribute("data-csp-violation", "script-src-elem")
      await expect(page.locator("html")).not.toHaveAttribute("data-inline-script-executed")
    } finally {
      await app.close()
    }
  } finally {
    await rm(profile, {recursive: true, force: true})
  }
})
