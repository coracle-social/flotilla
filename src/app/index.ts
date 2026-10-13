import {registerAuth} from "@app/core/auth"
import {registerIngest} from "@app/core/ingest"
import {registerNotify} from "@app/core/notify"
import {registerRelays} from "@app/core/relays"
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
import {registerTrust} from "@app/features/spaces/trust"

let registered = false

// Runs before anything builds the app, which reads its policies and retention rules when it's constructed.
export const registerAll = () => {
  // Hot reloading the root layout calls this again.
  if (!registered) {
    registered = true
    registerIngest()
    registerAuth()
    registerRelays()
    registerNotify()
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
    registerTrust()
  }
}
