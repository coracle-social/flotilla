import {reject, call, identity} from "@welshman/lib"
import {Preferences} from "@capacitor/preferences"
import {Encoding, Filesystem, Directory} from "@capacitor/filesystem"
import {IDB} from "@lib/indexeddb"

export const kv = call(() => {
  let p = Promise.resolve()

  const get = async <T>(key: string): Promise<T | undefined> => {
    const result = await Preferences.get({key})
    if (!result.value) return undefined
    try {
      return JSON.parse(result.value)
    } catch (e) {
      return undefined
    }
  }

  const set = async <T>(key: string, value: T): Promise<void> => {
    p = p.then(() => Preferences.set({key, value: JSON.stringify(value)}))

    await p
  }

  const clear = async () => {
    p = p.then(() => Preferences.clear())

    await p
  }

  return {get, set, clear}
})

export const db = new IDB({name: "flotilla-9gl", version: 1})

// Migration - we used to use capacitor's filesystem for storage, clear it out since we're
// going back to indexeddb
call(async () => {
  const res = await Filesystem.readdir({
    path: "",
    directory: Directory.Data,
  })

  await Promise.all(
    res.files.map(file =>
      Filesystem.deleteFile({
        path: file.name,
        directory: Directory.Data,
      }),
    ),
  )
})
