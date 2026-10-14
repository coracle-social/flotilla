import {get, writable} from "svelte/store"
import {page} from "$app/stores"
import {assoc, gt, int, now, parseJson, throttle, HOUR} from "@welshman/lib"
import {synced, withGetter} from "@welshman/store"
import {app} from "@app/core/app"
import {dufflepud, DUFFLEPUD_URL} from "@app/core/env"
import {getHttpAuthHeader} from "@app/core/signer"
import {kv} from "@app/core/storage"

export const checked = withGetter(
  synced<Record<string, number>>({
    key: "checked",
    defaultValue: {},
    storage: kv,
  }),
)

export const getChecked = (key: string) => checked.get()[key]

export const setChecked = (key: string) => checked.update(assoc(key, now()))

/** Room path while video call UI hides chat; checked + badge stay active until chat is shown. */
export const deferredRoomPath = writable<string | undefined>(undefined)

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
      const $deferredRoomPath = get(deferredRoomPath)

      checked.update($checked => {
        for (const path of paths) {
          if (path !== $deferredRoomPath) {
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
