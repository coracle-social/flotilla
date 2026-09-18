import {Capacitor} from "@capacitor/core"
import {PushNotifications} from "@capacitor/push-notifications"
import {assoc, hash, maybe, ms, poll} from "@welshman/lib"
import type {Filter} from "@welshman/util"
import {Address, DELETE, makeEvent} from "@welshman/util"
import {Relays, User} from "@welshman/app"
import {buildUrl} from "@lib/util"
import {app, messagingRelayLists, roomLists, thunks} from "@app/core"
import {device} from "@app/device"
import {PUSH_BRIDGE, PUSH_SERVER} from "@app/env"
import {pushState} from "@app/push/adapters/common"
import type {IPushAdapter} from "@app/push/adapters/common"
import {onPushNotificationAction, syncRelaySubscriptions} from "@app/push/adapters/common"

const requestPermissions = async () => {
  let status = await PushNotifications.checkPermissions()

  if (["prompt", "prompt-with-rationale"].includes(status.receive)) {
    status = await PushNotifications.requestPermissions()
  }

  return status.receive
}

const requestToken = async () => {
  let {token} = pushState.get()
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

  pushState.update(assoc("token", token))

  return token ? "granted" : error
}

export class CapacitorNotifications implements IPushAdapter {
  _controller = maybe<AbortController>()

  async request() {
    const status = await requestPermissions()
    return status === "granted" ? requestToken() : status
  }

  async _syncServer(signal: AbortSignal) {
    const {token, subscription} = pushState.get()

    if (!token) {
      throw new Error("Attempted to sync push server without a token")
    }

    if (!subscription) {
      try {
        const channel = Capacitor.getPlatform() === "ios" ? "apns" : "fcm"
        const url = buildUrl(PUSH_SERVER, "subscription", channel)
        const res = await fetch(url, {
          signal,
          method: "POST",
          body: JSON.stringify({token}),
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
        })

        if (!res.ok) {
          console.warn(`Failed to register with push server (status ${res.status})`)
        } else {
          const json = await res.json()

          if (json?.callback && json?.key) {
            pushState.update(assoc("subscription", json))
          } else {
            console.warn("Failed to register with push server (bad response)")
          }
        }
      } catch (e) {
        console.warn("Failed to register with push server:", e)
      }
    }
  }

  _getSubscriptionIdentifier = (relay: string, key: string) =>
    String(hash(relay + key + device.get()))

  _getPushUrl = async (url: string) => {
    for (const candidate of [url, PUSH_BRIDGE]) {
      const relay = await app.get().use(Relays).load(candidate)

      if (relay?.hasNip("9a")) {
        return candidate
      }
    }
  }

  _syncRelay = async (relay: string, key: string, filters: Filter[], ignore: Filter[] = []) => {
    const {subscription} = pushState.get()

    if (!subscription) {
      console.warn(`Failed to subscribe ${relay} to notifications: no subscription`)
      return
    }

    const url = await this._getPushUrl(relay)

    if (!url) {
      console.warn(`Failed to subscribe ${relay} to notifications: unsupported`)
      return
    }

    const identifier = this._getSubscriptionIdentifier(relay, key)

    const thunk = thunks.get().publish({
      relays: [url],
      event: makeEvent(30390, {
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

    const error = await thunk.waitForError()

    if (error) {
      console.warn(`Failed to subscribe ${relay} to ${key} notifications:`, error)
    }
  }

  _unsyncRelay = async (relay: string, key: string) => {
    const url = await this._getPushUrl(relay)

    if (!url) {
      console.warn(`Failed to unsubscribe ${relay} from notifications: unsupported`)
      return
    }

    const relays = [url]
    const identifier = this._getSubscriptionIdentifier(relay, key)
    const address = new Address(30390, User.require(app.get()).pubkey, identifier).toString()
    const event = makeEvent(DELETE, {tags: [["a", address]]})
    const error = await thunks.get().publish({relays, event}).waitForError()

    if (error) {
      console.warn(`Failed to unsubscribe ${relay} from notifications:`, error)
    }
  }

  async enable() {
    if (!this._controller) {
      this._controller = new AbortController()

      PushNotifications.addListener("pushNotificationActionPerformed", onPushNotificationAction)

      this._controller.signal.addEventListener("abort", () => {
        PushNotifications.removeAllListeners()
      })

      try {
        await this._syncServer(this._controller.signal)

        syncRelaySubscriptions(this._controller.signal, (url, key, filters, ignore) => {
          if (filters.length > 0) {
            this._syncRelay(url, key, filters, ignore)
          } else {
            this._unsyncRelay(url, key)
          }
        })
      } catch (e) {
        console.error(e)
      }
    }
  }

  async disable() {
    this._controller?.abort()
    this._controller = undefined

    const {subscription} = pushState.get()

    if (subscription) {
      const res = await fetch(buildUrl(PUSH_SERVER, "subscription", subscription.key), {
        method: "delete",
      })

      if (!res.ok) {
        console.warn("Failed to delete push subscription")
      }
    }

    pushState.set({})

    const $pubkey = app.get().user?.pubkey

    if ($pubkey) {
      await Promise.all(
        roomLists
          .get()
          .urls($pubkey)
          .get()
          .map(url => this._unsyncRelay(url, "spaces")),
      )

      await Promise.all(
        messagingRelayLists
          .get()
          .urls($pubkey)
          .get()
          .map(url => this._unsyncRelay(url, "messages")),
      )
    }
  }
}
