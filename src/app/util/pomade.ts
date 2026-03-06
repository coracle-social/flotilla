import {get} from "svelte/store"
import {Client, type SessionItem, type ClientOptions} from "@pomade/core"
import {ifLet, reject, spec} from "@welshman/lib"
import {session, isPomadeSession, loginWithPomade as _loginWithPomade} from "@welshman/app"

export const getPomadeClient = async () => {
  const $session = get(session)

  if (isPomadeSession($session)) {
    return new Client($session.clientOptions)
  }
}

export type PomadeSessionWithPeers = SessionItem & {peers: string[]}

export const loadPomadeSessions = async () => {
  const sessionMap = new Map<string, PomadeSessionWithPeers>()
  const client = await getPomadeClient()

  if (client) {
    const result = await client.listSessions()

    for (const message of result.messages) {
      if (!message.res?.items) continue

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
  _loginWithPomade(clientOptions.group.group_pk.slice(2), email, clientOptions)
