import * as nip19 from "nostr-tools/nip19"
import {Capacitor} from "@capacitor/core"
import type {ActionPerformed, RegistrationError, Token} from "@capacitor/push-notifications"
import {PushNotifications} from "@capacitor/push-notifications"
import {parseJson, sleep, poll} from "@welshman/lib"
import {isSignedEvent} from "@welshman/util"
import {goto} from "$app/navigation"
import {ucFirst} from "@lib/util"
import {VAPID_PUBLIC_KEY} from "@app/core/state"

export const platform = Capacitor.getPlatform()

export const platformName = platform === "ios" ? "iOS" : ucFirst(platform)

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
    throw new Error("Push notifications are not supported")
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

  // This will hang on firefox in development builds, but works in production
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

export type PushInfo = {
  device_token: string
  bundle_identifier?: string
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
  await poll({
    condition: () => Boolean(device_token),
    signal: AbortSignal.timeout(5000),
  })

  if (!device_token) {
    throw new Error(error)
  }

  const info: PushInfo = {device_token}

  if (platform === "ios") {
    info.bundle_identifier = "social.flotilla"
  }

  return info
}

export const getPushInfo = (): Promise<Record<string, string>> =>
  new Promise((resolve, reject) => {
    sleep(3000).then(() => reject("Failed to request notification permissions"))

    switch (platform) {
      case "web":
        getWebPushInfo().then(resolve, reject)
        break
      case "ios":
      case "android":
        getCapacitorPushInfo().then(resolve, reject)
        break
      default:
        reject(`Invalid push platform: ${platform}`)
    }
  })
