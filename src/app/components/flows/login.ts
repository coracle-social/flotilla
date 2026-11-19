import {user} from "@app/core/user"
import {pushModal} from "@app/navigation/dialogs"
import LogInPrompt from "@app/components/LogInPrompt.svelte"

// Runs an action that needs an account, asking a visitor to log in first and running it once they have.
export const withLogin = (action: string, run: () => unknown) => {
  if (user.get()) {
    return run()
  }

  pushModal(LogInPrompt, {action, onLogin: run})
}
