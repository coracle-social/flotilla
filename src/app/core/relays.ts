import {derived, readable, writable} from "svelte/store"
import {assoc, call, dissoc, noop, on} from "@welshman/lib"
import type {Maybe} from "@welshman/lib"
import type {RelayMessage, Socket} from "@welshman/net"
import {
  AuthStateEvent,
  AuthStatus,
  RelayReasonPrefix,
  SocketEvent,
  SocketStatus,
  isRelayClosed,
  isRelayEose,
  isRelayEvent,
  isRelayNegErr,
  isRelayNegMsg,
  isRelayOk,
  matchReason,
} from "@welshman/net"
import {throttled} from "@welshman/store"
import {BlockedRelayLists} from "@welshman/app"
import type {IApp} from "@welshman/app"
import {appPolicies, fromApp} from "@app/core/app"
import {isStaleAuth} from "@app/core/auth"
import {BLOCKED_RELAYS, PLATFORM_RELAYS} from "@app/core/env"
import {relaysPendingTrust} from "@app/core/ingest"

export enum RelayAccessStatus {
  Connecting = "connecting",
  Disconnected = "disconnected",
  Unreachable = "unreachable",
  Authenticating = "authenticating",
  AwaitingSignature = "awaiting-signature",
  SignerFailed = "signer-failed",
  Denied = "denied",
  Untrusted = "untrusted",
  Connected = "connected",
}

// Whether the app can use a relay, and what to tell the user when it can't.
export type RelayAccess =
  | {status: Exclude<RelayAccessStatus, RelayAccessStatus.Denied>}
  | {status: RelayAccessStatus.Denied; reason: string}

// Relays that refused several requests in a row, with the reason they gave last.
const deniedRelays = writable<Record<string, string>>({})

const getRelayAccess = (
  socket: Socket,
  denial: Maybe<string>,
  pendingTrust: string[],
): RelayAccess => {
  if (socket.status === SocketStatus.Opening) {
    return {status: RelayAccessStatus.Connecting}
  }

  if (socket.status === SocketStatus.Closing || socket.status === SocketStatus.Closed) {
    return {status: RelayAccessStatus.Disconnected}
  }

  if (socket.status === SocketStatus.Error) {
    return {status: RelayAccessStatus.Unreachable}
  }

  if (socket.auth.status === AuthStatus.PendingSignature) {
    return {status: RelayAccessStatus.AwaitingSignature}
  }

  // A refusal of a stale auth event is answered with a fresh one, so the handshake is still running.
  if (
    socket.auth.status === AuthStatus.Requested ||
    socket.auth.status === AuthStatus.PendingResponse ||
    isStaleAuth(socket)
  ) {
    return {status: RelayAccessStatus.Authenticating}
  }

  // Welshman denies a signature only when the signer fails; a relay refusal is Forbidden.
  if (socket.auth.status === AuthStatus.DeniedSignature) {
    return {status: RelayAccessStatus.SignerFailed}
  }

  if (socket.auth.status === AuthStatus.Forbidden) {
    return {status: RelayAccessStatus.Denied, reason: socket.auth.details || "access denied"}
  }

  if (denial) {
    return {status: RelayAccessStatus.Denied, reason: denial}
  }

  if (pendingTrust.includes(socket.url)) {
    return {status: RelayAccessStatus.Untrusted}
  }

  return {status: RelayAccessStatus.Connected}
}

export const deriveSocket = (url: string) =>
  fromApp($app => {
    const socket = $app.pool.get(url)

    return readable(socket, set => {
      const unsubscribers = [
        on(socket, SocketEvent.Status, () => set(socket)),
        on(socket.auth, AuthStateEvent.Status, () => set(socket)),
      ]

      return () => unsubscribers.forEach(call)
    })
  })

export const deriveRelayAccess = (url: string) =>
  throttled(
    800,
    derived(
      [deriveSocket(url), deniedRelays, relaysPendingTrust],
      ([$socket, $deniedRelays, $relaysPendingTrust]) =>
        getRelayAccess($socket, $deniedRelays[url], $relaysPendingTrust),
    ),
  )

// Policies

// A relay outside the platform or blocked is never connected to, and is dropped once blocked.
const makeBlockPolicy = ($app: IApp) => (socket: Socket) => {
  const blockedUrls = $app.user ? $app.use(BlockedRelayLists).urls($app.user.pubkey) : undefined
  const outsidePlatform = PLATFORM_RELAYS.length > 0 && !PLATFORM_RELAYS.includes(socket.url)
  const previousOpen = socket.open

  socket.open = () => {
    if (
      !outsidePlatform &&
      !BLOCKED_RELAYS.includes(socket.url) &&
      !blockedUrls?.get().includes(socket.url)
    ) {
      previousOpen()
    }
  }

  const unsubscribe =
    blockedUrls?.$.subscribe($urls => {
      if ($urls.includes(socket.url)) {
        socket.close()
      }
    }) ?? noop

  return () => {
    socket.open = previousOpen
    unsubscribe()
  }
}

const isServed = (message: RelayMessage) =>
  isRelayEvent(message) ||
  isRelayEose(message) ||
  isRelayNegMsg(message) ||
  (isRelayOk(message) && message[2])

// A read refused for access is about the session, since a REQ carries nothing to object to.
const isAccessRefusal = (message: RelayMessage) =>
  (isRelayClosed(message) || isRelayNegErr(message)) &&
  (matchReason(RelayReasonPrefix.Restricted, message[2]) ||
    matchReason(RelayReasonPrefix.Blocked, message[2]))

// A relay refusing reads and serving nothing has turned the session away, not the request.
const denialPolicy = (socket: Socket) => {
  let denial = ""
  let timeout: Maybe<ReturnType<typeof setTimeout>>

  const allow = () => {
    clearTimeout(timeout)
    timeout = undefined
    deniedRelays.update(dissoc(socket.url))
  }

  // Some relays restrict a few reads and serve the rest, so wait to see whether anything comes back.
  const refuse = (reason: string) => {
    denial = reason

    if (!timeout) {
      timeout = setTimeout(() => deniedRelays.update(assoc(socket.url, denial)), 3000)
    }
  }

  const onReceive = (message: RelayMessage) => {
    if (isServed(message)) {
      allow()
    } else if (isAccessRefusal(message)) {
      refuse(message[2])
    }
  }

  const unsubscribers = [
    on(socket, SocketEvent.Receive, onReceive),
    // Authenticating changes who the relay is judging.
    on(socket.auth, AuthStateEvent.Status, (status: AuthStatus) => {
      if (status === AuthStatus.Ok) {
        allow()
      }
    }),
  ]

  return () => {
    clearTimeout(timeout)
    unsubscribers.forEach(call)
  }
}

export const registerRelays = () => {
  appPolicies.push(
    $app => $app.pool.addSocketPolicy(makeBlockPolicy($app)),
    $app => {
      const removePolicy = $app.pool.addSocketPolicy(denialPolicy)

      return () => {
        removePolicy()
        deniedRelays.set({})
      }
    },
  )
}
