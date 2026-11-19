import {user} from "@app/core/user"
import {loginRequest} from "@app/navigation/login"

// Runs an action that needs an account, once a visitor has logged in, so a toggle reads its state before calling this rather than in the action.
export const withLogin = (action: string, run: () => unknown) => {
  if (user.get()) {
    return run()
  }

  loginRequest.set({action, onLogin: run})
}
