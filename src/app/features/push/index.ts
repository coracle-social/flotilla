import {registerLogoutHandler} from "@app/core/session"
import {Push} from "@app/features/push/push"

export {notificationSettings, onNotification} from "@app/features/push/adapters/common"
export * from "@app/features/push/push"
export * from "@app/features/push/settings"

export const registerPush = () => {
  registerLogoutHandler(Push.disable)
}
