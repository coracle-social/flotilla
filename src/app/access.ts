import {derived} from "svelte/store"
import {dissoc, fromPairs, last, poll, randomId, tryCatch} from "@welshman/lib"
import {AuthStatus, RelayReasonPrefix, SocketStatus, matchReason} from "@welshman/net"
import type {Socket} from "@welshman/net"
import {
  displayRelayUrl,
  isRelayUrl,
  makeEvent,
  normalizeRelayUrl,
  relay,
  FOLLOWS,
  MESSAGING_RELAYS,
  PROFILE,
  RELAYS,
} from "@welshman/util"
import {RelayJoin, RelayLeave, RoomJoin, RoomLeave} from "@welshman/domain"
import {Sync, User, publish} from "@welshman/app"
import {stripPrefix} from "@lib/util"
import {app, command, roomLists, thunks, writer} from "@app/core"
import {PLATFORM_URL} from "@app/env"
import {relaysMostlyRestricted} from "@app/policies"
import {optInSpaceNotifications} from "@app/push"
import {deriveSocket} from "@app/relays"
import {removeTrustedRelay} from "@app/settings"
import {syncApplicationData} from "@app/sync"

export const ROOM_CREATE_INVITE = 9009

export type InviteData = {
  url: string
  claim: string
  h?: string
  code?: string
}

export const parseInviteLink = (invite: string): InviteData | undefined => {
  if (invite.length < 3 || !invite.includes(".")) {
    return
  }

  return (
    tryCatch(() => {
      const params = fromPairs(Array.from(new URL(invite).searchParams))
      const {r: relay = "", c: claim = "", h = "", code = ""} = params
      const url = normalizeRelayUrl(relay)

      if (isRelayUrl(url)) {
        return {url, claim, h: h || undefined, code: code || undefined}
      }
    }) ||
    tryCatch(() => {
      const url = normalizeRelayUrl(invite)

      if (isRelayUrl(url)) {
        return {url, claim: ""}
      }
    })
  )
}

export const makeInviteLink = (data: InviteData) => {
  const params = new URLSearchParams({
    r: displayRelayUrl(data.url),
    c: data.claim,
  })

  if (data.h) {
    params.set("h", data.h)
  }

  if (data.code) {
    params.set("code", data.code)
  }

  return PLATFORM_URL + "/join?" + params.toString()
}

export const shouldIgnoreError = (error: string) => {
  const isIgnored = matchReason(RelayReasonPrefix.Mute, error)
  const isAborted = error.includes("Signing was aborted")
  const isStrictNip29Relay = error.includes("missing group (`h`) tag")

  return isIgnored || isAborted || isStrictNip29Relay
}

export const deriveRelayAuthError = (url: string) =>
  derived([relaysMostlyRestricted, deriveSocket(url)], ([$relaysMostlyRestricted, $socket]) => {
    if ($socket.auth.status === AuthStatus.Forbidden && $socket.auth.details) {
      return stripPrefix($socket.auth.details)
    }

    if ($relaysMostlyRestricted[url]) {
      return stripPrefix($relaysMostlyRestricted[url])
    }
  })

export const publishJoinRequest = (url: string, claim?: string) => {
  const eventWriter = writer(RelayJoin).forceRoutes(relay(url))

  if (claim) {
    eventWriter.setClaim(claim)
  }

  return command(eventWriter).then(publish)
}

export const publishLeaveRequest = (url: string) =>
  command(writer(RelayLeave).forceRoutes(relay(url))).then(publish)

// "duplicate:" and "already a member" both leave us where we wanted to be.
const isMembershipRefusal = (error: string) =>
  Boolean(error) && !error.startsWith("duplicate:") && !error.includes("already")

// Joining takes two publishes: the NIP-29 request the relay can refuse, and the user's room list.
export const joinRoom = async (url: string, h: string, code?: string) => {
  const eventWriter = writer(RoomJoin).setRoom(url, h)

  if (code) {
    eventWriter.setClaim(code)
  }

  const thunk = await command(eventWriter).then(publish)
  const error = await thunk.waitForError()

  if (isMembershipRefusal(error)) {
    return error
  }

  await roomLists.get().addRoom(h, url).then(publish)
}

