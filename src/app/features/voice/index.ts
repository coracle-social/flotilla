import {get, writable} from "svelte/store"
import type {Maybe} from "@welshman/lib"
import type {TrustedEvent} from "@welshman/util"
import {record} from "@lib/audio"
import type {Recording} from "@lib/audio"
import {errorMessage} from "@lib/util"
import Confirm from "@lib/components/Confirm.svelte"
import {profiles} from "@app/core/plugins"
import {popModal, pushModal} from "@app/navigation/dialogs"
import {renderEventAsText} from "@app/ui/render"
import {pushToast} from "@app/ui/toast"
import {endCall, isCallActive} from "@app/features/spaces/calls"
import {local} from "@app/features/voice/providers/local"
import {openrouter} from "@app/features/voice/providers/openrouter"
import type {
  Stt,
  Tts,
  VoiceProvider,
  VoiceProviderFor,
  VoiceTask,
} from "@app/features/voice/providers/common"

// Providers

const runOrder: VoiceProvider[] = [local, openrouter]

const setupOrder: VoiceProvider[] = [openrouter, local]

const serves =
  <T extends VoiceTask>(task: T) =>
  (provider: VoiceProvider): provider is VoiceProviderFor<T> =>
    Boolean(provider[task])

// The provider a task runs on, and whether it can run now or has to be set up first.
export const resolveVoiceProvider = async <T extends VoiceTask>(task: T) => {
  const candidates = await Promise.all(
    runOrder.filter(serves(task)).map(async provider => ({
      provider,
      ready: await provider.ready(task),
    })),
  )

  return (
    candidates.find(candidate => candidate.ready) ?? {
      provider: setupOrder.filter(serves(task))[0],
      ready: false,
    }
  )
}

// Speech to text: a composer's recording, sent as a voice note or transcribed into the draft

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

// Text to speech: a message read out loud

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
    const {provider, ready} = await resolveVoiceProvider("tts")

    if (ready) {
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
      provider.enable("tts", {onReady: () => readAloud(event)})
    }
  } catch (error) {
    console.error(error)
    pushToast({theme: "error", message: `Failed to prepare speech: ${errorMessage(error)}`})
  }
}
