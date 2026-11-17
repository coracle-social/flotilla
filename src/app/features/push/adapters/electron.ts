import {registerPlugin} from "@capacitor/core"
import type {Unsubscriber} from "svelte/store"
import {app} from "@app/core/app"
import type {PushAdapter} from "@app/features/push/adapter"
import {createWebNotifications} from "@app/features/push/adapters/web"
import type {Notify} from "@app/features/push/adapters/web"
import {pushToast} from "@app/features/toast"
import {goToEvent} from "@app/navigation/locations"

const DesktopWindow = registerPlugin<{show: () => Promise<void>}>("DesktopWindow")

export const createElectronNotifications = (): PushAdapter => {
  const notifications = new Set<Notification>()
  let unsubscribeApp: Unsubscriber | undefined

  const closeNotifications = () => {
    for (const notification of notifications) {
      notification.close()
    }
    notifications.clear()
  }

  const onVisibilityChange = () => {
    if (document.visibilityState === "visible") {
      closeNotifications()
    }
  }

  const notify: Notify = (event, title, body) => {
    const owner = app.get()
    const notification = new Notification(title, {
      body,
      tag: event.id,
      icon: "/icon.png",
      badge: "/icon.png",
    })

    notifications.add(notification)
    notification.onclose = () => notifications.delete(notification)
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
        notifications.delete(notification)
      }
    }
  }

  const web = createWebNotifications(notify)

  const enable = async () => {
    if (!unsubscribeApp) {
      unsubscribeApp = app.subscribe(closeNotifications)
      document.addEventListener("visibilitychange", onVisibilityChange)
    }

    await web.enable()
  }

  const disable = async () => {
    unsubscribeApp?.()
    unsubscribeApp = undefined
    document.removeEventListener("visibilitychange", onVisibilityChange)
    closeNotifications()
    await web.disable()
  }

  return {...web, enable, disable}
}
