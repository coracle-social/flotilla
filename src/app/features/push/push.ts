import {Capacitor} from "@capacitor/core"
import {notificationSettings, pushState} from "@app/features/push/adapters/common"
import type {IPushAdapter} from "@app/features/push/adapters/common"
import {ElectronNotifications} from "@app/features/push/adapters/electron"
import {WebNotifications} from "@app/features/push/adapters/web"
import {CapacitorNotifications} from "@app/features/push/adapters/capacitor"
import {AndroidFallbackNotifications} from "@app/features/push/adapters/android"

// Picks the platform's adapter once, and moves Android to its fallback when push permission is refused.
export class Push {
  static _adapter: IPushAdapter | undefined

  static _getAdapter() {
    if (!Push._adapter) {
      const {useFallback} = pushState.get()

      if (Capacitor.getPlatform() === "electron") {
        Push._adapter = new ElectronNotifications()
      } else if (Capacitor.getPlatform() === "android" && useFallback) {
        Push._adapter = new AndroidFallbackNotifications()
      } else if (Capacitor.isPluginAvailable("PushNotifications")) {
        Push._adapter = new CapacitorNotifications()
      } else {
        Push._adapter = new WebNotifications()
      }
    }

    return Push._adapter
  }

  static async request() {
    const adapter = Push._getAdapter()

    let permission = await adapter.request()
    if (permission !== "granted" && adapter instanceof CapacitorNotifications) {
      Push._adapter = new AndroidFallbackNotifications()
      permission = await Push._adapter.request()

      if (permission === "granted") {
        pushState.set({useFallback: true})
      }
    }

    return permission
  }

  static disable() {
    return Push._getAdapter().disable()
  }

  static enable() {
    return Push._getAdapter().enable()
  }

  static sync() {
    return notificationSettings.subscribe(({push}) => {
      if (push) {
        Push.enable()
      } else {
        Push.disable()
      }
    })
  }
}
