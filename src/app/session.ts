import type {ClientOptions} from "@pomade/core"
import type {Wallet} from "@welshman/util"
import {nip01, nip07, nip46, nip55, pomade, toSession} from "@welshman/app"
import type {Session} from "@welshman/app"
import {getTestEvents, maybeGetTestSession} from "@lib/test/session"
import {app, login, session} from "@app/core"
import {wallet} from "@app/lightning"
import {kv, ss, storage} from "@app/storage"
import {deactivateCurrentPomadeSession} from "@app/pomade"
import {Push} from "@app/push"

// Sessions were a Record keyed by an active pubkey, so convert one rather than logging people out.
type LegacySession = {
  method: string
  pubkey: string
  secret?: string
  signer?: string
  email?: string
  clientOptions?: ClientOptions
  handler?: {pubkey: string; relays: string[]}
  wallet?: Wallet
}

const toCurrentSession = (legacy: LegacySession): Session | undefined => {
  switch (legacy.method) {
    case "nip01":
      return legacy.secret ? toSession(nip01, {secret: legacy.secret}) : undefined
    case "nip07":
      return toSession(nip07, {})
    case "nip46":
      return legacy.secret && legacy.handler
        ? toSession(nip46, {
            clientSecret: legacy.secret,
            signerPubkey: legacy.handler.pubkey,
            relays: legacy.handler.relays,
          })
        : undefined
    case "nip55":
      return legacy.signer
        ? toSession(nip55, {pubkey: legacy.pubkey, signer: legacy.signer})
        : undefined
    case "pomade":
      return legacy.clientOptions && legacy.email
        ? toSession(pomade, {clientOptions: legacy.clientOptions, email: legacy.email})
        : undefined
  }
}

const readLegacySession = async () => {
  const pubkey = await kv.get<string>("pubkey")
  const sessions = await ss.get<Record<string, LegacySession>>("sessions")
  const legacy = pubkey ? sessions?.[pubkey] : undefined

  if (legacy?.wallet) {
    wallet.set(legacy.wallet)
  }

  return legacy ? toCurrentSession(legacy) : undefined
}

// The session derives from the app's user, so read it back at startup and persist it on a change.
export const restoreSession = async () => {
  // Test-only: an injected window.__TEST_SESSION__ wins over storage and is stripped from production.
  const testSession = import.meta.env.DEV ? maybeGetTestSession() : undefined
  const $session = testSession ?? (await ss.get<Session>("session")) ?? (await readLegacySession())

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
  await Push.disable()
  await resetSession()
}
