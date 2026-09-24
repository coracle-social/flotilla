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

// Raw pcm carries no header, so decoding the mp3 is what reads the sample rate and format.
const SPEECH_FORMAT = "mp3"

// Decoding resamples to the context's rate, so this is the rate the wav ends up at.
const SPEECH_RATE = 48000

const SPEECH_BIT_DEPTH = 16

const WAV_HEADER_LENGTH = 44

export type Speech = {
  id: string
  title: string
  src?: string
}

export const speech = writable<Maybe<Speech>>(undefined)

// An offline context never reaches for the speakers.
const decode = (data: ArrayBuffer) =>
  new OfflineAudioContext(1, 1, SPEECH_RATE).decodeAudioData(data)

const toWav = (audio: AudioBuffer) => {
  const {numberOfChannels, sampleRate, length} = audio
  const bytesPerFrame = (numberOfChannels * SPEECH_BIT_DEPTH) / 8
  const dataLength = length * bytesPerFrame
  const wav = new ArrayBuffer(WAV_HEADER_LENGTH + dataLength)
  const view = new DataView(wav)
  const ascii = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) {
      view.setUint8(offset + i, value.charCodeAt(i))
    }
  }

  ascii(0, "RIFF")
  view.setUint32(4, 36 + dataLength, true)
  ascii(8, "WAVEfmt ")
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, numberOfChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * bytesPerFrame, true)
  view.setUint16(32, bytesPerFrame, true)
  view.setUint16(34, SPEECH_BIT_DEPTH, true)
  ascii(36, "data")
  view.setUint32(40, dataLength, true)

  const channels = Array.from({length: numberOfChannels}, (_, i) => audio.getChannelData(i))

  let offset = WAV_HEADER_LENGTH

  for (let frame = 0; frame < length; frame++) {
    for (const samples of channels) {
      // A decoded sample runs from -1 to 1, and the two ends of a signed 16 bit range differ in size.
      const sample = Math.max(-1, Math.min(1, samples[frame]))

      view.setInt16(offset, Math.round(sample * (sample < 0 ? 0x8000 : 0x7fff)), true)

      offset += 2
    }
  }

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

  // A successful response is audio rather than json.
  if (!response.ok) {
    const {error} = await response.json().catch(() => ({error: undefined}))

    throw new Error(error?.message || `OpenRouter returned a ${response.status}.`)
  }

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
