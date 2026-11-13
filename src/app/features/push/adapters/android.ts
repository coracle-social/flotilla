import {throttle} from "throttle-debounce"
import {App} from "@capacitor/app"
import {registerPlugin} from "@capacitor/core"
import {maybe, now} from "@welshman/lib"
import type {Session} from "@welshman/app"
import {app} from "@app/core/app"
import {session} from "@app/core/session"
import type {IPushAdapter, RelaySubscription} from "@app/features/push/adapters/common"
import {syncRelaySubscriptions} from "@app/features/push/adapters/common"
import {toPermission} from "@app/features/push/permission"
import {requiresFallback, useFallback} from "@app/features/push/registration"

// The worker needs the pubkey to build auth events. Keep in sync with AndroidPushFallbackWorker.kt.
type AndroidPushFallbackState = {
  pubkey?: string
  session?: Session
  activeSince?: number
  subscriptions?: Array<RelaySubscription>
}

type AndroidPushFallbackPlugin = {
  checkNotificationPermission: () => Promise<{receive: string}>
  requestNotificationPermission: () => Promise<{receive: string}>
  syncState: (args: {state: AndroidPushFallbackState}) => Promise<void>
}

const AndroidPushFallback = registerPlugin<AndroidPushFallbackPlugin>("AndroidPushFallback")

export class AndroidFallbackNotifications implements IPushAdapter {
  _controller = maybe<AbortController>()
  _subscriptions = new Map<string, RelaySubscription>()
  _activeSince = now()

  async check() {
    const {receive} = await AndroidPushFallback.checkNotificationPermission()

    return toPermission(receive)
  }

  async request() {
    const {receive} = await AndroidPushFallback.requestNotificationPermission()

    return toPermission(receive)
  }

  async enable() {
    if (!this._controller) {
      this._controller = new AbortController()

      const doSync = throttle(1000, () => {
        AndroidPushFallback.syncState({
          state: {
            pubkey: app.get().user?.pubkey,
            session: session.get(),
            activeSince: this._activeSince,
            subscriptions: Array.from(this._subscriptions.values()),
          },
        })
      })

      let appStateListener: Awaited<ReturnType<typeof App.addListener>> | undefined

      App.addListener("appStateChange", ({isActive}) => {
        if (!isActive) {
          this._activeSince = now()
          doSync()
        }
      }).then(handle => {
        appStateListener = handle
      })

      this._controller.signal.addEventListener("abort", () => {
        appStateListener?.remove()
      })

      syncRelaySubscriptions(this._controller.signal, (added, removed) => {
        for (const subscription of added) {
          this._subscriptions.set(`${subscription.relay}:${subscription.key}`, subscription)
        }

        for (const subscription of removed) {
          this._subscriptions.delete(`${subscription.relay}:${subscription.key}`)
        }

        doSync()
      })
    }
  }

  async disable() {
    this._controller?.abort()
    this._controller = undefined
    this._subscriptions.clear()

    await AndroidPushFallback.syncState({state: {}})

    useFallback.set(requiresFallback)
  }
}
