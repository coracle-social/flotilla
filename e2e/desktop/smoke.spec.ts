import {mkdir, mkdtemp, readFile, rm, writeFile} from "node:fs/promises"
import {createRequire} from "node:module"
import {tmpdir} from "node:os"
import {join, resolve} from "node:path"
import {_electron, expect, test} from "@playwright/test"

declare global {
  interface Window {
    Capacitor: {
      Plugins: {
        DesktopSecureStorage: {
          get(options: {key: string}): Promise<{value?: string}>
          set(options: {key: string; value: string}): Promise<void>
        }
      }
    }
  }
}

test("the desktop app renders, navigates, and keeps external pages outside", async () => {
  const profile = await mkdtemp(join(tmpdir(), "flotilla-desktop-"))
  const env = {...process.env, XDG_DATA_HOME: join(profile, "data")}

  try {
    const packaged = process.env.FLOTILLA_DESKTOP_EXECUTABLE
    const {appId} = JSON.parse(await readFile("electron/generated/capacitor.config.json", "utf8"))
    const entryPath = join(env.XDG_DATA_HOME, "applications", `${appId}.desktop`)
    const existingEntry =
      "[Desktop Entry]\nExec=/installed/app.AppImage\nX-Electron-Generated=true\n"
    if (!packaged && process.platform === "linux") {
      await mkdir(join(env.XDG_DATA_HOME, "applications"), {recursive: true})
      await writeFile(entryPath, existingEntry)
    }
    const executablePath: string =
      packaged || createRequire(import.meta.url)(resolve("electron/node_modules/electron"))
    let app = await _electron.launch({
      executablePath,
      env,
      // Chromium refuses to start as root with its sandbox on, which is what a CI container is.
      chromiumSandbox: packaged ? true : process.getuid?.() !== 0,
      args: [...(packaged ? [] : [resolve("electron")]), `--user-data-dir=${profile}`],
    })

    try {
      expect(await app.evaluate(({app}) => app.getPath("userData"))).toBe(profile)
      if (packaged && process.platform === "linux") {
        const entry = await readFile(entryPath, "utf8")
        expect(entry).toContain(`Icon=${join(env.XDG_DATA_HOME, "icons", `${appId}.png`)}`)
        expect(entry).not.toContain("/tmp/.mount_")
      } else if (process.platform === "linux") {
        expect(await readFile(entryPath, "utf8")).toBe(existingEntry)
      }
      const mainWindows = () =>
        app.windows().filter(page => page.url().startsWith("capacitor-electron://"))
      await expect.poll(() => mainWindows().length).toBe(1)
      const [page] = mainWindows()
      const errors: string[] = []

      page.on("pageerror", error => errors.push(error.message))

      await page.reload()
      const heading = page.getByRole("heading")

      await expect(heading).toBeVisible()
      await expect(page).toHaveTitle(
        (await heading.textContent())!.replace(/^Welcome to\s*|!$/g, ""),
      )
      expect(
        await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme),
      ).toBe(await page.locator("body").getAttribute("data-theme"))
      const origin = await page.evaluate(() => location.origin)
      expect(origin).toMatch(/^capacitor-electron:\/\//)
      expect(await page.locator('script[src*="@vite/client"]').count()).toBe(0)

      if (packaged) {
        const {version} = JSON.parse(await readFile("package.json", "utf8"))
        expect(await app.evaluate(({app}) => app.isPackaged)).toBe(true)
        expect(await app.evaluate(({app}) => app.getName())).toBe(await page.title())
        expect(await app.evaluate(({app}) => app.getVersion())).toBe(version)
        expect(await app.evaluate(({app}) => app.getAppPath())).toMatch(/app\.asar$/)
        const updater = await app.evaluate(async ({app}) => {
          const {createRequire} = process.getBuiltinModule("node:module")
          const {readFile} = process.getBuiltinModule("node:fs/promises")
          const {join} = process.getBuiltinModule("node:path")
          const require = createRequire(join(app.getAppPath(), "package.json"))
          return {
            version: require("electron-updater").autoUpdater.currentVersion.version,
            config: require("js-yaml").load(
              await readFile(join(app.getAppPath(), "..", "app-update.yml"), "utf8"),
            ),
          }
        })
        expect(updater.version).toBe(version)
        expect(updater.config).toMatchObject({
          provider: "generic",
          url: "https://gitea.coracle.social/coracle/flotilla/releases/download/latest/",
        })
        expect(await app.evaluate(({app}) => app.commandLine.hasSwitch("no-sandbox"))).toBe(false)
        const preferences = await app.browserWindow(page).then(window =>
          window.evaluate(window => {
            const {sandbox, contextIsolation, nodeIntegration} =
              window.webContents.getLastWebPreferences()
            return {sandbox, contextIsolation, nodeIntegration}
          }),
        )
        expect(preferences).toEqual({sandbox: true, contextIsolation: true, nodeIntegration: false})
        await page.screenshot({path: test.info().outputPath("packaged-onboarding.png")})
      }

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

      if (packaged) {
        const contract = await app.evaluate(async ({safeStorage}) => ({
          available: await safeStorage.isAsyncEncryptionAvailable(),
          decrypted: await safeStorage.decryptStringAsync(
            await safeStorage.encryptStringAsync("api-contract"),
          ),
        }))
        expect(contract.available).toBe(true)
        expect(contract.decrypted.result).toBe("api-contract")
        expect(typeof contract.decrypted.shouldReEncrypt).toBe("boolean")
        const fixture = "packaged-desktop-secret"
        await page.evaluate(async value => {
          await window.Capacitor.Plugins.DesktopSecureStorage.set({key: "desktop-smoke", value})
        }, fixture)
        expect((await readFile(join(profile, "secure-storage.bin"))).includes(fixture)).toBe(false)

        await app.close()
        app = await _electron.launch({
          executablePath,
          env,
          chromiumSandbox: true,
          args: [`--user-data-dir=${profile}`],
        })
        await expect.poll(() => mainWindows().length).toBe(1)
        const [relaunched] = mainWindows()
        await relaunched.waitForFunction(() =>
          Boolean(window.Capacitor?.Plugins?.DesktopSecureStorage),
        )
        expect(
          await relaunched.evaluate(() =>
            window.Capacitor.Plugins.DesktopSecureStorage.get({key: "desktop-smoke"}),
          ),
        ).toEqual({value: fixture})
      }
    } finally {
      await app.close()
    }
  } finally {
    await rm(profile, {recursive: true, force: true})
  }
})
