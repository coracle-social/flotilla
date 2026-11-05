import {writable} from "svelte/store"
import {call} from "@welshman/lib"
import type {Maybe} from "@welshman/lib"
import {withGetter} from "@welshman/store"
import {User} from "@welshman/app"
import type {Session} from "@welshman/app"
import {getTestSession, publishTestEvents} from "@lib/test/session"
import {app, replaceApp} from "@app/core/app"
import {hasCachedIdentity, kv, openRepository, pluginCaches, ss} from "@app/core/storage"

export const session = withGetter(writable<Maybe<Session>>(undefined))

export const login = async ($session: Session) => {
  const $user = await User.fromSession($session)

  if (!$user) {
    throw new Error(`Unable to log in using ${$session.method}`)
  }

  replaceApp($user, await openRepository($user.pubkey))
  session.set($session)
}

const logoutHandlers: (() => Promise<unknown>)[] = []

export const registerLogoutHandler = (handler: () => Promise<unknown>) => {
  logoutHandlers.push(handler)
}

// The session derives from the app's user, so read it back at startup and persist it on a change.
export const restoreSession = async () => {
  const testSession = getTestSession()

  if (testSession) {
    await login(testSession)

    // Test events stand in for what storage held, so they land once it has loaded.
    await pluginCaches.get()?.ready
    await publishTestEvents(app.get().repository)
  } else {
    const $session = await ss.get<Session>("session")

    // A nip01 secret is the account rather than a credential, and a local signer can't stall startup.
    if ($session) {
      if ($session.method === "nip01" || (await hasCachedIdentity())) {
        await login($session)
      } else {
        await ss.set("session", undefined)
      }
    }
  }

  return session.subscribe($session => {
    if ($session) {
      ss.set("session", $session)
    }
  })
}

// A revoked signer can leave the app unable to start, so this clears the device without asking it anything.
export const resetSession = async () => {
  await kv.clear()
  await ss.clear()
  await pluginCaches.get()?.clear()

  localStorage.clear()

  window.location.href = "/"
}

export const logout = async () => {
  await Promise.all(logoutHandlers.map(call))
  await resetSession()
}
