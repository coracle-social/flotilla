import {Capacitor} from "@capacitor/core"
import {isGranted} from "@lib/push/permission"
import type {PushPermission} from "@lib/push/permission"
import {alertSettings, updateAlertSettings} from "@app/tools/alerts/settings"
import type {PushAdapter} from "@app/tools/push/adapter"
import {createAndroidFallbackNotifications} from "@app/tools/push/adapters/android"
import {createCapacitorNotifications} from "@app/tools/push/adapters/capacitor"
import {createElectronNotifications} from "@app/tools/push/adapters/electron"
import {createWebNotifications} from "@app/tools/push/adapters/web"
import {useFallback} from "@app/tools/push/registration"

type PushTransport = "web" | "electron" | "capacitor" | "poll"

const getTransport = (): PushTransport => {
  if (Capacitor.getPlatform() === "electron") {
    return "electron"
  }

  if (Capacitor.getPlatform() === "android" && useFallback.get()) {
    return "poll"
  }

  if (Capacitor.isPluginAvailable("PushNotifications")) {
    return "capacitor"
  }

  return "web"
}

const makeAdapter = (transport: PushTransport): PushAdapter => {
  switch (transport) {
    case "electron":
      return createElectronNotifications()
    case "poll":
      return createAndroidFallbackNotifications()
    case "capacitor":
      return createCapacitorNotifications()
    default:
      return createWebNotifications()
  }
}

const adapters = new Map<PushTransport, PushAdapter>()

// Kept per transport, since an adapter holds the listeners and controllers its enable installed.
const getAdapter = () => {
  const transport = getTransport()
  let adapter = adapters.get(transport)

  if (!adapter) {
    adapter = makeAdapter(transport)
    adapters.set(transport, adapter)
  }

  return adapter
}

export const checkPushPermission = () => getAdapter().check()

export const requestPushPermission = async (): Promise<PushPermission> => {
  const permission = await getAdapter().request()

  // Only an Android device with the plugin can be reached by the polling worker after FCM refuses.
  const canPoll = Capacitor.getPlatform() === "android" && getTransport() === "capacitor"

  if (isGranted(permission) || !canPoll) {
    return permission
  }

  useFallback.set(true)

  return getAdapter().request()
}

let enabled: PushAdapter | undefined

export const enablePush = async () => {
  const adapter = getAdapter()

  if (enabled && enabled !== adapter) {
    await enabled.disable()
    enabled = undefined
  }

  // Permission can be revoked outside the app, so report it and let the caller turn the setting off.
  const permission = await adapter.check()

  if (isGranted(permission)) {
    await adapter.enable()
    enabled = adapter
  }

  return permission
}

export const disablePush = async () => {
  const adapter = enabled ?? getAdapter()
  enabled = undefined

  await adapter.disable()
}

export const syncPush = () =>
  alertSettings.subscribe(async ({push}) => {
    if (push) {
      const permission = await enablePush()

      if (!isGranted(permission)) {
        // Recording the refusal re-enters this subscriber, which disables the adapter.
        updateAlertSettings({push: false})
      }
    } else {
      await disablePush()
    }
  })
