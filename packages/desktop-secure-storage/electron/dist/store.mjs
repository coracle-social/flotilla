import {dirname} from "node:path"
import {randomUUID} from "node:crypto"
import {open, readFile, rename, unlink} from "node:fs/promises"

const isMissing = error => error?.code === "ENOENT"

const readValues = async ({filePath, decrypt, fs}) => {
  let encrypted

  try {
    encrypted = await fs.readFile(filePath)
  } catch (error) {
    if (isMissing(error)) {
      return {values: {}, rewrite: false}
    }
    throw error
  }

  const {result, shouldReEncrypt} = await decrypt(encrypted)
  let parsed

  try {
    parsed = JSON.parse(result)
  } catch {
    // JSON parse errors can include decrypted secrets in their messages.
    throw new Error("Encrypted desktop storage is invalid")
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Encrypted desktop storage is invalid")
  }

  for (const value of Object.values(parsed)) {
    if (typeof value !== "string") {
      throw new Error("Encrypted desktop storage is invalid")
    }
  }

  if (shouldReEncrypt) {
    return {values: parsed, rewrite: true}
  }

  return {values: parsed, rewrite: false}
}

export const createEncryptedStore = ({
  filePath,
  encrypt,
  decrypt,
  platform = process.platform,
  randomId = randomUUID,
  fs = {open, readFile, rename, unlink},
}) => {
  let values = {}
  let queue = Promise.resolve()

  const persist = async next => {
    const encrypted = await encrypt(JSON.stringify(next))
    const temporaryPath = `${filePath}.${randomId()}.tmp`

    try {
      const file = await fs.open(temporaryPath, "wx", 0o600)
      try {
        await file.writeFile(encrypted)
        await file.sync()
      } finally {
        await file.close()
      }
      await fs.rename(temporaryPath, filePath)
      if (platform !== "win32") {
        const directory = await fs.open(dirname(filePath), "r")
        try {
          await directory.sync()
        } finally {
          await directory.close()
        }
      }
    } finally {
      await fs.unlink(temporaryPath).catch(() => undefined)
    }
  }

  const load = async () => {
    const loaded = await readValues({filePath, decrypt, fs})
    values = loaded.values

    if (loaded.rewrite) {
      await persist(values)
    }
  }

  const ready = load()

  const enqueue = operation => {
    const result = queue.then(async () => {
      await ready
      return operation()
    })
    queue = result.catch(() => undefined)
    return result
  }

  const get = key => enqueue(() => values[key])

  const set = (key, value) =>
    enqueue(async () => {
      if (typeof value !== "string") {
        throw new TypeError("Desktop secret values must be strings")
      }
      const next = {...values, [key]: value}
      await persist(next)
      values = next
    })

  const remove = key =>
    enqueue(async () => {
      if (!Object.hasOwn(values, key)) {
        return
      }
      const next = {...values}
      delete next[key]
      await persist(next)
      values = next
    })

  const clear = () =>
    enqueue(async () => {
      const previous = values

      try {
        await fs.unlink(filePath).catch(error => {
          if (!isMissing(error)) {
            throw error
          }
        })
        values = {}
      } catch (error) {
        values = previous
        throw error
      }
    })

  return {ready, get, set, remove, clear}
}
