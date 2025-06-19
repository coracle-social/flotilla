import * as nip19 from 'nostr-tools/nip19'
import {parse, renderAsText} from '@welshman/content'
import {MESSAGE, THREAD, COMMENT, EVENT_TIME} from '@welshman/util'

const renderOptions = {
  createElement: tag => ({
    _text: "",
    set innerText(text) {
      this._text = text
    },
    get innerHTML() {
      return this._text
    },
  })
}

self.addEventListener('install', event => {
  self.skipWaiting()
})

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener("push", e => {
  console.log("Service Worker: Push event received", e)

  let url = "/"
  let body = "You have a new message"

  try {
    const {event, relays = []} = e.data?.json() || {}

    if (event) {
      url += nip19.neventEncode({id: event.id, relays})
      body = renderAsText(parse(event), renderOptions).toString()
    }
  } catch (e) {
    console.log("Service Worker: Failed to parse push data", e)
  }

  e.waitUntil(
    self.registration.showNotification("New message", {
      body,
      data: {url},
      icon: "/pwa-192x192.png",
      badge: "/pwa-64x64.png",
      tag: 'flotilla-notification',
      requireInteraction: false,
    }),
  )
})

self.addEventListener("notificationclick", e => {
  console.log("Service Worker: Notification click event", e)

  e.notification.close()

  if (e.action === "close") {
    return
  }

  // Default action or 'open' action
  const url = e.notification.data?.url

  e.waitUntil(
    clients
      .matchAll({
        type: "window",
        includeUncontrolled: true,
      })
      .then(clientList => {
        // Check if app is already open and send navigation message
        for (const client of clientList) {
          if (client.url.includes(location.origin)) {
            client.postMessage({
              type: 'NAVIGATE',
              url: url
            })

            return client.focus()
          }
        }

        // Open new window if app is not open
        if (clients.openWindow) {
          return clients.openWindow(url)
        }
      }),
  )
})
