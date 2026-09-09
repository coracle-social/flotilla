import type {Unsubscriber} from "svelte/store"
import {parse, renderAsText} from "@welshman/content"
import {ellipsize, maybe} from "@welshman/lib"
import {hexTags, matchFilter, tagValues, type TrustedEvent} from "@welshman/util"
import {DM_KINDS} from "@app/content"
import {app} from "@app/core"
import {notificationSettings} from "@app/settings"
import type {IPushAdapter} from "@app/push/adapters/common"
import {onNotification} from "@app/push/adapters/common"
import {goToEvent} from "@app/routes"

const PREVIEW_LENGTH = 120

const makePreview = (event: TrustedEvent) => {
  const lines = renderAsText(parse(event)).toString().split("\n")
  const line = lines.map(line => line.trim()).find(line => line.length > 0)

  return line && ellipsize(line, PREVIEW_LENGTH, "…")
}

export class WebNotifications implements IPushAdapter {
  _unsubscriber = maybe<Unsubscriber>()

  async request(prompt = true) {
    if (prompt && Notification?.permission === "default") {
      await Notification.requestPermission()
    }

    return Notification?.permission || "denied"
  }

  _notify(event: TrustedEvent, title: string, body: string) {
    console.log("notify:", event)

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
      this._unsubscriber = onNotification(event => {
        const {push, messages, mentions, spaces} = notificationSettings.get()
        const $pubkey = app.get().user?.pubkey

        if (push && document.hidden && Notification?.permission === "granted") {
          const preview = makePreview(event)

          if (messages && matchFilter({kinds: DM_KINDS}, event)) {
            this._notify(
              event,
              "New direct message",
              preview || "Someone sent you a direct message.",
            )
          } else if (mentions && $pubkey && tagValues(hexTags("p"), event.tags).includes($pubkey)) {
            this._notify(
              event,
              "Someone mentioned you",
              preview || "Someone tagged you in a message.",
            )
          } else if (spaces) {
            this._notify(event, "New activity", preview || "Someone posted a new message.")
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
