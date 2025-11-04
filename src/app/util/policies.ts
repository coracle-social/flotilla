import {on, always, call, dissoc, assoc, uniq} from "@welshman/lib"
import type {Socket, RelayMessage, ClientMessage} from "@welshman/net"
import {
  makeSocketPolicyAuth,
  SocketEvent,
  isRelayEvent,
  isRelayOk,
  isRelayClosed,
  isClientReq,
  isClientEvent,
  isClientClose,
} from "@welshman/net"
import {sign} from "@welshman/app"
import {
  userSettingsValues,
  getSetting,
  relaysPendingTrust,
  relaysMostlyRestricted,
} from "@app/core/state"

export const authPolicy = makeSocketPolicyAuth({sign, shouldAuth: always(true)})

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
  let error = ""

  const pending = new Set<string>()

  const updateStatus = () =>
    relaysMostlyRestricted.update(
      restricted > total / 2 ? assoc(socket.url, error) : dissoc(socket.url),
    )

  const unsubscribers = [
    on(socket, SocketEvent.Receive, (message: RelayMessage) => {
      if (isRelayOk(message)) {
        const [_, id, ok, details = ""] = message

        if (pending.has(id)) {
          pending.delete(id)

          if (!ok && details.startsWith("restricted: ")) {
            restricted++
            error = details
            updateStatus()
          }
        }
      }

      if (isRelayClosed(message)) {
        const [_, id, details = ""] = message

        if (pending.has(id)) {
          pending.delete(id)

          if (details.startsWith("restricted: ")) {
            restricted++
            error = details
            updateStatus()
          }
        }
      }
    }),
    on(socket, SocketEvent.Send, (message: ClientMessage) => {
      if (isClientReq(message)) {
        total++
        pending.add(message[1])
        updateStatus()
      }

      if (isClientEvent(message)) {
        total++
        pending.add(message[1].id)
        updateStatus()
      }

      if (isClientClose(message)) {
        pending.delete(message[1])
      }
    }),
  ]

  return () => {
    unsubscribers.forEach(call)
  }
}
