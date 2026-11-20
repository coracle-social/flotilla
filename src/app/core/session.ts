import {writable} from "svelte/store"
import {call, randomId} from "@welshman/lib"
import type {Maybe} from "@welshman/lib"
import {withGetter} from "@welshman/store"
import {User} from "@welshman/app"
import type {Session} from "@welshman/app"
import {getTestSession, publishTestEvents} from "@lib/test/session"
import {app, replaceApp, upgradeApp} from "@app/core/app"
import {
  hasCachedIdentity,
  kv,
  openRepository,
  pluginCaches,
  rememberIdentity,
  ss,
} from "@app/core/storage"

export const session = withGetter(writable<Maybe<Session>>(undefined))

// Set by a tab that logs out, so the others stop showing what it deleted
const LOGGED_OUT = "flotilla-logged-out"

const openSession = async ($session: Session) => {
  const $user = await User.fromSession($session)

  if (!$user) {
    throw new Error(`Unable to log in using ${$session.method}`)
  }

  replaceApp($user, await openRepository($user.pubkey))
  session.set($session)
}

const loginHandlers: (() => unknown)[] = []

export const registerLoginHandler = (handler: () => unknown) => {
  loginHandlers.push(handler)
}

// Restoring a session at startup opens it without these, since they're for a user logging in.
export const login = async ($session: Session) => {
  // A password reset logs the same account in again, which replaces its app as at startup.
  if (app.get().user) {
    await openSession($session)
  } else {
    const $user = await User.fromSession($session)

    if (!$user) {
      throw new Error(`Unable to log in using ${$session.method}`)
    }

    // A visitor's events stay in memory for the rest of the session, and the database opens at the next start.
    await rememberIdentity($user.pubkey)
    upgradeApp($user)
    session.set($session)
  }

  await Promise.all(loginHandlers.map(call))
}

const logoutHandlers: (() => Promise<unknown>)[] = []

export const registerLogoutHandler = (handler: () => Promise<unknown>) => {
  logoutHandlers.push(handler)
}

// The session derives from the app's user, so read it back at startup and persist it on a change.
export const restoreSession = async () => {
  const testSession = getTestSession()

  if (testSession) {
    await openSession(testSession)

    // Test events stand in for what storage held, so they land once it has loaded.
    await pluginCaches.get()?.ready
    await publishTestEvents(app.get().repository)
  } else {
    const $session = await ss.get<Session>("session")

    // A nip01 secret is the account rather than a credential, and a local signer can't stall startup.
    if ($session) {
      if ($session.method === "nip01" || (await hasCachedIdentity())) {
        await openSession($session)
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

  // What every other tab reads its session from is gone, so tell them to look again
  localStorage.setItem(LOGGED_OUT, randomId())

  window.location.href = "/"
}

// Another tab's logout leaves this one showing an identity the device no longer holds
export const syncLogout = () => {
  const onStorage = ({key, newValue}: StorageEvent) => {
    if (key === LOGGED_OUT && newValue) {
      window.location.href = "/"
    }
  }

  window.addEventListener("storage", onStorage)

  return () => window.removeEventListener("storage", onStorage)
}

export const logout = async () => {
  await Promise.all(logoutHandlers.map(call))
  await resetSession()
}
