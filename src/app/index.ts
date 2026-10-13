import {registerPolicies} from "@app/core/policies"
import {registerStorage} from "@app/core/storage"
import {registerNotifications} from "@app/ui/notifications"
import {registerBookmarks} from "@app/features/bookmarks"
import {registerCall} from "@app/features/call"
import {registerChats} from "@app/features/chats"
import {registerCommands} from "@app/features/commands"
import {registerContent} from "@app/features/content"
import {registerFeatured} from "@app/features/featured"
import {registerPush} from "@app/features/push"

let registered = false

// Runs before anything builds the app, which reads its policies and retention rules when it's constructed.
export const registerAll = () => {
  // Hot reloading the root layout calls this again.
  if (!registered) {
    registered = true
    registerPolicies()
    registerStorage()
    registerNotifications()
    registerBookmarks()
    registerCall()
    registerChats()
    registerCommands()
    registerContent()
    registerFeatured()
    registerPush()
  }
}
