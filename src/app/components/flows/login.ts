import {user} from "@app/core/user"
import {clearModals} from "@app/navigation/dialogs"
import {loginRequest} from "@app/navigation/login"

// Asks a visitor to log in, for when there's nothing to run afterwards.
export const promptLogin = () => loginRequest.set({})

// Runs an action that needs an account, asking a visitor to log in first and running it once they have.
export const withLogin = (run: () => unknown) => {
  if (user.get()) {
    return run()
  }

  loginRequest.set({onLogin: run})
}

// Closes the login dialogs before resuming, since the visitor's action may open a dialog of its own.
export const finishLogin = async (onLogin?: () => unknown) => {
  await clearModals()
  onLogin?.()
}
