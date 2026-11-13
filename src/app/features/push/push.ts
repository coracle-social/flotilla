import {Capacitor} from "@capacitor/core"
import {alertSettings, setAlertChannels} from "@app/features/alerts"
import type {IPushAdapter} from "@app/features/push/adapters/common"
import {AndroidFallbackNotifications} from "@app/features/push/adapters/android"
import {CapacitorNotifications} from "@app/features/push/adapters/capacitor"
import {ElectronNotifications} from "@app/features/push/adapters/electron"
import {WebNotifications} from "@app/features/push/adapters/web"
import {isGranted} from "@app/features/push/permission"
import type {PushPermission} from "@app/features/push/permission"
import {useFallback} from "@app/features/push/registration"

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

const makeAdapter = (transport: PushTransport): IPushAdapter => {
  switch (transport) {
    case "electron":
      return new ElectronNotifications()
    case "poll":
      return new AndroidFallbackNotifications()
    case "capacitor":
      return new CapacitorNotifications()
    default:
      return new WebNotifications()
  }
}

const adapters = new Map<PushTransport, IPushAdapter>()

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

let enabled: IPushAdapter | undefined

export const enablePush = async () => {
  const adapter = getAdapter()

  if (enabled && enabled !== adapter) {
    await enabled.disable()
    enabled = undefined
  }

  // Permission can be revoked outside the app, so this turns the setting off instead of going quiet.
  if (isGranted(await adapter.check())) {
    await adapter.enable()
    enabled = adapter
  } else {
    setAlertChannels({push: false})
  }
}

export const disablePush = async () => {
  const adapter = enabled ?? getAdapter()
  enabled = undefined

  await adapter.disable()
}

export const syncPush = () =>
  alertSettings.subscribe(({push}) => {
    if (push) {
      enablePush()
    } else {
      disablePush()
    }
  })
