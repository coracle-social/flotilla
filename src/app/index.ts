import {registerPolicies} from "@app/core/policies"
import {registerSettings} from "@app/core/settings"
import {registerStorage} from "@app/core/storage"
import {registerNotifications} from "@app/ui/notifications"
import {registerBookmarks} from "@app/features/bookmarks"
import {registerMessages} from "@app/features/messages"
import {registerPush} from "@app/features/push"
import {registerSpaces} from "@app/features/spaces"
import {registerCalls} from "@app/features/spaces/calls"
import {registerFeatured} from "@app/features/spaces/featured"
import {registerRoles} from "@app/features/spaces/management/roles"
import {registerMembership} from "@app/features/spaces/membership"
import {registerPinboards} from "@app/features/spaces/pinboards"
import {registerCommands} from "@app/features/spaces/rooms/commands"
import {registerRooms} from "@app/features/spaces/rooms"

let registered = false

// Runs before anything builds the app, which reads its policies and retention rules when it's constructed.
export const registerAll = () => {
  // Hot reloading the root layout calls this again.
  if (!registered) {
    registered = true
    registerPolicies()
    registerStorage()
    registerSettings()
    registerNotifications()
    registerBookmarks()
    registerMessages()
    registerPush()
    registerSpaces()
    registerCalls()
    registerFeatured()
    registerRoles()
    registerMembership()
    registerPinboards()
    registerCommands()
    registerRooms()
  }
}
