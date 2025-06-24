import * as nip19 from "nostr-tools/nip19"
import {Capacitor} from "@capacitor/core"
import type {ActionPerformed, RegistrationError, Token} from "@capacitor/push-notifications"
import {PushNotifications} from "@capacitor/push-notifications"
import {sleep, parseJson} from "@welshman/lib"
import {isSignedEvent} from "@welshman/util"
import {goto} from "$app/navigation"
import {VAPID_PUBLIC_KEY} from "@app/state"

export const platform = Capacitor.getPlatform()

export const initializePushNotifications = () => {
  if (platform === "web") return

  PushNotifications.addListener("pushNotificationActionPerformed", (action: ActionPerformed) => {
    const event = parseJson(action.notification.data.event)
    const parsedRelays = parseJson(action.notification.data.relays)
    const relays = Array.isArray(parsedRelays) ? parsedRelays : []

    if (isSignedEvent(event)) {
      goto("/" + nip19.neventEncode({id: event.id, relays}))
    }
  })
}

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

  const {keys} = subscription.toJSON()

  if (!keys) {
    throw new Error(`Failed to get push info: no keys were returned`)
  }

  return {
    endpoint: subscription.endpoint,
    p256dh: keys.p256dh,
    auth: keys.auth,
  }
}

export const getCapacitorPushInfo = async () => {
  let status = await PushNotifications.checkPermissions()

  if (status.receive === "prompt") {
    status = await PushNotifications.requestPermissions()
  }

  if (status.receive !== "granted") {
    throw new Error("Failed to register for push notifications")
  }

  let device_token = ""
  let error = "Failed to register for push notifications"

  PushNotifications.addListener("registration", (token: Token) => {
    device_token = token.value
  })

  PushNotifications.addListener("registrationError", (_error: RegistrationError) => {
    error = _error.error
  })

  await PushNotifications.register()
  await sleep(100)

  if (!device_token) {
    throw new Error(error)
  }

  return {device_token}
}

export const getPushInfo = (): Promise<Record<string, string>> => {
  switch (platform) {
    case "web":
      return getWebPushInfo()
    case "ios":
    case "android":
      return getCapacitorPushInfo()
    default:
      throw new Error(`Invalid push platform: ${platform}`)
  }
}
