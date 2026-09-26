import {get, writable} from "svelte/store"
import type {Maybe} from "@welshman/lib"
import type {TrustedEvent} from "@welshman/util"
import {toWav} from "@lib/audio"
import {errorMessage} from "@lib/util"
import Confirm from "@lib/components/Confirm.svelte"
import OpenRouterEnable from "@app/components/OpenRouterEnable.svelte"
import {endCall, isCallActive} from "@app/call"
import {profiles} from "@app/core"
import {pushModal} from "@app/modal"
import {postOpenRouter} from "@app/openrouter"
import {renderEventAsText} from "@app/render"
import {getSetting} from "@app/settings"
import {pushToast} from "@app/toast"

const SPEECH_MODEL = "hexgrad/kokoro-82m"

const SPEECH_VOICE = "af_bella"

// Raw pcm carries no header, so decoding the mp3 is what reads the sample rate and format.
const SPEECH_FORMAT = "mp3"

// Decoding resamples to the context's rate, so this is the rate the wav ends up at.
const SPEECH_RATE = 48000

export type Speech = {
  id: string
  title: string
  src?: string
}

export const speech = writable<Maybe<Speech>>(undefined)

// An offline context never reaches for the speakers.
const decode = (data: ArrayBuffer) =>
  new OfflineAudioContext(1, 1, SPEECH_RATE).decodeAudioData(data)

export const synthesize = async (text: string) => {
  const response = await postOpenRouter(
    "audio/speech",
    JSON.stringify({
      model: SPEECH_MODEL,
      voice: SPEECH_VOICE,
      input: text,
      response_format: SPEECH_FORMAT,
    }),
    {"Content-Type": "application/json"},
  )

  return toWav(await decode(await response.arrayBuffer()))
}

export const stopSpeech = () =>
  speech.update(current => {
    if (current?.src) {
      URL.revokeObjectURL(current.src)
    }

    return undefined
  })

const play = async (event: TrustedEvent, text: string) => {
  const {id, pubkey} = event
  const title = profiles.get().display(pubkey).get()

  stopSpeech()
  speech.set({id, title})

  try {
    const src = URL.createObjectURL(await synthesize(text))

    // Reading a second message while this one was in flight hands the player to that one.
    if (get(speech)?.id === id) {
      speech.set({id, title, src})
    } else {
      URL.revokeObjectURL(src)
    }
  } catch (error) {
    console.error(error)
    pushToast({theme: "error", message: `Failed to read this message: ${errorMessage(error)}`})

    if (get(speech)?.id === id) {
      stopSpeech()
    }
  }
}

export const readAloud = (event: TrustedEvent) => {
  const text = renderEventAsText(event)

  if (getSetting("openrouter_key")) {
    if (get(isCallActive)) {
      pushModal(Confirm, {
        title: "Leave the call?",
        message: "Reading a message out loud would talk over the call you are in.",
        confirm: async () => {
          await endCall()

          history.back()

          await play(event, text)
        },
      })
    } else {
      play(event, text)
    }
  } else {
    pushModal(OpenRouterEnable, {
      feature: "Read out loud",
      subtitle: "Have a message read to you instead of reading it yourself.",
    })
  }
}
