import {get} from "svelte/store"
import {ms} from "@welshman/lib"
import {throttled} from "@welshman/store"
import {signerHealth} from "@app/core/signer"
import {navigate} from "@app/ui/modal"
import {pushToast, toast} from "@app/ui/toast"

// Checked on a timer rather than on change, so an alert held back by another toast still goes out.
export const syncSignerAlerts = () =>
  throttled(ms(10), signerHealth).subscribe(({unresponsive}) => {
    if (unresponsive && !get(toast)) {
      pushToast({
        theme: "error",
        timeout: 60_000,
        message: "Your signer isn't responding.",
        action: {
          message: "Details",
          onclick: () => navigate("/settings/profile"),
        },
      })
    }
  })
