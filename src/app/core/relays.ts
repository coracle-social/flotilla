import {derived, readable, writable} from "svelte/store"
import {assoc, call, dissoc, on} from "@welshman/lib"
import {normalizeRelayUrl} from "@welshman/util"
import type {ClientMessage, RelayMessage, Socket} from "@welshman/net"
import {
  AuthStateEvent,
  AuthStatus,
  RelayReasonPrefix,
  SocketEvent,
  SocketStatus,
  isClientClose,
  isClientEvent,
  isClientNegClose,
  isClientNegOpen,
  isClientReq,
  isRelayClosed,
  isRelayNegErr,
  isRelayOk,
  matchReason,
} from "@welshman/net"
import {throttled} from "@welshman/store"
import {BlockedRelayLists} from "@welshman/app"
import type {IApp} from "@welshman/app"
import {app, appPolicies} from "@app/core/app"
import {relays} from "@app/core/plugins"
import {BLOCKED_RELAYS, INDEXER_RELAYS} from "@app/core/env"
import {registerSync} from "@app/core/sync"
import {userSearchRelayList} from "@app/core/user"

// Relays that mostly send restricted responses to requests and events
export const relaysMostlyRestricted = writable<Record<string, string>>({})

export const encodeRelay = (url: string) =>
  encodeURIComponent(
    normalizeRelayUrl(url)
      .replace(/^wss:\/\//, "")
      .replace(/\/$/, ""),
  )

export const decodeRelay = (url: string) => normalizeRelayUrl(decodeURIComponent(url))

export const deriveSocket = (url: string) => {
  const socket = app.get().pool.get(url)

  return readable(socket, set => {
    const subs = [
      on(socket, SocketEvent.Error, () => set(socket)),
      on(socket, SocketEvent.Status, () => set(socket)),
      on(socket.auth, AuthStateEvent.Status, () => set(socket)),
    ]

    return () => subs.forEach(call)
  })
}

export enum RelayConnection {
  Connecting = "connecting",
  Disconnected = "disconnected",
  ConnectFailed = "connect-failed",
  Authenticating = "authenticating",
  AwaitingSignature = "awaiting-signature",
  SignerFailed = "signer-failed",
  AccessDenied = "access-denied",
  Connected = "connected",
}

export const deriveSocketStatus = (url: string) =>
  throttled(
    800,
    derived([deriveSocket(url), relaysMostlyRestricted], ([$socket, $relaysMostlyRestricted]) => {
      if ($socket.status === SocketStatus.Opening) {
        return RelayConnection.Connecting
      }

      if ($socket.status === SocketStatus.Closing || $socket.status === SocketStatus.Closed) {
        return RelayConnection.Disconnected
      }

      if ($socket.status === SocketStatus.Error) {
        return RelayConnection.ConnectFailed
      }

      if ($socket.auth.status === AuthStatus.PendingSignature) {
        return RelayConnection.AwaitingSignature
      }

      if (
        $socket.auth.status === AuthStatus.Requested ||
        $socket.auth.status === AuthStatus.PendingResponse
      ) {
        return RelayConnection.Authenticating
      }

      // Welshman denies a signature only when the signer fails; a relay refusal is Forbidden.
      if ($socket.auth.status === AuthStatus.DeniedSignature) {
        return RelayConnection.SignerFailed
      }

      if ($socket.auth.status === AuthStatus.Forbidden || $relaysMostlyRestricted[url]) {
        return RelayConnection.AccessDenied
      }

      return RelayConnection.Connected
    }),
  )

// Policies

const makeBlockPolicy = ($app: IApp) => (socket: Socket) => {
  const previousOpen = socket.open

  socket.open = () => {
    const $pubkey = $app.user?.pubkey

    if (BLOCKED_RELAYS.includes(socket.url)) {
      return
    }
    if ($pubkey && $app.use(BlockedRelayLists).urls($pubkey).get().includes(socket.url)) {
      return
    }

    previousOpen()
  }

  return () => {
    socket.open = previousOpen
  }
}

const mostlyRestrictedPolicy = (socket: Socket) => {
  let total = 0
  let refused = 0

  const pending = new Set<string>()

  const updateStatus = (error?: string) => {
    if (total > 5 && refused > total / 2) {
      if (error) {
        return relaysMostlyRestricted.update(assoc(socket.url, error))
      }
    } else {
      relaysMostlyRestricted.update(dissoc(socket.url))
    }
  }

  // NIP-01 reserves "blocked: " for a ban and "restricted: " for lacking permission.
  const countDetails = (details: string) => {
    if (matchReason(RelayReasonPrefix.AuthRequired, details)) {
      total--
      updateStatus()
    }

    if (
      matchReason(RelayReasonPrefix.Restricted, details) ||
      matchReason(RelayReasonPrefix.Blocked, details)
    ) {
      refused++
      updateStatus(details)
    }
  }

  const unsubscribers = [
    on(socket, SocketEvent.Receive, (message: RelayMessage) => {
      if (isRelayOk(message)) {
        const [_, id, ok, details = ""] = message

        if (pending.has(id)) {
          pending.delete(id)

          if (!ok) {
            countDetails(details)
          }
        }
      }

      if (isRelayClosed(message) || isRelayNegErr(message)) {
        const [_, id, details = ""] = message

        if (pending.has(id)) {
          pending.delete(id)
          countDetails(details)
        }
      }
    }),
    on(socket, SocketEvent.Send, (message: ClientMessage) => {
      if (isClientReq(message) || isClientNegOpen(message)) {
        if (!pending.has(message[1])) {
          total++
          pending.add(message[1])
          updateStatus()
        }
      }

      if (isClientEvent(message)) {
        total++
        pending.add(message[1].id)
        updateStatus()
      }

      if (isClientClose(message) || isClientNegClose(message)) {
        pending.delete(message[1])
      }
    }),
  ]

  return () => {
    unsubscribers.forEach(call)
  }
}

const syncRelays = () => {
  for (const url of INDEXER_RELAYS) {
    relays.get().load(url)
  }

  return userSearchRelayList.subscribe($searchRelayList => {
    for (const url of $searchRelayList?.urls() ?? []) {
      relays.get().load(url)
    }
  })
}

export const registerRelays = () => {
  appPolicies.push(
    $app => $app.pool.addSocketPolicy(makeBlockPolicy($app)),
    $app => $app.pool.addSocketPolicy(mostlyRestrictedPolicy),
  )

  registerSync(syncRelays)
}
