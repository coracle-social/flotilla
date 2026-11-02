import {writable} from "svelte/store"
import {call, pushToMapKey, uniq} from "@welshman/lib"
import {verifyEvent} from "@welshman/util"
import type {TrustedEvent} from "@welshman/util"
import type {RelayMessage} from "@welshman/net"
import {SocketEvent, isRelayEvent} from "@welshman/net"
import {Logger} from "@welshman/app"
import type {AppPolicy} from "@welshman/app"
import {appPolicies} from "@app/core/app"
import {Settings} from "@app/core/settings"

// Relays sending events with empty signatures, which the user has yet to decide whether to trust.
export const relaysPendingTrust = writable<string[]>([])

// A relay the user trusts may strip signatures, and an unsigned event from any other waits until they decide.
const ingestPolicy: AppPolicy = app => {
  const settings = app.use(Settings).values
  const held = new Map<string, TrustedEvent[]>()

  const unsubscribers = [
    app.pool.subscribe(socket => {
      const onReceive = (message: RelayMessage) => {
        if (isRelayEvent(message)) {
          const event = message[2]

          if (settings.get().trusted_relays.includes(socket.url) || verifyEvent(event)) {
            app.ingestEvent(event, socket.url)
          } else if (!event.sig) {
            app.use(Logger).log("ingestPolicy", {url: socket.url, event})

            if (!held.has(socket.url)) {
              relaysPendingTrust.update($urls => uniq([...$urls, socket.url]))
            }

            pushToMapKey(held, socket.url, event)
          }
        }
      }

      socket.on(SocketEvent.Receive, onReceive)

      return () => socket.off(SocketEvent.Receive, onReceive)
    }),
    settings.$.subscribe($settings => {
      for (const url of $settings.trusted_relays) {
        for (const event of held.get(url) ?? []) {
          app.ingestEvent(event, url)
        }

        held.delete(url)
      }

      relaysPendingTrust.update($urls => $urls.filter(url => held.has(url)))
    }),
  ]

  return () => {
    unsubscribers.forEach(call)
    relaysPendingTrust.set([])
  }
}

export const registerIngest = () => {
  appPolicies.push(ingestPolicy)
}
