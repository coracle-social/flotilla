import {setSpaceNotifications} from "@app/core/settings"
import {clearBadges} from "@app/features/badges"
import {syncEventReminders} from "@app/features/reminders"
import {notificationSettings} from "@app/features/push/adapters/common"
import {Push} from "@app/features/push/push"

export const optInSpaceNotifications = async (url: string, notify: boolean) => {
  if (notify && notificationSettings.get().push) {
    const permission = await Push.request()

    if (permission.startsWith("granted")) {
      await setSpaceNotifications(url, true)
    }
  } else {
    await setSpaceNotifications(url, notify)
  }
}

export const saveNotificationSettings = async (
  values: ReturnType<typeof notificationSettings.get>,
) => {
  if (!values.badge) {
    clearBadges()
  }

  const permission = values.push ? await Push.request() : "granted"
  const push = values.push && permission.startsWith("granted")

  notificationSettings.set({...values, push})
  syncEventReminders().catch(console.error)

  return permission
}

export const getPermissionMessage = (permission: string) => {
  if (permission === "denied") {
    return "Notifications are blocked. Allow them for this app in your browser or device settings, then try again."
  }

  if (["default", "prompt", "prompt-with-rationale"].includes(permission)) {
    return "Notifications weren't allowed. Choose Allow when your browser or device asks."
  }

  return `Failed to request notification permissions (${permission}).`
}

export const enableMessageNotifications = async () => {
  const permission = await Push.request()

  if (permission.startsWith("granted")) {
    notificationSettings.update(values => ({...values, push: true, messages: true}))
  }

  return permission
}
