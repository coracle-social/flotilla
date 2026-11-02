import {get, writable} from "svelte/store"
import type {Maybe} from "@welshman/lib"
import type {TrustedEvent} from "@welshman/util"
import {errorMessage} from "@lib/util"
import Confirm from "@lib/components/Confirm.svelte"
import {profiles} from "@app/core/plugins"
import {popModal, pushModal} from "@app/navigation/dialogs"
import {renderEventAsText} from "@app/features/render"
import {pushToast} from "@app/features/toast"
import {endCall, isCallActive} from "@app/features/spaces/calls"
import type {Tts} from "@app/features/voice/providers/common"
import {resolveVoiceProvider} from "@app/features/voice/resolve"

// Text to speech: a message read out loud.
export type ReadingAloud = {
  id: string
  title: string
  src?: string
}

// The message being read out loud, which has no audio until synthesis finishes.
export const readingAloud = writable<Maybe<ReadingAloud>>(undefined)

let controller: AbortController | undefined

export const stopReadingAloud = () => {
  controller?.abort()
  controller = undefined
  readingAloud.update(current => {
    if (current?.src) {
      URL.revokeObjectURL(current.src)
    }

    return undefined
  })
}

const play = async (tts: Tts, event: TrustedEvent, text: string) => {
  const {id, pubkey} = event
  const title = profiles.get().display(pubkey).get()

  stopReadingAloud()
  const pending = new AbortController()
  controller = pending
  readingAloud.set({id, title})

  try {
    const src = URL.createObjectURL(await tts(text, pending.signal))

    // Reading a second message while this one was in flight hands the player to that one.
    if (controller === pending) {
      readingAloud.set({id, title, src})
    } else {
      URL.revokeObjectURL(src)
    }
  } catch (error) {
    if (controller === pending && !pending.signal.aborted) {
      console.error(error)
      pushToast({theme: "error", message: `Failed to read this message: ${errorMessage(error)}`})
      stopReadingAloud()
    }
  }
}

export const readAloud = async (event: TrustedEvent) => {
  const text = renderEventAsText(event)

  try {
    const {providers, setup} = await resolveVoiceProvider("tts")
    const provider = providers[0]

    if (provider) {
      if (get(isCallActive)) {
        pushModal(Confirm, {
          title: "Leave the call?",
          message: "Reading a message out loud would talk over the call you are in.",
          confirm: async () => {
            await endCall()
            popModal()
            await play(provider.tts, event, text)
          },
        })
      } else {
        await play(provider.tts, event, text)
      }
    } else {
      setup.enable("tts", {onReady: () => readAloud(event)})
    }
  } catch (error) {
    console.error(error)
    pushToast({theme: "error", message: `Failed to prepare speech: ${errorMessage(error)}`})
  }
}
