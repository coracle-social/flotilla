import {get} from "svelte/store"
import type {TrustedEvent} from "@welshman/util"
import Confirm from "@lib/components/Confirm.svelte"
import {errorMessage} from "@lib/util"
import {profiles} from "@app/core/plugins"
import {popModal, pushModal} from "@app/navigation/dialogs"
import {pushToast} from "@app/navigation/toast"
import {renderEventAsText} from "@app/tools/render"
import {readAloud} from "@app/tools/audio/tts"
import {endCall, isCallActive} from "@app/features/spaces/calls"
import {setupVoice} from "@app/components/flows/voice"

const read = async (event: TrustedEvent) => {
  const title = profiles.get().display(event.pubkey).get()

  try {
    const setup = await readAloud({id: event.id, title}, renderEventAsText(event))

    if (setup && (await setupVoice("tts", setup))) {
      await read(event)
    }
  } catch (error) {
    console.error(error)
    pushToast({theme: "error", message: `Failed to prepare speech: ${errorMessage(error)}`})
  }
}

// Reading a message aloud during a call would talk over it, so the user chooses which to keep.
export const readEventAloud = async (event: TrustedEvent) => {
  if (get(isCallActive)) {
    pushModal(Confirm, {
      title: "Leave the call?",
      message: "Reading a message out loud would talk over the call you are in.",
      confirm: async () => {
        await endCall()
        popModal()
        await read(event)
      },
    })
  } else {
    await read(event)
  }
}
