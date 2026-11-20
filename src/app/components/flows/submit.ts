import {get, writable} from "svelte/store"
import {UserError} from "@lib/util"
import {LoginRequired} from "@app/core/user"
import {pushToast} from "@app/navigation/toast"
import {promptLogin} from "@app/components/flows/login"

// A call while the action runs does nothing, which keeps a form from submitting twice.
export const trackSubmit = <Args extends unknown[]>(
  failure: (error: unknown) => string,
  submit: (...args: Args) => Promise<unknown>,
) => {
  const loading = writable(false)

  const run = async (...args: Args) => {
    if (!get(loading)) {
      loading.set(true)

      try {
        await submit(...args)
      } catch (error) {
        if (error instanceof LoginRequired) {
          promptLogin()
        } else if (error instanceof UserError) {
          pushToast({theme: "error", message: error.message})
        } else {
          console.error(error)
          pushToast({theme: "error", message: failure(error)})
        }
      } finally {
        loading.set(false)
      }
    }
  }

  return {loading, submit: run}
}
