import {record} from "@lib/audio"
import type {Recording} from "@lib/audio"
import {errorMessage} from "@lib/util"
import {pushToast} from "@app/features/toast"
import {VoiceDeclined} from "@app/features/voice/providers/common"
import type {VoiceProviderFor} from "@app/features/voice/providers/common"
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

// Each provider that cannot read the recording hands it to the next, so one wait covers the chain.
const runStt = (dictation: Dictation, providers: VoiceProviderFor<"stt">[]) => {
  if (dictation.finished) {
    return
  }
  const controller = new AbortController()
  dictation.controller = controller
  dictation.error = undefined
  dictation.finished = (async () => {
    const audio = await dictation.audio

    for (const provider of providers) {
      try {
        dictation.transcript = await provider.stt(audio, controller.signal)
        dictation.error = undefined

        return
      } catch (error) {
        dictation.error = error

        if (!(error instanceof VoiceDeclined)) {
          return
        }
      }
    }
  })()
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
    const {providers, setup} = await resolveVoiceProvider("stt")

    if (providers.length > 0) {
      runStt(dictation, providers)

      return true
    }

    return await new Promise<boolean>(resolve => {
      setup.enable("stt", {
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
