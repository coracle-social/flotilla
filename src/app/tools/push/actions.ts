import {getPermissionMessage, isGranted} from "@lib/push/permission"
import {setSpaceNotifications} from "@app/core/settings"
import {alertSettings, updateAlertSettings} from "@app/tools/alerts/settings"
import type {AlertSettings} from "@app/tools/alerts/settings"
import {checkPushPermission, requestPushPermission} from "@app/tools/push/push"
import {pushToast} from "@app/navigation/toast"

export const optInSpaceNotifications = async (url: string, notify: boolean) => {
  if (notify && alertSettings.get().push) {
    const permission = await requestPushPermission()

    // A refused permission leaves the space's own choice alone, for when notifications are allowed.
    if (!isGranted(permission)) {
      updateAlertSettings({push: false})
      pushToast({theme: "error", message: getPermissionMessage(permission)})
    }
  }

  await setSpaceNotifications(url, notify)
}

export const saveAlertSettings = async (values: AlertSettings) => {
  const permission = values.push ? await requestPushPermission() : await checkPushPermission()
  const push = values.push && isGranted(permission)

  alertSettings.set({...values, push})

  return permission
}

export const enableMessageNotifications = async () => {
  const permission = await requestPushPermission()

  if (isGranted(permission)) {
    updateAlertSettings({push: true})
    updateAlertSettings({messages: true})
  }

  return permission
}
