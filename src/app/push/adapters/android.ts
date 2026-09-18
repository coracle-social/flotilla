import {throttle} from "throttle-debounce"
import {App} from "@capacitor/app"
import {registerPlugin} from "@capacitor/core"
import {maybe, now} from "@welshman/lib"
import type {Filter} from "@welshman/util"
import type {Session} from "@welshman/app"
import {app, session} from "@app/core"
import {pushState} from "@app/push/adapters/common"
import type {IPushAdapter} from "@app/push/adapters/common"
import {syncRelaySubscriptions} from "@app/push/adapters/common"

type AndroidFallbackSubscription = {
  relay: string
  key: string
  filters: Array<Filter>
  ignore: Array<Filter>
}

// A Session no longer carries the pubkey it belongs to, but the worker needs it to build auth
// events, so it's passed alongside. Keep this in sync with AndroidPushFallbackWorker.kt.
type AndroidPushFallbackState = {
  pubkey?: string
  session?: Session
  activeSince?: number
  subscriptions?: Array<AndroidFallbackSubscription>
}

type AndroidPushFallbackPlugin = {
  requestNotificationPermission: () => Promise<{receive: string}>
  syncState: (args: {state: AndroidPushFallbackState}) => Promise<void>
}

const AndroidPushFallback = registerPlugin<AndroidPushFallbackPlugin>("AndroidPushFallback")

export class AndroidFallbackNotifications implements IPushAdapter {
  _controller = maybe<AbortController>()
  _subscriptions = new Map<string, AndroidFallbackSubscription>()
  _activeSince = now()

  async request() {
    return (await AndroidPushFallback.requestNotificationPermission()).receive
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

      syncRelaySubscriptions(this._controller.signal, async (relay, key, filters, ignore) => {
        if (filters.length > 0) {
          this._subscriptions.set(`${relay}:${key}`, {relay, key, filters, ignore})
        } else {
          this._subscriptions.delete(`${relay}:${key}`)
        }

        doSync()
      })

      pushState.set({useFallback: true})
    }
  }

  async disable() {
    this._controller?.abort()
    this._controller = undefined
    this._subscriptions.clear()

    await AndroidPushFallback.syncState({state: {}})

    pushState.set({})
  }
}
