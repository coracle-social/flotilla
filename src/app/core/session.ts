import {writable} from "svelte/store"
import {call} from "@welshman/lib"
import type {Maybe} from "@welshman/lib"
import {withGetter} from "@welshman/store"
import {User} from "@welshman/app"
import type {Session} from "@welshman/app"
import {getTestEvents, maybeGetTestSession} from "@lib/test/session"
import {app, replaceApp} from "@app/core/app"
import {hasCachedIdentity, kv, ss, storage} from "@app/core/storage"
import {deactivateCurrentPomadeSession} from "@app/core/pomade"

export const session = withGetter(writable<Maybe<Session>>(undefined))

export const login = async ($session: Session) => {
  const $user = await User.fromSession($session)

  if (!$user) {
    throw new Error(`Unable to log in using ${$session.method}`)
  }

  replaceApp($user)
  session.set($session)
}

const logoutHandlers: (() => Promise<unknown>)[] = []

export const registerLogoutHandler = (handler: () => Promise<unknown>) => {
  logoutHandlers.push(handler)
}

const readStoredSession = async () => {
  const session = await ss.get<Session>("session")

  // A nip01 secret is the account rather than a credential, and a local signer can't stall startup.
  if (session && session.method !== "nip01" && !(await hasCachedIdentity())) {
    await ss.set("session", undefined)

    return undefined
  }

  return session
}

// The session derives from the app's user, so read it back at startup and persist it on a change.
export const restoreSession = async () => {
  // Test-only: an injected window.__TEST_SESSION__ wins over storage and is stripped from production.
  const testSession = import.meta.env.DEV ? maybeGetTestSession() : undefined
  const $session = testSession ?? (await readStoredSession())

  if ($session) {
    await login($session)
  }

  // Storage loads with Repository.load, which clears the repository, so these wait for it.
  if (testSession) {
    await storage.get()?.ready

    for (const event of getTestEvents()) {
      app.get().repository.publish(event)
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
  await storage.get()?.clear()

  localStorage.clear()

  window.location.href = "/"
}

export const logout = async () => {
  await deactivateCurrentPomadeSession()
  await Promise.all(logoutHandlers.map(call))
  await resetSession()
}
