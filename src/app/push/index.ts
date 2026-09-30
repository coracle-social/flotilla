import {Capacitor} from "@capacitor/core"
import {setSpaceNotifications} from "@app/settings"
import {clearBadges} from "@app/notifications"
import {syncEventReminders} from "@app/reminders"
import {notificationSettings, pushState} from "@app/push/adapters/common"
import {ElectronNotifications} from "@app/push/adapters/electron"
import {WebNotifications} from "@app/push/adapters/web"
import {CapacitorNotifications} from "@app/push/adapters/capacitor"
import {AndroidFallbackNotifications} from "@app/push/adapters/android"
import type {IPushAdapter} from "@app/push/adapters/common"

export {notificationSettings, onNotification} from "@app/push/adapters/common"

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

export const optInSpaceNotifications = async (url: string, notify: boolean) => {
  if (notify && notificationSettings.get().push) {
    const permission = await Push.request()

    if (permission.startsWith("granted")) {
      await setSpaceNotifications(url, true)
    }
  } else {
    await setSpaceNotifications(url, notify)
  }
}

export const saveNotificationSettings = async (
  values: ReturnType<typeof notificationSettings.get>,
) => {
  if (!values.badge) {
    clearBadges()
  }

  const permission = values.push ? await Push.request() : "granted"

  if (permission.startsWith("granted")) {
    notificationSettings.set(values)
    syncEventReminders().catch(console.error)
  }

  return permission
}
