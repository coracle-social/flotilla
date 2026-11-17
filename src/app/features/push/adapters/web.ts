import type {Unsubscriber} from "svelte/store"
import {ellipsize} from "@welshman/lib"
import type {TrustedEvent} from "@welshman/util"
import {isGranted, toPermission} from "@lib/push/permission"
import type {PushPermission} from "@lib/push/permission"
import {alertSettings} from "@app/tools/alerts/settings"
import {onAlert} from "@app/tools/alerts/stream"
import type {PushAdapter} from "@app/features/push/adapter"
import {renderEventAsSummary} from "@app/tools/render"
import {goToEvent} from "@app/navigation/locations"

export type Notify = (event: TrustedEvent, title: string, body: string) => void

const getPermission = (): PushPermission =>
  typeof Notification === "undefined" ? "unavailable" : toPermission(Notification.permission)

const notifyInBrowser: Notify = (event, title, body) => {
  const notification = new Notification(title, {
    body,
    tag: event.id,
    icon: "/icon.png",
    badge: "/icon.png",
  })

  notification.onclick = () => {
    window.focus()
    goToEvent(event)
    notification.close()
  }

  const onVisibilityChange = () => {
    if (document.visibilityState === "visible") {
      notification.close()
      document.removeEventListener("visibilitychange", onVisibilityChange)
    }
  }

  document.addEventListener("visibilitychange", onVisibilityChange)
}

export const createWebNotifications = (notify: Notify = notifyInBrowser): PushAdapter => {
  let unsubscriber: Unsubscriber | undefined

  const check = async () => getPermission()

  const request = async () => {
    if (getPermission() === "prompt") {
      await Notification.requestPermission()
    }

    return getPermission()
  }

  const enable = async () => {
    if (!unsubscriber) {
      unsubscriber = onAlert(({event, types}) => {
        if (alertSettings.get().push && document.hidden && isGranted(getPermission())) {
          const preview = ellipsize(renderEventAsSummary(event), 120, "…")

          if (types.includes("messages")) {
            notify(event, "New direct message", preview || "Someone sent you a direct message.")
          } else if (types.includes("mentions")) {
            notify(event, "Someone mentioned you", preview || "Someone tagged you in a message.")
          } else {
            notify(event, "New message", preview || "Someone posted a new message.")
          }
        }
      })
    }
  }

  const disable = async () => {
    unsubscriber?.()
    unsubscriber = undefined
  }

  return {check, request, enable, disable}
}
