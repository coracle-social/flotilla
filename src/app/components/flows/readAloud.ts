import {get} from "svelte/store"
import type {TrustedEvent} from "@welshman/util"
import Confirm from "@lib/components/Confirm.svelte"
import {popModal, pushModal} from "@app/navigation/dialogs"
import {endCall, isCallActive} from "@app/features/spaces/calls"
import {readAloud} from "@app/features/voice"

// Reading a message aloud during a call would talk over it, so the user chooses which to keep.
export const readEventAloud = async (event: TrustedEvent) => {
  if (get(isCallActive)) {
    pushModal(Confirm, {
      title: "Leave the call?",
      message: "Reading a message out loud would talk over the call you are in.",
      confirm: async () => {
        await endCall()
        popModal()
        await readAloud(event)
      },
    })
  } else {
    await readAloud(event)
  }
}
