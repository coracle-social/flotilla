import {user} from "@app/core/user"
import {loginRequest} from "@app/navigation/login"

// Asks a visitor to log in, for when there's nothing to run afterwards.
export const promptLogin = (action: string) => loginRequest.set({action})

// Runs an action that needs an account, asking a visitor to log in first and running it once they have.
export const withLogin = (action: string, run: () => unknown) => {
  if (user.get()) {
    return run()
  }

  loginRequest.set({action, onLogin: run})
}
