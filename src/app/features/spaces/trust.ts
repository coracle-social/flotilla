import {writable} from "svelte/store"
import {on, call, uniq} from "@welshman/lib"
import type {Socket, RelayMessage} from "@welshman/net"
import {SocketEvent, isRelayEvent} from "@welshman/net"
import {appPolicies} from "@app/core/app"
import {logger} from "@app/core/plugins"
import {userSettingsValues, getSetting} from "@app/core/settings"

// Relays sending events with empty signatures that the user has to choose to trust
export const relaysPendingTrust = writable<string[]>([])

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
    // An unsigned event from an untrusted relay is dropped, and one of undefined trust is buffered.
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

export const registerTrust = () => {
  appPolicies.push($app => $app.pool.addSocketPolicy(trustPolicy))
}
