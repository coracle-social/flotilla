import {writable} from "svelte/store"
import type {Maybe} from "@welshman/lib"
import {errorMessage} from "@lib/util"
import {resolveVoiceProvider} from "@lib/audio/voice"
import type {VoiceProvider} from "@lib/audio/voice"
import {voiceProviders} from "@app/tools/audio/providers"
import {pushToast} from "@app/navigation/toast"

// Text to speech: a message read out loud, which has no audio until synthesis finishes.
export type Reading = {
  id: string
  title: string
  audio?: File
}

export const reading = writable<Maybe<Reading>>(undefined)

let controller: AbortController | undefined

export const stopReadingAloud = () => {
  controller?.abort()
  controller = undefined
  reading.set(undefined)
}

// Reads the text out loud, or returns the provider to set up when none is ready.
export const readAloud = async (
  {id, title}: Pick<Reading, "id" | "title">,
  text: string,
): Promise<Maybe<VoiceProvider>> => {
  const {providers, setup} = await resolveVoiceProvider("tts", voiceProviders)
  const provider = providers[0]

  if (provider) {
    stopReadingAloud()
    const pending = new AbortController()
    controller = pending
    reading.set({id, title})

    try {
      const audio = await provider.tts(text, pending.signal)

      // Reading a second message while this one was in flight hands the player to that one.
      if (controller === pending) {
        reading.set({id, title, audio})
      }
    } catch (error) {
      if (controller === pending && !pending.signal.aborted) {
        console.error(error)
        pushToast({theme: "error", message: `Failed to read this message: ${errorMessage(error)}`})
        stopReadingAloud()
      }
    }
  } else {
    return setup
  }
}
