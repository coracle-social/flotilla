import {registerPlugin} from "@capacitor/core"
import type {Unsubscriber} from "svelte/store"
import type {TrustedEvent} from "@welshman/util"
import {app} from "@app/core"
import {WebNotifications} from "@app/push/adapters/web"
import {goToEvent} from "@app/routes"
import {pushToast} from "@app/toast"

const DesktopWindow = registerPlugin<{show: () => Promise<void>}>("DesktopWindow")

export class ElectronNotifications extends WebNotifications {
  _unsubscribeApp: Unsubscriber | undefined
  _notifications = new Set<Notification>()

  _closeNotifications = () => {
    for (const notification of this._notifications) {
      notification.close()
    }
    this._notifications.clear()
  }

  _onVisibilityChange = () => {
    if (document.visibilityState === "visible") {
      this._closeNotifications()
    }
  }

  _notify(event: TrustedEvent, title: string, body: string) {
    const owner = app.get()
    const notification = new Notification(title, {
      body,
      tag: event.id,
      icon: "/icon.png",
      badge: "/icon.png",
    })

    this._notifications.add(notification)
    notification.onclose = () => this._notifications.delete(notification)
    notification.onclick = async () => {
      try {
        if (app.get() === owner) {
          await DesktopWindow.show()
          if (app.get() === owner) {
            goToEvent(event)
          }
        }
      } catch (error) {
        console.error(error)
        pushToast({message: "Unable to open the notification", theme: "error"})
      } finally {
        notification.close()
        this._notifications.delete(notification)
      }
    }
  }

  async enable() {
    if (!this._unsubscriber) {
      this._unsubscribeApp = app.subscribe(this._closeNotifications)
      document.addEventListener("visibilitychange", this._onVisibilityChange)
    }
    return super.enable()
  }

  async disable() {
    this._unsubscribeApp?.()
    this._unsubscribeApp = undefined
    document.removeEventListener("visibilitychange", this._onVisibilityChange)
    this._closeNotifications()
    return super.disable()
  }
}
