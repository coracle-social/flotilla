/* global clients */

import * as nip19 from "nostr-tools/nip19"

self.addEventListener("install", event => {
  self.skipWaiting()
})

self.addEventListener("activate", event => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener("push", e => {
  console.log("Service Worker: Push event received", e)

  let url = "/"
  let title = "New activity"
  let body = "You have a new message"

  try {
    const data = e.data?.json()

    if (data?.event) {
      url += nip19.neventEncode({
        id: data.event.id,
        relays: data.relays || [],
      })
    }

    if (data?.title) {
      title = data.title
    }

    if (data?.body) {
      body = data.body
    }
  } catch (e) {
    console.log("Service Worker: Failed to parse push data", e)
  }

  e.waitUntil(
    self.registration.showNotification(title, {
      body,
      data: {url},
      icon: "/pwa-192x192.png",
      badge: "/pwa-64x64.png",
      tag: "flotilla-notification",
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
              type: "NAVIGATE",
              url: url,
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
