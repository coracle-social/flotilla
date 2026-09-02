import {get, writable} from "svelte/store"
import {on, call, dissoc, assoc, uniq} from "@welshman/lib"
import {isDVMKind, isEphemeralKind, verifyEvent} from "@welshman/util"
import type {Socket, RelayMessage, ClientMessage} from "@welshman/net"
import {
  SocketEvent,
  isRelayEvent,
  isRelayOk,
  isRelayClosed,
  isRelayNegErr,
  isClientReq,
  isClientEvent,
  isClientClose,
  isClientNegOpen,
  isClientNegClose,
  matchReason,
  RelayReasonPrefix,
} from "@welshman/net"
import {
  BlockedRelayLists,
  MessagingRelayLists,
  RelayLists,
  RoomLists,
  Thunks,
  makeAppPolicyAuth,
} from "@welshman/app"
import type {AppPolicy, IApp} from "@welshman/app"
import {app, logger, appPolicies} from "@app/core"
import {BLOCKED_RELAYS} from "@app/env"
import {userSettingsValues, getSetting, RelayAuthMode} from "@app/settings"

// Relays sending events with empty signatures that the user has to choose to trust
export const relaysPendingTrust = writable<string[]>([])

// Relays that mostly send restricted responses to requests and events
export const relaysMostlyRestricted = writable<Record<string, string>>({})

// Welshman's default ingest policy drops anything that fails signature verification, but relays
// the user has explicitly trusted are allowed to send events with an empty signature.
export const ingestPolicy: AppPolicy = app =>
  app.pool.subscribe(socket => {
    const onReceive = (message: RelayMessage) => {
      if (isRelayEvent(message)) {
        const event = message[2]
        const trusted = getSetting("trusted_relays").includes(socket.url)

        if (isDVMKind(event.kind) || isEphemeralKind(event.kind)) return
        if (!trusted && !verifyEvent(event)) return

        app.tracker.track(event.id, socket.url)
        app.repository.publish(event)
      }
    }

    socket.on(SocketEvent.Receive, onReceive)

    return () => socket.off(SocketEvent.Receive, onReceive)
  })

// Welshman's appPolicyAuthUnlessBlocked, plus the conservative mode: only identify to relays
// the user already has a relationship with.
export const authPolicy = makeAppPolicyAuth((socket, $app) => {
  const $pubkey = app.get().user?.pubkey

  if (!$pubkey) return false
  if ($app.use(BlockedRelayLists).urls($pubkey).get().includes(socket.url)) return false
  if (getSetting("relay_auth") === RelayAuthMode.Aggressive) return true
  if ($app.use(RoomLists).urls($pubkey).get().includes(socket.url)) return true
  if ($app.use(RelayLists).urls($pubkey).get().includes(socket.url)) return true
  if (get($app.use(Thunks).history).some(t => t.options.relays.includes(socket.url))) return true
  if ($app.use(MessagingRelayLists).urls($pubkey).get().includes(socket.url)) return true

  return false
})

const makeBlockPolicy = ($app: IApp) => (socket: Socket) => {
  const previousOpen = socket.open

  socket.open = () => {
    const $pubkey = $app.user?.pubkey

    if (BLOCKED_RELAYS.includes(socket.url)) return
    if ($pubkey && $app.use(BlockedRelayLists).urls($pubkey).get().includes(socket.url)) return

    previousOpen()
  }

  return () => {
    socket.open = previousOpen
  }
}

const trustPolicy = (socket: Socket) => {
  const buffer: RelayMessage[] = []

  const unsubscribers = [
    // When the socket goes from untrusted to trusted, receive all buffered messages
    userSettingsValues.subscribe($settings => {
      if ($settings.trusted_relays.includes(socket.url)) {
        for (const message of buffer.splice(0)) {
          socket._recvQueue.push(message)
        }
      }
    }),
    // When we get an event with no signature from an untrusted relay, remove it from
    // the receive queue. If trust status is undefined, buffer it for later.
    on(socket, SocketEvent.Receiving, (message: RelayMessage) => {
      if (isRelayEvent(message) && !message[2]?.sig) {
        logger.get().log("trustPolicy", {url: socket.url, message})

        const isTrusted = getSetting("trusted_relays").includes(socket.url)

        if (!isTrusted) {
          buffer.push(message)
          socket._recvQueue.remove(message)
          relaysPendingTrust.update($r => uniq([...$r, socket.url]))
        }
      }
    }),
  ]

  return () => {
    unsubscribers.forEach(call)
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

// Socket policies are installed on the pool rather than the app, so wrap them in an app policy
// to get the same construction/cleanup lifecycle as everything else.
export const socketPolicy: AppPolicy = $app => {
  const policies = [makeBlockPolicy($app), trustPolicy, mostlyRestrictedPolicy]

  $app.pool.socketPolicies.push(...policies)

  return () => {
    $app.pool.socketPolicies = $app.pool.socketPolicies.filter(p => !policies.includes(p))
  }
}

appPolicies.push(ingestPolicy, authPolicy, socketPolicy)
