import type {Unsubscriber} from "svelte/store"
import {ellipsize, maybe} from "@welshman/lib"
import type {TrustedEvent} from "@welshman/util"
import {alertSettings, onAlert} from "@app/features/alerts"
import type {PushAdapter} from "@app/features/push/adapter"
import {isGranted, toPermission} from "@app/features/push/permission"
import type {PushPermission} from "@app/features/push/permission"
import {renderEventAsSummary} from "@app/features/render"
import {goToEvent} from "@app/navigation/locations"

const PREVIEW_LENGTH = 120

const getPermission = (): PushPermission =>
  typeof Notification === "undefined" ? "unavailable" : toPermission(Notification.permission)

export class WebNotifications implements PushAdapter {
  _unsubscriber = maybe<Unsubscriber>()

  async check() {
    return getPermission()
  }

  async request() {
    if (getPermission() === "prompt") {
      await Notification.requestPermission()
    }

    return getPermission()
  }

  _notify(event: TrustedEvent, title: string, body: string) {
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

  async enable() {
    if (!this._unsubscriber) {
      this._unsubscriber = onAlert(({event, types}) => {
        if (alertSettings.get().push && document.hidden && isGranted(getPermission())) {
          const preview = ellipsize(renderEventAsSummary(event), PREVIEW_LENGTH, "…")

          if (types.includes("messages")) {
            this._notify(
              event,
              "New direct message",
              preview || "Someone sent you a direct message.",
            )
          } else if (types.includes("mentions")) {
            this._notify(
              event,
              "Someone mentioned you",
              preview || "Someone tagged you in a message.",
            )
          } else {
            this._notify(event, "New message", preview || "Someone posted a new message.")
          }
        }
      })
    }
  }

  async disable() {
    this._unsubscriber?.()
    this._unsubscriber = undefined
  }
}
