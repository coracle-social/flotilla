import {derived, readable, writable} from "svelte/store"
import {assoc, call, dissoc, noop, on} from "@welshman/lib"
import type {Maybe} from "@welshman/lib"
import type {Socket} from "@welshman/net"
import {
  AuthStateEvent,
  AuthStatus,
  SocketEvent,
  SocketStatus,
  makeSocketPolicyRefusals,
} from "@welshman/net"
import {throttled} from "@welshman/store"
import {BlockedRelayLists} from "@welshman/app"
import type {IApp} from "@welshman/app"
import {appPolicies, fromApp} from "@app/core/app"
import {isStaleAuth} from "@app/core/auth"
import {BLOCKED_RELAYS} from "@app/core/env"
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

// A relay the deployment or the user has blocked is never connected to, and is dropped once blocked.
const makeBlockPolicy = ($app: IApp) => (socket: Socket) => {
  const blockedUrls = $app.user ? $app.use(BlockedRelayLists).urls($app.user.pubkey) : undefined
  const previousOpen = socket.open

  socket.open = () => {
    if (!BLOCKED_RELAYS.includes(socket.url) && !blockedUrls?.get().includes(socket.url)) {
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

// Serving one request shows the relay grants some access, and authenticating changes who it's judging.
const denialPolicy = (socket: Socket) => {
  let refusals = 0

  const allow = () => {
    refusals = 0
    deniedRelays.update(dissoc(socket.url))
  }

  const refuse = (_: Socket, reason: string) => {
    refusals++

    if (refusals > 5) {
      deniedRelays.update(assoc(socket.url, reason))
    }
  }

  const unsubscribers = [
    makeSocketPolicyRefusals({onAllowed: allow, onRefused: refuse})(socket),
    on(socket.auth, AuthStateEvent.Status, (status: AuthStatus) => {
      if (status === AuthStatus.Ok) {
        allow()
      }
    }),
  ]

  return () => unsubscribers.forEach(call)
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
