import {record} from "@lib/audio"
import type {Recording} from "@lib/audio"
import {errorMessage} from "@lib/util"
import {pushToast} from "@app/features/toast"
import type {Stt} from "@app/features/voice/providers/common"
import {resolveVoiceProvider} from "@app/features/voice/resolve"

// Speech to text: a composer's recording, sent as a voice note or transcribed into the draft.
export type Dictation = Recording & {
  controller?: AbortController
  recording: boolean
  // Resolves once the transcript or the error is on the dictation, which stays in the registry.
  finished?: Promise<void>
  transcript?: string
  error?: unknown
}

// Held here rather than by the composer, so navigating away transcribes in the background.
const dictations = new Map<string, Dictation>()

export const getDictation = (key: string) => dictations.get(key)

export const clearDictation = (key: string) => {
  dictations.get(key)?.controller?.abort()
  dictations.delete(key)
}

const runStt = (dictation: Dictation, stt: Stt) => {
  if (dictation.finished) {
    return
  }
  const controller = new AbortController()
  dictation.controller = controller
  dictation.error = undefined
  dictation.finished = dictation.audio
    .then(audio => stt(audio, controller.signal))
    .then(
      transcript => {
        dictation.transcript = transcript
      },
      error => {
        dictation.error = error
      },
    )
}

export const startDictation = async (key: string) => {
  const recording = await record("dictation")
  const dictation: Dictation = {
    ...recording,
    recording: true,
    stop: () => {
      dictation.recording = false
      recording.stop()
    },
  }

  dictations.set(key, dictation)

  return dictation
}

// Asks for a provider first when none is ready, with the prompt over the recorder rather than replacing it.
export const transcribeDictation = async (dictation: Dictation): Promise<boolean> => {
  try {
    const {provider, ready} = await resolveVoiceProvider("stt")

    if (ready) {
      runStt(dictation, provider.stt)

      return true
    }

    return await new Promise<boolean>(resolve => {
      provider.enable("stt", {
        nested: true,
        onReady: () => resolve(transcribeDictation(dictation)),
        onCancel: () => resolve(false),
      })
    })
  } catch (error) {
    console.error(error)
    pushToast({theme: "error", message: `Failed to prepare dictation: ${errorMessage(error)}`})

    return false
  }
}
