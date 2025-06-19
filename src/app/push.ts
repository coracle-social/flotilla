import {Capacitor} from "@capacitor/core"
import {VAPID_PUBLIC_KEY} from "@app/state"

export const platform = Capacitor.getPlatform()

export const canSendPushNotifications = () => ["web", "android", "ios"].includes(platform)

export const getWebPushInfo = async () => {
  if (!("serviceWorker" in navigator)) {
    throw new Error("Service Worker not supported")
  }

  if (!("PushManager" in window)) {
    throw new Error("Push messaging not supported")
  }

  if (Notification.permission === "denied") {
    throw new Error("Push notifications are blocked")
  }

  if (Notification.permission !== "granted") {
    const permission = await Notification.requestPermission()

    if (permission !== "granted") {
      throw new Error("Push notification permission denied")
    }
  }

  const registration = await navigator.serviceWorker.ready
  let subscription = await registration.pushManager.getSubscription()

  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: VAPID_PUBLIC_KEY,
    })
  }

  const {endpoint, keys} = subscription.toJSON()

  if (!keys) {
    throw new Error(`Failed to get push info: no keys were returned`)
  }

  return {
    endpoint: subscription.endpoint,
    p256dh: keys.p256dh,
    auth: keys.auth,
  }
}

export const getIosPushInfo = async () => {
  return {}
}

export const getAndroidPushInfo = async () => {
  return {}
}

export const getPushInfo = (): Promise<Record<string, string>> => {
  switch (platform) {
    case "web":
      return getWebPushInfo()
    case "ios":
      return getIosPushInfo()
    case "android":
      return getAndroidPushInfo()
    default:
      throw new Error(`Invalid push platform: ${platform}`)
  }
}
