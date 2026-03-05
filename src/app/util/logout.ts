import {get} from "svelte/store"
import {Client} from "@pomade/core"
import {getPubkey} from "@welshman/util"
import {session, isPomadeSession} from "@welshman/app"
import {kv, db} from "@app/core/storage"
import {Push} from "@app/util/notifications"

export const logout = async () => {
  const $session = get(session)

  if ($session && isPomadeSession($session)) {
    await new Client($session.clientOptions).deactivateSession(
      getPubkey($session.clientOptions.secret),
      $session.clientOptions.peers,
    )
  }

  await Push.disable()
  await kv.clear()
  await db.clear()

  localStorage.clear()

  window.location.href = "/"
}
