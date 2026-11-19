import {get, writable} from "svelte/store"
import {page} from "$app/stores"
import {assoc, gt, int, now, parseJson, throttle, HOUR} from "@welshman/lib"
import {synced, withGetter} from "@welshman/store"
import {app} from "@app/core/app"
import {dufflepud, DUFFLEPUD_URL} from "@app/core/env"
import {getHttpAuthHeader} from "@app/core/signer"
import {kv} from "@app/core/storage"
import {registerLoginHandler} from "@app/core/session"

export const checked = withGetter(
  synced<Record<string, number>>({
    key: "checked",
    defaultValue: {},
    storage: kv,
  }),
)

export const getChecked = (key: string) => checked.get()[key]

export const setChecked = (key: string) => checked.update(assoc(key, now()))

// A wildcard entry covers every path with its prefix, and any other entry covers its own path and its parents.
export const isChecked = ($checked: Record<string, number>, path: string, timestamp: number) =>
  Object.entries($checked).some(([entryPath, ts]) => {
    const isMatch = entryPath.endsWith("*")
      ? path.startsWith(entryPath.slice(0, -1))
      : entryPath.startsWith(path)

    return isMatch && ts > timestamp
  })

// Paths that stay unread while they're on screen, such as a room whose chat a call hides.
export const heldPaths = writable(new Set<string>())

export const holdChecked = (path: string) => heldPaths.update($paths => new Set($paths).add(path))

export const releaseChecked = (path: string) =>
  heldPaths.update($paths => new Set([...$paths].filter(p => p !== path)))

export const getPaths = (path: string) =>
  path
    .split("/")
    .map((_, i, segments) => segments.slice(0, i + 1).join("/"))
    .slice(1)

export const syncChecked = () => {
  let prev: string[] = []

  return page.subscribe($page => {
    // Set checked when we leave a given page
    checked.update($checked => {
      for (const path of prev) {
        $checked[path] = now()
      }

      return $checked
    })

    const paths = getPaths($page.url.pathname)

    // Set checked when we visit a given page - but delay it a tad
    setTimeout(() => {
      const $heldPaths = get(heldPaths)

      checked.update($checked => {
        for (const path of paths) {
          if (!$heldPaths.has(path)) {
            $checked[path] = now()
          }
        }

        return $checked
      })
    }, 300)

    prev = paths
  })
}

const CHECKED_KV_KEY = "checked"
const getAuthHeader = () => getHttpAuthHeader(DUFFLEPUD_URL, int(23, HOUR))

const pullCheckedRemote = async () => {
  const authorization = await getAuthHeader()
  const res = await fetch(dufflepud(`kv/${CHECKED_KV_KEY}`), {headers: {authorization}})

  if (!res.ok) {
    return
  }

  const remote = parseJson<Record<string, number>>(await res.text())

  if (!remote) {
    return
  }

  checked.update($checked => {
    for (const [path, ts] of Object.entries(remote)) {
      if (gt(ts, $checked[path])) {
        $checked[path] = ts
      }
    }

    return $checked
  })
}

const pushCheckedRemote = throttle(3000, async () => {
  const authorization = await getAuthHeader()

  try {
    await fetch(dufflepud(`kv/${CHECKED_KV_KEY}`), {
      method: "POST",
      headers: {authorization},
      body: JSON.stringify(checked.get()),
    })
  } catch {
    // pass
  }
})

export const syncCheckedRemote = () => {
  let ready = false

  const unsubscribeUser = app.subscribe($app => {
    ready = false

    if ($app.user) {
      pullCheckedRemote().then(() => {
        ready = true
        pushCheckedRemote()
      })
    }
  })

  const unsubscribeChecked = checked.subscribe(() => {
    if (ready && app.get().user?.pubkey) {
      pushCheckedRemote()
    }
  })

  return () => {
    unsubscribeUser()
    unsubscribeChecked()
  }
}

// A device that logs in would otherwise show everything the account ever received as unread.
export const registerChecked = () => {
  registerLoginHandler(() => setChecked("*"))
}
