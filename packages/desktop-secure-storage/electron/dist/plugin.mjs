import {app, dialog, safeStorage} from "electron"
import {unlink} from "node:fs/promises"
import {join} from "node:path"
import {createEncryptedStore} from "./store.mjs"

export class DesktopSecureStorage {
  static __capacitorElectronPlugin = {
    name: "DesktopSecureStorage",
    methods: ["get", "set", "remove", "clear"],
  }

  filePath
  store
  ready

  async initialize() {
    await app.whenReady()
    this.filePath = join(app.getPath("userData"), "secure-storage.bin")

    if (
      process.platform === "linux" &&
      ["basic_text", "unknown"].includes(safeStorage.getSelectedStorageBackend())
    ) {
      throw new Error("A protected Linux storage backend is unavailable")
    }

    if (!(await safeStorage.isAsyncEncryptionAvailable())) {
      throw new Error("Protected storage encryption is unavailable")
    }

    this.store = createEncryptedStore({
      filePath: this.filePath,
      encrypt: plainText => safeStorage.encryptStringAsync(plainText),
      decrypt: encrypted => safeStorage.decryptStringAsync(encrypted),
    })
    await this.store.ready
  }

  async load() {
    this.ready ??= this.initialize().catch(error => {
      console.error("Desktop protected storage could not initialize", error)
      const values = new Map()
      this.store = {
        get: key => values.get(key),
        set: (key, value) => {
          values.set(key, value)
        },
        remove: key => {
          values.delete(key)
        },
        clear: async () => {
          await unlink(this.filePath).catch(error => {
            if (error.code !== "ENOENT") {
              throw error
            }
          })
          values.clear()
        },
      }
      dialog.showErrorBox(
        app.getName(),
        "Protected storage could not be opened. This session will not be saved after closing the app. Unlock or configure the operating system keyring or keychain and restart. Any previously saved credentials have been left untouched.",
      )
    })
    await this.ready
  }

  async get({key}) {
    await this.load()
    return {value: await this.store.get(key)}
  }

  async set({key, value}) {
    await this.load()
    return this.store.set(key, value)
  }

  async remove({key}) {
    await this.load()
    return this.store.remove(key)
  }

  async clear() {
    await this.load()
    return this.store.clear()
  }
}
