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

  if (permission.startsWith("granted")) {
    notificationSettings.set(values)
    syncEventReminders().catch(console.error)
  }

  return permission
}
