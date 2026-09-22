import assert from "node:assert/strict"
import {mkdtemp, readFile, rm, writeFile} from "node:fs/promises"
import {registerHooks} from "node:module"
import {tmpdir} from "node:os"
import {join} from "node:path"
import {it, mock} from "node:test"

it("keeps failed initialization usable without overwriting saved credentials", async () => {
  const directory = await mkdtemp(join(tmpdir(), "desktop-plugin-"))
  const filePath = join(directory, "secure-storage.bin")
  const warnings = []
  const electron = {
    app: {whenReady: async () => {}, getPath: () => directory, getName: () => "Test"},
    dialog: {showErrorBox: (...args) => warnings.push(args)},
    safeStorage: {
      getSelectedStorageBackend: () => "gnome_libsecret",
      isAsyncEncryptionAvailable: async () => true,
      encryptStringAsync: async () => {
        throw new Error("must not overwrite")
      },
      decryptStringAsync: async () => {
        throw new Error("key unavailable")
      },
    },
  }
  globalThis.testElectron = electron
  const hooks = registerHooks({
    resolve(specifier, context, next) {
      return specifier === "electron"
        ? {
            url: "data:text/javascript,export const {app, dialog, safeStorage} = globalThis.testElectron",
            shortCircuit: true,
          }
        : next(specifier, context)
    },
  })
  const log = mock.method(console, "error", () => {})

  try {
    const {DesktopSecureStorage} = await import("../electron/dist/plugin.mjs")
    for (const backend of ["gnome_libsecret", "basic_text", "unknown"]) {
      electron.safeStorage.getSelectedStorageBackend = () => backend
      await writeFile(filePath, "original encrypted credentials")
      const plugin = new DesktopSecureStorage()
      await Promise.all([plugin.load(), plugin.load()])
      assert.equal((await plugin.get({key: "session"})).value, undefined)
      await plugin.set({key: "session", value: "temporary secret"})
      assert.equal((await plugin.get({key: "session"})).value, "temporary secret")
      assert.equal(await readFile(filePath, "utf8"), "original encrypted credentials")
      await plugin.remove({key: "session"})
      assert.equal((await plugin.get({key: "session"})).value, undefined)
      await plugin.clear()
      await assert.rejects(readFile(filePath), {code: "ENOENT"})
    }
    assert.equal(warnings.length, 3)
    assert.equal(log.mock.callCount(), 3)
  } finally {
    log.mock.restore()
    hooks.deregister()
    delete globalThis.testElectron
    await rm(directory, {recursive: true, force: true})
  }
})
