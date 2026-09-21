import {Client, type SessionItem, type ClientOptions} from "@pomade/core"
import {ifLet, reject, spec} from "@welshman/lib"
import type {Maybe} from "@welshman/lib"
import {pomade, toSession} from "@welshman/app"
import type {Session} from "@welshman/app"
import {login, session} from "@app/core"

export type PomadeSession = Session<"pomade", {clientOptions: ClientOptions; email: string}>

export const isPomadeSession = ($session: Maybe<Session>): $session is PomadeSession =>
  $session?.method === pomade.method

// The pomade-only screens are only reachable from a pomade session, so narrow rather than
// thread undefined through every field they read off it.
export const requirePomadeSession = ($session: Maybe<Session>) => {
  if (!isPomadeSession($session)) {
    throw new Error("This action requires an email login")
  }

  return $session
}

export const getPomadeClient = async () => {
  const $session = session.get()

  if (isPomadeSession($session)) {
    return new Client($session.data.clientOptions)
  }
}

export type PomadeSessionWithPeers = SessionItem & {peers: string[]}

export const loadPomadeSessions = async () => {
  const sessionMap = new Map<string, PomadeSessionWithPeers>()
  const client = await getPomadeClient()

  if (client) {
    const result = await client.listSessions()

    for (const message of result.messages) {
      if (!message.res?.items) {
        continue
      }

      for (const item of message.res.items) {
        const existing = sessionMap.get(item.client)

        if (existing) {
          existing.peers.push(message.url)
        } else {
          sessionMap.set(item.client, {...item, peers: [message.url]})
        }
      }
    }
  }

  return Array.from(sessionMap.values())
}

export const loadOtherPomadeSessions = async () => {
  const client = await getPomadeClient()

  if (!client) {
    return []
  }

  return reject(spec({client: await client.getPubkey()}), await loadPomadeSessions())
}

export const deletePomadeSession = async (clientPubkey: string, peers: string[]) =>
  ifLet(await getPomadeClient(), client => client.deleteSession(clientPubkey, peers))

export const deactivatePomadeSession = async (clientPubkey: string, peers: string[]) =>
  ifLet(await getPomadeClient(), client => client.deactivateSession(clientPubkey, peers))

export const deleteCurrentPomadeSession = async () =>
  ifLet(await getPomadeClient(), async client =>
    client.deleteSession(await client.getPubkey(), client.peers),
  )

export const deactivateCurrentPomadeSession = async () =>
  ifLet(await getPomadeClient(), async client =>
    client.deactivateSession(await client.getPubkey(), client.peers),
  )

export const deleteDeactivatedPomadeSessions = async () => {
  const sessions = await loadOtherPomadeSessions()

  for (const item of sessions || []) {
    if (item.deactivated_at) {
      await deletePomadeSession(item.client, item.peers)
    }
  }
}

export const loginWithPomade = (clientOptions: ClientOptions, email: string) =>
  login(toSession(pomade, {clientOptions, email}))

export const POMADE_INVALID_LOGIN_MESSAGE = "Invalid login information"
export const POMADE_NETWORK_ERROR_MESSAGE = "Network error, please try again"

type PomadeMessage = {
  res?: unknown
}

export const getPomadeLoginFailureMessage = (messages: PomadeMessage[]) =>
  messages.some(message => message.res !== undefined)
    ? POMADE_INVALID_LOGIN_MESSAGE
    : POMADE_NETWORK_ERROR_MESSAGE
