import type {Maybe} from "@welshman/lib"
import {record} from "@lib/audio/recorder"
import type {Recorder} from "@lib/audio/recorder"
import {VoiceDeclined, resolveVoiceProvider} from "@lib/audio/voice"
import type {VoiceProvider, VoiceProviderFor} from "@lib/audio/voice"
import {voiceProviders} from "@app/tools/audio/providers"

// Speech to text: a composer's recording, sent as a voice note or transcribed into the draft.
export type Dictation = {
  recorder: Recorder
  controller?: AbortController
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

export const startDictation = async (key: string) => {
  const recorder = await record("dictation")
  const dictation: Dictation = {recorder}

  dictations.set(key, dictation)

  return dictation
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
    const audio = await dictation.recorder.audio

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

// Starts the transcript, or returns the provider to set up when none is ready.
export const transcribeDictation = async (dictation: Dictation): Promise<Maybe<VoiceProvider>> => {
  const {providers, setup} = await resolveVoiceProvider("stt", voiceProviders)

  if (providers.length > 0) {
    runStt(dictation, providers)
  } else {
    return setup
  }
}
