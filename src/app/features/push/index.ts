import {registerLogoutHandler} from "@app/core/session"
import {disablePush} from "@app/features/push/push"

export * from "@app/features/push/permission"
export * from "@app/features/push/push"
export * from "@app/features/push/registration"
export * from "@app/features/push/server"
export * from "@app/features/push/settings"

export const registerPush = () => {
  registerLogoutHandler(disablePush)
}
