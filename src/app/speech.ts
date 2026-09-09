import {get, writable} from "svelte/store"
import type {Maybe} from "@welshman/lib"
import type {TrustedEvent} from "@welshman/util"
import {errorMessage} from "@lib/util"
import Confirm from "@lib/components/Confirm.svelte"
import OpenRouterEnable from "@app/components/OpenRouterEnable.svelte"
import {endCall, isCallActive} from "@app/call"
import {profiles} from "@app/core"
import {pushModal} from "@app/modal"
import {renderEventAsText} from "@app/render"
import {getSetting} from "@app/settings"
import {pushToast} from "@app/toast"

const SPEECH_MODEL = "hexgrad/kokoro-82m"

const SPEECH_VOICE = "af_bella"

// The endpoint encodes mp3 and raw pcm, and its mp3 carries a xing header naming a fraction of the
// frames it holds, so a browser reads a fifth more audio than is there and the scrubber never
// reaches the end. Raw pcm claims no length at all, so the wav header below is the only one.
const SPEECH_FORMAT = "pcm"

const SPEECH_RATE = 24000

const SPEECH_CHANNELS = 1

const SPEECH_BIT_DEPTH = 16

const WAV_HEADER_LENGTH = 44

export type Speech = {
  id: string
  title: string
  src?: string
}

export const speech = writable<Maybe<Speech>>(undefined)

const toWav = (pcm: ArrayBuffer) => {
  const bytesPerFrame = (SPEECH_CHANNELS * SPEECH_BIT_DEPTH) / 8
  const wav = new ArrayBuffer(WAV_HEADER_LENGTH + pcm.byteLength)
  const view = new DataView(wav)
  const ascii = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) {
      view.setUint8(offset + i, value.charCodeAt(i))
    }
  }

  ascii(0, "RIFF")
  view.setUint32(4, 36 + pcm.byteLength, true)
  ascii(8, "WAVEfmt ")
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, SPEECH_CHANNELS, true)
  view.setUint32(24, SPEECH_RATE, true)
  view.setUint32(28, SPEECH_RATE * bytesPerFrame, true)
  view.setUint16(32, bytesPerFrame, true)
  view.setUint16(34, SPEECH_BIT_DEPTH, true)
  ascii(36, "data")
  view.setUint32(40, pcm.byteLength, true)

  new Uint8Array(wav, WAV_HEADER_LENGTH).set(new Uint8Array(pcm))

  return new Blob([wav], {type: "audio/wav"})
}

export const synthesize = async (text: string) => {
  const response = await fetch("https://openrouter.ai/api/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getSetting("openrouter_key")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: SPEECH_MODEL,
      voice: SPEECH_VOICE,
      input: text,
      response_format: SPEECH_FORMAT,
    }),
  })

  // A successful response is audio rather than json, so the error body is only worth reading once
  // the status says there is one.
  if (!response.ok) {
    const {error} = await response.json().catch(() => ({error: undefined}))

    throw new Error(error?.message || `OpenRouter returned a ${response.status}.`)
  }

  return toWav(await response.arrayBuffer())
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
