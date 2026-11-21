import {registerAuth} from "@app/core/auth"
import {registerIngest} from "@app/core/ingest"
import {registerNotify} from "@app/core/notify"
import {registerRelays} from "@app/core/relays"
import {registerSettings} from "@app/core/settings"
import {registerStorage} from "@app/core/storage"
import {registerUser} from "@app/core/user"
import {registerBookmarks} from "@app/areas/bookmarks"
import {registerMessages} from "@app/areas/messages"
import {registerHome} from "@app/areas/home"
import {registerPomade} from "@app/core/pomade"
import {registerPush} from "@app/tools/push"
import {registerChecked} from "@app/tools/checked"
import {registerSpaceModel} from "@app/tools/spaces"
import {registerSpaces} from "@app/areas/spaces"
import {registerCalls} from "@app/areas/spaces/calls"
import {registerRoles} from "@app/areas/spaces/roles"
import {registerPinboards} from "@app/areas/spaces/pinboards"
import {registerCommands} from "@app/areas/spaces/rooms/commands"
import {registerRooms} from "@app/areas/spaces/rooms"
import {registerWallet} from "@app/tools/wallet"

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
    registerUser()
    registerBookmarks()
    registerMessages()
    registerHome()
    registerPomade()
    registerPush()
    registerChecked()
    registerWallet()
    registerSpaces()
    registerCalls()
    registerRoles()
    registerSpaceModel()
    registerPinboards()
    registerCommands()
    registerRooms()
  }
}
