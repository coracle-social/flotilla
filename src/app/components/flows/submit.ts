import {get, writable} from "svelte/store"
import {UserError} from "@lib/util"
import {pushToast} from "@app/navigation/toast"

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
        if (error instanceof UserError) {
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