export const leaveRoom = async (url: string, h: string) => {
  const thunk = await command(writer(RoomLeave).setRoom(url, h)).then(publish)
  const error = await thunk.waitForError()

  if (isMembershipRefusal(error)) {
    return error
  }

  await roomLists.get().removeRoom(h, url).then(publish)
}

export const leaveSpace = async (url: string) => {
  await roomLists.get().removeRelay(url).then(publish)
  await publishLeaveRequest(url)
  await removeTrustedRelay(url)
}

export const publishRoomInvite = async (url: string, h: string) => {
  const code = randomId()
  const event = makeEvent(ROOM_CREATE_INVITE, {
    tags: [
      ["h", h],
      ["code", code],
    ],
  })

  const error = await thunks
    .get()
    .publish({event, relays: [url]})
    .waitForError()

  if (error) {
    return {error, code: undefined}
  }

  return {error: undefined, code}
}

const authTerminalStatuses = [
  AuthStatus.None,
  AuthStatus.Ok,
  AuthStatus.Forbidden,
  AuthStatus.DeniedSignature,
]

const waitForAuth = async (socket: Socket) => {
  await poll({
    signal: AbortSignal.timeout(10_000),
    condition: () => authTerminalStatuses.includes(socket.auth.status),
  }).catch(() => {})
}

const formatAuthError = (status: AuthStatus, details?: string) => {
  if (status === AuthStatus.DeniedSignature) {
    return "Failed to authenticate — check your signer"
  }

  if (status === AuthStatus.PendingSignature) {
    return "Failed to authenticate — approve the signing request from your extension or signer"
  }

  const message = details || last(status.split(":"))

  return `Failed to authenticate (${message})`
}

export const attemptRelayAccess = async (url: string, claim = "") => {
  const socket = app.get().pool.get(url)

  socket.attemptToOpen()

  await poll({
    signal: AbortSignal.timeout(3000),
    condition: () => socket.status === SocketStatus.Open,
  })

  if (socket.status !== SocketStatus.Open) {
    return `Failed to connect`
  }

  await poll({
    signal: AbortSignal.timeout(3000),
    condition: () => socket.auth.status === AuthStatus.Requested,
  })

  for (let i = 0; i < 3 && !authTerminalStatuses.includes(socket.auth.status); i++) {
    await socket.auth.retryAuth(User.require(app.get()).sign)
    await waitForAuth(socket)
  }

  if (![AuthStatus.None, AuthStatus.Ok].includes(socket.auth.status)) {
    return formatAuthError(socket.auth.status, socket.auth.details)
  }

  const thunk = await publishJoinRequest(url, claim)
  const error = await thunk.waitForError()

  if (shouldIgnoreError(error)) {
    return
  }

  if (error.includes("invite code")) {
    return "join request rejected"
  }

  // A space that isn't open to the public refuses a join carrying no claim at all
  if (error.includes("claim")) {
    return "This space requires an invite code"
  }

  return stripPrefix(error)
}

export const completeSpaceJoin = async (url: string, notifications: boolean) => {
  await optInSpaceNotifications(url, notifications)
  await roomLists.get().addRelay(url).then(publish)
  relaysMostlyRestricted.update(dissoc(url))
  syncApplicationData()
  app
    .get()
    .use(Sync)
    .push({
      relays: [url],
      filters: [
        {
          kinds: [RELAYS, MESSAGING_RELAYS, FOLLOWS, PROFILE],
          authors: [User.require(app.get()).pubkey],
        },
      ],
    })
}

export const acceptInvite = async (data: InviteData, notifications: boolean) => {
  const spaceUrls = roomLists.get().urls(User.require(app.get()).pubkey).get()

  if (!spaceUrls.includes(data.url)) {
    const error = await attemptRelayAccess(data.url, data.claim)

    if (error) {
      return error
    }

    await completeSpaceJoin(data.url, notifications)
  }

  if (data.h && data.code) {
    return joinRoom(data.url, data.h, data.code)
  }
}
