import {registerLogoutHandler} from "@app/core/session"
import {disablePush} from "@app/tools/push/push"

export * from "@app/tools/push/push"
export * from "@app/tools/push/registration"
export * from "@app/tools/push/server"
export * from "@app/tools/push/actions"

export const registerPush = () => {
  registerLogoutHandler(disablePush)
}
