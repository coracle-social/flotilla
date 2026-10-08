import {Capacitor} from "@capacitor/core"
import {derived, writable} from "svelte/store"
import {append, dissoc, fromPairs, last, poll, randomId, remove, tryCatch} from "@welshman/lib"
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
import {Relays, Sync, User, publish} from "@welshman/app"
import {stripPrefix} from "@lib/util"
import {
  app,
  command,
  fromApp,
  publisher,
  relayMemberLists,
  relays,
  roomLists,
  writer,
} from "@app/core"
import {PLATFORM_URL} from "@app/env"
import {getPaymentsUrl, isRelayPaid} from "@app/payments"
import {relaysMostlyRestricted} from "@app/policies"
import {optInSpaceNotifications} from "@app/push"
import {deriveSocket} from "@app/relays"
import {makeSpacePath} from "@app/routes"
import {publishRoomList} from "@app/rooms"
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
  !error.startsWith("duplicate:") && !error.includes("already")

// Joining takes two publishes: the NIP-29 request the relay can refuse, and the user's room list.
export const joinRoom = async (url: string, h: string, code?: string) => {
  const eventWriter = writer(RoomJoin).setRoom(url, h)

  if (code) {
    eventWriter.setClaim(code)
  }

  const publication = await command(eventWriter).then(publish)
  const error = (await publication.settled()).getError()

  if (error && isMembershipRefusal(error)) {
    return error
  }

  await roomLists.get().addRoom(h, url).then(publishRoomList)
}

export const leaveRoom = async (url: string, h: string) => {
  const publication = await command(writer(RoomLeave).setRoom(url, h)).then(publish)
  const error = (await publication.settled()).getError()

  if (error && isMembershipRefusal(error)) {
    return error
  }

  await roomLists.get().removeRoom(h, url).then(publishRoomList)
}

export const leaveSpace = async (url: string) => {
  await roomLists.get().removeRelay(url).then(publishRoomList)
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

  const publication = publisher.get().publish({event, relays: [url]})
  const error = (await publication.settled()).getError()

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

  const publication = await publishJoinRequest(url, claim)
  const error = (await publication.settled()).getError()

  if (error && !shouldIgnoreError(error)) {
    if (error.includes("invite code")) {
      return "join request rejected"
    }

    // A space that isn't open to the public refuses a join carrying no claim at all
    if (error.includes("claim")) {
      return "This space requires an invite code"
    }

    return stripPrefix(error)
  }
}

export const completeSpaceJoin = async (url: string, notifications: boolean) => {
  await optInSpaceNotifications(url, notifications)
  await roomLists.get().addRelay(url).then(publishRoomList)
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

// Paid spaces

// Gated out by price rather than by invitation: it charges, and they have not paid.
export const derivePaidGated = (url: string) =>
  derived(
    [fromApp($app => $app.use(Relays).one(url)), relayMemberLists.get().forUrl(url), app],
    ([$relay, $members, $app]) => {
      const pubkey = $app.user?.pubkey

      return Boolean(isRelayPaid($relay) && pubkey && !$members?.isMember(pubkey))
    },
  )

// Urls a checkout was opened for this session. A forgotten one is covered by membership sync.
export const pendingCheckouts = writable<string[]>([])

/**
 * Open a relay's payment page, naming the pubkey being paid for and where to
 * come back to. `payments_url` may carry a query of its own, so the parameters
 * are appended rather than written.
 */
export const openCheckout = (url: string) => {
  const paymentsUrl = getPaymentsUrl(relays.get().get(url))

  if (!paymentsUrl) {
    return "This space has not said where to pay."
  }

  // A payment page comes back to the app by universal link on native.
  const origin = Capacitor.isNativePlatform() ? PLATFORM_URL : location.origin
  const checkoutUrl = new URL(paymentsUrl)

  checkoutUrl.searchParams.set("pubkey", User.require(app.get()).pubkey)
  checkoutUrl.searchParams.set("return_url", origin + makeSpacePath(url))

  pendingCheckouts.update($urls => append(url, $urls))

  location.href = checkoutUrl.toString()
}

/**
 * Ask the relay again whether the user is a member, and finish the join if they
 * are. Membership is the source of truth: the return redirect is best effort,
 * and a payment made in another browser lands here too.
 */
export const reconcileSpaceMembership = async (url: string) => {
  // Auth that ended Forbidden before the payment never retries on its own.
  app.get().pool.get(url).close()
  relaysMostlyRestricted.update(dissoc(url))

  const members = await relayMemberLists.get().forceLoad(url)

  if (!members?.isMember(User.require(app.get()).pubkey)) {
    return false
  }

  await completeSpaceJoin(url, true)

  pendingCheckouts.update($urls => remove(url, $urls))

  return true
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
