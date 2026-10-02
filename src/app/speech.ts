import {get, writable} from "svelte/store"
import type {Maybe} from "@welshman/lib"
import type {TrustedEvent} from "@welshman/util"
import {errorMessage} from "@lib/util"
import Confirm from "@lib/components/Confirm.svelte"
import {endCall, isCallActive} from "@app/call"
import {profiles} from "@app/core"
import {resolveInference} from "@app/inference"
import type {Synthesize} from "@app/inference"
import {pushModal} from "@app/modal"
import {renderEventAsText} from "@app/render"
import {pushToast} from "@app/toast"

export type Speech = {
  id: string
  title: string
  src?: string
}

export const speech = writable<Maybe<Speech>>(undefined)

let controller: AbortController | undefined

export const stopSpeech = () => {
  controller?.abort()
  controller = undefined
  speech.update(current => {
    if (current?.src) {
      URL.revokeObjectURL(current.src)
    }

    return undefined
  })
}

const play = async (synthesize: Synthesize, event: TrustedEvent, text: string) => {
  const {id, pubkey} = event
  const title = profiles.get().display(pubkey).get()

  stopSpeech()
  const pending = new AbortController()
  controller = pending
  speech.set({id, title})

  try {
    const src = URL.createObjectURL(await synthesize(text, pending.signal))

    // Reading a second message while this one was in flight hands the player to that one.
    if (controller === pending) {
      speech.set({id, title, src})
    } else {
      URL.revokeObjectURL(src)
    }
  } catch (error) {
    if (controller === pending && !pending.signal.aborted) {
      console.error(error)
      pushToast({theme: "error", message: `Failed to read this message: ${errorMessage(error)}`})
      stopSpeech()
    }
  }
}

export const readAloud = async (event: TrustedEvent) => {
  const text = renderEventAsText(event)

  try {
    const {provider, ready} = await resolveInference("synthesize")

    if (ready) {
      if (get(isCallActive)) {
        pushModal(Confirm, {
          title: "Leave the call?",
          message: "Reading a message out loud would talk over the call you are in.",
          confirm: async () => {
            await endCall()
            history.back()
            await play(provider.synthesize, event, text)
          },
        })
      } else {
        await play(provider.synthesize, event, text)
      }
    } else {
      provider.enable("synthesize", {onReady: () => readAloud(event)})
    }
  } catch (error) {
    console.error(error)
    pushToast({theme: "error", message: `Failed to prepare speech: ${errorMessage(error)}`})
  }
}
