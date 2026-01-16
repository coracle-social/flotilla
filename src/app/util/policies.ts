import {get} from "svelte/store"
import {on, call, dissoc, assoc, uniq} from "@welshman/lib"
import {RelayMode} from "@welshman/util"
import type {Socket, RelayMessage, ClientMessage} from "@welshman/net"
import {
  makeSocketPolicyAuth,
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
} from "@welshman/net"
import {sign, pubkey, getPubkeyRelays} from "@welshman/app"
import {
  userSettingsValues,
  getSetting,
  relaysPendingTrust,
  relaysMostlyRestricted,
  RelayAuthMode,
  NOTIFIER_RELAY,
  userSpaceUrls,
} from "@app/core/state"

export const authPolicy = makeSocketPolicyAuth({
  sign,
  shouldAuth: (socket: Socket) => {
    const $pubkey = pubkey.get()
    const mode = getSetting<RelayAuthMode>("relay_auth")

    if (!$pubkey) return false
    if (socket.url === NOTIFIER_RELAY) return true
    if (mode === RelayAuthMode.Aggressive) return true
    if (get(userSpaceUrls).includes(socket.url)) return true
    if (getPubkeyRelays($pubkey).includes(socket.url)) return true
    if (getPubkeyRelays($pubkey, RelayMode.Messaging).includes(socket.url)) return true

    return false
  },
})

export const blockPolicy = (socket: Socket) => {
  const previousOpen = socket.open

  socket.open = () => {
    const $pubkey = pubkey.get()

    if (!$pubkey || !getPubkeyRelays($pubkey, RelayMode.Blocked).includes(socket.url)) {
      return previousOpen()
    }
  }

  return () => {
    socket.open = previousOpen
  }
}

export const trustPolicy = (socket: Socket) => {
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
        const isTrusted = getSetting<string[]>("trusted_relays").includes(socket.url)

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

export const mostlyRestrictedPolicy = (socket: Socket) => {
  let total = 0
  let restricted = 0

  const pending = new Set<string>()

  const updateStatus = (error?: string) => {
    if (restricted > total / 2) {
      if (error) {
        return relaysMostlyRestricted.update(assoc(socket.url, error))
      }
    } else {
      relaysMostlyRestricted.update(dissoc(socket.url))
    }
  }

  const unsubscribers = [
    on(socket, SocketEvent.Receive, (message: RelayMessage) => {
      if (isRelayOk(message)) {
        const [_, id, ok, details = ""] = message

        if (pending.has(id)) {
          pending.delete(id)

          if (!ok) {
            if (details.startsWith("auth-required: ")) {
              total--
              updateStatus()
            }

            if (details.startsWith("restricted: ")) {
              restricted++
              updateStatus(details)
            }
          }
        }
      }

      if (isRelayClosed(message) || isRelayNegErr(message)) {
        const [_, id, details = ""] = message

        if (pending.has(id)) {
          pending.delete(id)

          if (details.startsWith("auth-required: ")) {
            total--
            updateStatus()
          }

          if (details.startsWith("restricted: ")) {
            restricted++
            updateStatus(details)
          }
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
