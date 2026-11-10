import {setSpaceNotifications} from "@app/core/settings"
import {alertSettings, setAlertChannels, setAlertTypes} from "@app/features/alerts"
import type {AlertSettings} from "@app/features/alerts"
import {getPermissionMessage, isGranted} from "@app/features/push/permission"
import {requestPushPermission} from "@app/features/push/push"
import {pushToast} from "@app/features/toast"

export const optInSpaceNotifications = async (url: string, notify: boolean) => {
  if (notify && alertSettings.get().push) {
    const permission = await requestPushPermission()

    // A refused permission leaves the space's own choice alone, for when notifications are allowed.
    if (!isGranted(permission)) {
      setAlertChannels({push: false})
      pushToast({theme: "error", message: getPermissionMessage(permission)})
    }
  }

  await setSpaceNotifications(url, notify)
}

export const saveAlertSettings = async (values: AlertSettings) => {
  const permission = values.push ? await requestPushPermission() : "granted"
  const push = values.push && isGranted(permission)

  alertSettings.set({...values, push})

  return permission
}

export const enableMessageNotifications = async () => {
  const permission = await requestPushPermission()

  if (isGranted(permission)) {
    setAlertChannels({push: true})
    setAlertTypes({messages: true})
  }

  return permission
}
