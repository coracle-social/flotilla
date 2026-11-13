import {Capacitor} from "@capacitor/core"
import {synced, withGetter} from "@welshman/store"
import {kv} from "@app/core/storage"

export type PushSubscription = {
  key: string
  callback: string
}

// What the push server needs to reach this device, as opposed to how it reaches it.
export type PushRegistration = {
  token?: string
  subscription?: PushSubscription
}

// The F-Droid build ships without the push plugin, so those installs can only ever poll
export const requiresFallback =
  Capacitor.getPlatform() === "android" && !Capacitor.isPluginAvailable("PushNotifications")

// Remembered so a device whose FCM permission is refused doesn't ask again on every launch.
export const useFallback = withGetter(
  synced({key: "pushFallback", storage: kv, defaultValue: requiresFallback}),
)

export const pushRegistration = withGetter(
  synced<PushRegistration>({key: "pushRegistration", storage: kv, defaultValue: {}}),
)

type LegacyPushState = PushRegistration & {useFallback?: boolean}

// The registration and the fallback flag shared one record before they were separated.
export const migratePushState = async () => {
  const legacy = await kv.get<LegacyPushState>("notificationState")

  if (legacy) {
    if (legacy.useFallback) {
      useFallback.set(true)
    }

    if (legacy.token || legacy.subscription) {
      pushRegistration.set({token: legacy.token, subscription: legacy.subscription})
    }

    await kv.remove("notificationState")
  }
}
