import {Capacitor} from "@capacitor/core"
import {PushNotifications} from "@capacitor/push-notifications"
import {assoc, hash, ms, poll} from "@welshman/lib"
import type {Filter} from "@welshman/util"
import {Address, DELETE, makeEvent} from "@welshman/util"
import {Relays} from "@welshman/app"
import {isGranted, toPermission} from "@lib/push/permission"
import type {PushPermission} from "@lib/push/permission"
import {app} from "@app/core/app"
import {messagingRelayLists, publisher, roomLists} from "@app/core/plugins"
import {device} from "@app/core/device"
import {PUSH_BRIDGE} from "@app/core/env"
import {requireUser} from "@app/core/user"
import type {PushAdapter} from "@app/tools/push/adapter"
import {pushRegistration} from "@app/tools/push/registration"
import {syncRelaySubscriptions} from "@app/tools/push/relaySubscriptions"
import {createPushSubscription, deletePushSubscription} from "@app/tools/push/server"
import {onPushNotificationAction} from "@app/tools/push/taps"

// NIP-9a: asks a relay to post matching events to the push server's callback
const PUSH_SUBSCRIPTION = 30390

const requestToken = async () => {
  let {token} = pushRegistration.get()
  let error = "failed to retrieve token"

  if (!token) {
    const listeners = [
      PushNotifications.addListener("registration", ({value}) => {
        token = value
      }),
      PushNotifications.addListener("registrationError", err => {
        error = err.error
      }),
    ]

    await Promise.all([
      PushNotifications.register(),
      poll({
        condition: () => Boolean(token),
        signal: AbortSignal.timeout(ms(5)),
      }),
    ])

    listeners.forEach(p => p.then(listener => listener.remove()))
  }

  if (!token) {
    console.error(`Failed to register for push notifications: ${error}`)

    return
  }

  pushRegistration.update(assoc("token", token))

  return token
}

const syncServer = async (signal: AbortSignal) => {
  const {token, subscription} = pushRegistration.get()

  if (!token) {
    console.warn("Skipping push server sync: no token")

    return false
  }

  if (subscription) {
    return true
  }

  try {
    const channel = Capacitor.getPlatform() === "ios" ? "apns" : "fcm"
    const res = await createPushSubscription(channel, token, signal)

    if (res.ok) {
      const json = await res.json()

      if (json?.callback && json?.key) {
        pushRegistration.update(assoc("subscription", json))
      } else {
        console.warn("Failed to register with push server (bad response)")
      }
    } else {
      console.warn(`Failed to register with push server (status ${res.status})`)
    }
  } catch (e) {
    console.warn("Failed to register with push server:", e)
  }

  return true
}

const getSubscriptionIdentifier = (relay: string, key: string) =>
  String(hash(relay + key + device.get()))

const getPushUrl = async (url: string) => {
  for (const candidate of [url, PUSH_BRIDGE]) {
    const relay = await app.get().use(Relays).load(candidate)

    if (relay?.hasNip("9a")) {
      return candidate
    }
  }
}

const syncRelay = async (relay: string, key: string, filters: Filter[], ignore: Filter[]) => {
  const {subscription} = pushRegistration.get()

  if (!subscription) {
    console.warn(`Failed to subscribe ${relay} to notifications: no subscription`)
    return
  }

  const url = await getPushUrl(relay)

  if (!url) {
    console.warn(`Failed to subscribe ${relay} to notifications: unsupported`)
    return
  }

  const identifier = getSubscriptionIdentifier(relay, key)

  const publication = publisher.get().publish({
    relays: [url],
    event: makeEvent(PUSH_SUBSCRIPTION, {
      tags: [
        ["d", identifier],
        ["relay", relay],
        ["callback", subscription.callback],
        ["include_event"],
        ...ignore.map(filter => ["ignore", JSON.stringify(filter)]),
        ...filters.map(filter => ["filter", JSON.stringify(filter)]),
      ],
    }),
  })

  const error = await publication.getFatalError()

  if (error) {
    console.warn(`Failed to subscribe ${relay} to ${key} notifications:`, error)
  }
}

const unsyncRelay = async (relay: string, key: string) => {
  const url = await getPushUrl(relay)

  if (!url) {
    console.warn(`Failed to unsubscribe ${relay} from notifications: unsupported`)
    return
  }

  const relays = [url]
  const identifier = getSubscriptionIdentifier(relay, key)
  const address = new Address(PUSH_SUBSCRIPTION, requireUser().pubkey, identifier).toString()
  const event = makeEvent(DELETE, {tags: [["a", address]]})
  const publication = publisher.get().publish({relays, event})
  const error = await publication.getFatalError()

  if (error) {
    console.warn(`Failed to unsubscribe ${relay} from notifications:`, error)
  }
}

export const createCapacitorNotifications = (): PushAdapter => {
  let controller: AbortController | undefined

  const check = async (): Promise<PushPermission> => {
    const status = await PushNotifications.checkPermissions()

    return toPermission(status.receive)
  }

  const request = async (): Promise<PushPermission> => {
    let status = await PushNotifications.checkPermissions()

    if (["prompt", "prompt-with-rationale"].includes(status.receive)) {
      status = await PushNotifications.requestPermissions()
    }

    const permission = toPermission(status.receive)

    if (isGranted(permission) && !(await requestToken())) {
      return "unavailable"
    }

    return permission
  }

  const enable = async () => {
    if (!controller) {
      controller = new AbortController()

      const {signal} = controller

      PushNotifications.addListener("pushNotificationActionPerformed", ({notification}) =>
        onPushNotificationAction(notification.data),
      )

      signal.addEventListener("abort", () => {
        PushNotifications.removeAllListeners()
      })

      try {
        const synced = await syncServer(signal)

        // A disable during the server sync leaves nothing to install.
        if (synced && !signal.aborted) {
          syncRelaySubscriptions(signal, ({added, removed}) => {
            for (const {relay, key, filters, ignore} of added) {
              syncRelay(relay, key, filters, ignore)
            }

            for (const {relay, key} of removed) {
              unsyncRelay(relay, key)
            }
          })
        }
      } catch (e) {
        console.error(e)
      }
    }
  }

  const disable = async () => {
    controller?.abort()
    controller = undefined

    const {subscription} = pushRegistration.get()

    if (subscription) {
      const res = await deletePushSubscription(subscription.key)

      if (!res.ok) {
        console.warn("Failed to delete push subscription")
      }
    }

    pushRegistration.set({})

    const $pubkey = app.get().user?.pubkey

    if ($pubkey) {
      const unsyncAll = (urls: string[], key: string) =>
        Promise.all(urls.map(url => unsyncRelay(url, key)))

      await unsyncAll(roomLists.get().urls($pubkey).get(), "spaces")
      await unsyncAll(messagingRelayLists.get().urls($pubkey).get(), "messages")
    }
  }

  return {check, request, enable, disable}
}
