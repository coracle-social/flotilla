import {open, mkdtemp, readFile, rename, rm, stat, unlink, writeFile} from "node:fs/promises"
import {tmpdir} from "node:os"
import {join} from "node:path"
import {afterEach, describe, it} from "node:test"
import assert from "node:assert/strict"
import {createEncryptedStore} from "../electron/dist/store.mjs"

const directories = []

const makeDirectory = async () => {
  const directory = await mkdtemp(join(tmpdir(), "flotilla-secure-storage-"))
  directories.push(directory)
  return directory
}

const makeCrypto = ({reEncrypt = false} = {}) => ({
  encrypt: async value => Buffer.from(`enc:${Buffer.from(value).toString("base64")}`),
  decrypt: async value => ({
    result: Buffer.from(value.toString().slice(4), "base64").toString(),
    shouldReEncrypt: reEncrypt,
  }),
})

const makeStore = async (options = {}) => {
  const directory = await makeDirectory()
  const crypto = makeCrypto(options)
  const store = createEncryptedStore({
    filePath: join(directory, "secure-storage.bin"),
    ...crypto,
    ...options,
  })
  await store.ready
  return {directory, store}
}

afterEach(async () => {
  await Promise.all(
    directories.splice(0).map(directory => rm(directory, {recursive: true, force: true})),
  )
})

describe("encrypted desktop store", () => {
  it("starts with an empty map when the encrypted file is missing", async () => {
    const {store} = await makeStore()
    assert.equal(await store.get("session"), undefined)
  })

  it("persists values without plaintext", async () => {
    const {directory, store} = await makeStore()
    await store.set("session", "fixture-secret")
    assert.equal(await store.get("session"), "fixture-secret")
    const file = await readFile(join(directory, "secure-storage.bin"))
    assert.equal(file.includes("fixture-secret"), false)
    if (process.platform !== "win32") {
      assert.equal((await stat(join(directory, "secure-storage.bin"))).mode & 0o777, 0o600)
    }
  })

  it("serializes concurrent writes", async () => {
    const {directory, store} = await makeStore()
    await Promise.all([
      store.set("session", "a"),
      store.set("wallet", "b"),
      store.set("sessions", "c"),
    ])
    const reopened = createEncryptedStore({
      filePath: join(directory, "secure-storage.bin"),
      ...makeCrypto(),
    })
    await reopened.ready
    assert.deepEqual(
      await Promise.all([
        reopened.get("session"),
        reopened.get("wallet"),
        reopened.get("sessions"),
      ]),
      ["a", "b", "c"],
    )
  })

  it("preserves empty string values", async () => {
    const {store} = await makeStore()
    await store.set("empty", "")
    assert.equal(await store.get("empty"), "")
  })

  it("removes individual values and clears the encrypted file", async () => {
    const {directory, store} = await makeStore()
    await store.set("session", "fixture-secret")
    await store.set("wallet", "wallet-secret")
    await store.remove("session")
    assert.equal(await store.get("session"), undefined)
    assert.equal(await store.get("wallet"), "wallet-secret")
    await store.clear()
    assert.equal(await store.get("wallet"), undefined)
    await assert.rejects(readFile(join(directory, "secure-storage.bin")), {code: "ENOENT"})
  })

  it("leaves the previous file when a replacement fails", async () => {
    const {directory, store} = await makeStore()
    await store.set("session", "before")
    const failing = createEncryptedStore({
      filePath: join(directory, "secure-storage.bin"),
      ...makeCrypto(),
      fs: {
        open,
        readFile,
        rename: async () => {
          throw new Error("replacement failed")
        },
        unlink: async () => undefined,
        writeFile,
      },
    })
    await failing.ready
    await assert.rejects(failing.set("session", "after"), /replacement failed/)
    const reopened = createEncryptedStore({
      filePath: join(directory, "secure-storage.bin"),
      ...makeCrypto(),
    })
    await reopened.ready
    assert.equal(await reopened.get("session"), "before")
  })

  it("keeps the previous file when flushing the replacement fails", async () => {
    const {directory, store} = await makeStore()
    await store.set("session", "before")
    const filePath = join(directory, "secure-storage.bin")
    const original = await readFile(filePath)
    const failing = createEncryptedStore({
      filePath,
      ...makeCrypto(),
      fs: {
        readFile,
        rename,
        unlink,
        open: async (...args) => {
          const file = await open(...args)
          return {
            writeFile: value => file.writeFile(value),
            sync: async () => {
              throw new Error("flush failed")
            },
            close: () => file.close(),
          }
        },
      },
    })
    await assert.rejects(failing.set("session", "after"), /flush failed/)
    assert.deepEqual(await readFile(filePath), original)
    assert.equal(await failing.get("session"), "before")
  })

  it("rewrites values when the key provider requests re-encryption", async () => {
    const {directory, store} = await makeStore()
    await store.set("session", "fixture-secret")
    let writes = 0
    const reopened = createEncryptedStore({
      filePath: join(directory, "secure-storage.bin"),
      ...makeCrypto({reEncrypt: true}),
      fs: {
        open,
        readFile,
        unlink,
        rename: async (...args) => {
          writes += 1
          return rename(...args)
        },
      },
    })
    await reopened.ready
    assert.equal(await reopened.get("session"), "fixture-secret")
    assert.equal(writes, 1)
  })

  it("rejects corrupt encrypted data", async () => {
    const directory = await makeDirectory()
    const filePath = join(directory, "secure-storage.bin")
    await writeFile(filePath, "corrupt")
    const store = createEncryptedStore({filePath, ...makeCrypto()})
    await assert.rejects(store.ready, /Encrypted desktop storage is invalid/)
  })

  it("rejects undecryptable encrypted data", async () => {
    const directory = await makeDirectory()
    const filePath = join(directory, "secure-storage.bin")
    await writeFile(filePath, "encrypted")
    const store = createEncryptedStore({
      filePath,
      encrypt: async value => Buffer.from(value),
      decrypt: async () => {
        throw new Error("decrypt failed")
      },
    })
    await assert.rejects(store.ready, /decrypt failed/)
  })
})
