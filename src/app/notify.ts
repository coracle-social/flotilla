import {writable, derived} from "svelte/store"
import {append, now, uniq} from "@welshman/lib"
import type {Maybe} from "@welshman/lib"
import {SocketEvent} from "@welshman/net"
import type {RelayMessage} from "@welshman/net"
import {synced} from "@welshman/store"
import type {AppPolicy} from "@welshman/app"
import {kv} from "@app/storage"

export type RelayNotification = {
  url: string
  message: string
  receivedAt: number
}

/**
 * A relay tells the authenticated user something about their account by sending
 * `["NOTIFY", "<message>"]`, and replaces it by sending another, so only the
 * latest per relay is kept. Replace this with @welshman/app's RelayNotifies
 * once the release carrying it lands.
 */
const notificationsByUrl = writable(new Map<string, RelayNotification>())

export const notifyPolicy: AppPolicy = app =>
  app.pool.subscribe(socket => {
    const onReceive = (message: RelayMessage, url: string) => {
      if (message[0] !== "NOTIFY" || typeof message[1] !== "string") {
        return
      }

      notificationsByUrl.update($notifications => {
        $notifications.set(url, {url, message: message[1], receivedAt: now()})

        return $notifications
      })
    }

    socket.on(SocketEvent.Receive, onReceive)

    return () => socket.off(SocketEvent.Receive, onReceive)
  })

// A relay resends after every AUTH, so a dismissal is keyed on the message text.
const dismissedRelayNotifications = synced<string[]>({
  key: "dismissedRelayNotifications",
  storage: kv,
  defaultValue: [],
})

const notificationKey = (notification: RelayNotification) =>
  `${notification.url} ${notification.message}`

export const relayNotification = (url: string) =>
  derived([notificationsByUrl, dismissedRelayNotifications], ([$notifications, $dismissed]) => {
    const notification = $notifications.get(url)
    const shown = notification && !$dismissed.includes(notificationKey(notification))

    return shown ? notification : undefined
  })

export const dismissRelayNotification = (notification: Maybe<RelayNotification>) =>
  notification &&
  dismissedRelayNotifications.update($dismissed =>
    uniq(append(notificationKey(notification), $dismissed)).slice(-100),
  )
