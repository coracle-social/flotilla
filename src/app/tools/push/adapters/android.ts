import {throttle} from "throttle-debounce"
import {App} from "@capacitor/app"
import {registerPlugin} from "@capacitor/core"
import {now} from "@welshman/lib"
import type {Session} from "@welshman/app"
import {toPermission} from "@lib/push/permission"
import {app} from "@app/core/app"
import {session} from "@app/core/session"
import type {PushAdapter} from "@app/tools/push/adapter"
import {requiresFallback, useFallback} from "@app/tools/push/registration"
import type {RelaySubscription} from "@app/tools/push/relaySubscriptions"
import {syncRelaySubscriptions} from "@app/tools/push/relaySubscriptions"

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

export const createAndroidFallbackNotifications = (): PushAdapter => {
  let controller: AbortController | undefined
  let subscriptions: RelaySubscription[] = []
  let activeSince = now()

  const check = async () => {
    const {receive} = await AndroidPushFallback.checkNotificationPermission()

    return toPermission(receive)
  }

  const request = async () => {
    const {receive} = await AndroidPushFallback.requestNotificationPermission()

    return toPermission(receive)
  }

  const enable = async () => {
    if (!controller) {
      controller = new AbortController()

      const {signal} = controller

      const doSync = throttle(1000, () => {
        AndroidPushFallback.syncState({
          state: {
            pubkey: app.get().user?.pubkey,
            session: session.get(),
            activeSince,
            subscriptions,
          },
        })
      })

      let appStateListener: Awaited<ReturnType<typeof App.addListener>> | undefined

      App.addListener("appStateChange", ({isActive}) => {
        if (!isActive) {
          activeSince = now()
          doSync()
        }
      }).then(handle => {
        appStateListener = handle
      })

      signal.addEventListener("abort", () => {
        appStateListener?.remove()
      })

      syncRelaySubscriptions(signal, changes => {
        subscriptions = changes.subscriptions
        doSync()
      })
    }
  }

  const disable = async () => {
    controller?.abort()
    controller = undefined
    subscriptions = []

    await AndroidPushFallback.syncState({state: {}})

    useFallback.set(requiresFallback)
  }

  return {check, request, enable, disable}
}
