import {verifyEvent} from "@welshman/util"
import type {RelayMessage} from "@welshman/net"
import {SocketEvent, isRelayEvent} from "@welshman/net"
import type {AppPolicy} from "@welshman/app"
import {appPolicies} from "@app/core/app"
import {getSetting} from "@app/core/settings"

// Relays the user has explicitly trusted may send events with an empty signature.
const ingestPolicy: AppPolicy = app =>
  app.pool.subscribe(socket => {
    const onReceive = (message: RelayMessage) => {
      if (isRelayEvent(message)) {
        const event = message[2]

        if (getSetting("trusted_relays").includes(socket.url) || verifyEvent(event)) {
          app.ingestEvent(event, socket.url)
        }
      }
    }

    socket.on(SocketEvent.Receive, onReceive)

    return () => socket.off(SocketEvent.Receive, onReceive)
  })

export const registerIngest = () => {
  appPolicies.push(ingestPolicy)
}
