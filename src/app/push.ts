import {Capacitor} from "@capacitor/core"
import {VAPID_PUBLIC_KEY} from "@app/state"

const platform = Capacitor.getPlatform()

export const canSendPushNotifications = () => ["web", "android", "ios"].includes(platform)

export const getWebPushToken = async () => {
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

  try {
    const registration = await navigator.serviceWorker.ready
    let subscription = await registration.pushManager.getSubscription()

    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: VAPID_PUBLIC_KEY,
      })
    }

    // Return the endpoint URL which serves as the token
    return subscription.endpoint
  } catch (error: any) {
    throw new Error(`Failed to get push token: ${String(error)}`)
  }
}

export const getIosPushToken = async () => {
  return ""
}

export const getAndroidPushToken = async () => {
  return ""
}

export const getPushToken = (): Promise<string> => {
  switch (platform) {
    case "web":
      return getWebPushToken()
    case "ios":
      return getIosPushToken()
    case "android":
      return getAndroidPushToken()
    default:
      throw new Error(`Invalid push platform: ${platform}`)
  }
}

export const getPushInfo = async () => ({platform, token: await getPushToken()})
