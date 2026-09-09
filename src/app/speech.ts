import {get, writable} from "svelte/store"
import {parse, renderAsText} from "@welshman/content"
import type {Maybe} from "@welshman/lib"
import type {TrustedEvent} from "@welshman/util"
import {errorMessage} from "@lib/util"
import Confirm from "@lib/components/Confirm.svelte"
import OpenRouterEnable from "@app/components/OpenRouterEnable.svelte"
import {endCall, isCallActive} from "@app/call"
import {profiles} from "@app/core"
import {pushModal} from "@app/modal"
import {getSetting} from "@app/settings"
import {pushToast} from "@app/toast"

const SPEECH_MODEL = "hexgrad/kokoro-82m"

const SPEECH_VOICE = "af_bella"

const SPEECH_FORMAT = "mp3"

export type Speech = {
  id: string
  title: string
  src?: string
}

export const speech = writable<Maybe<Speech>>(undefined)

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

  return response.blob()
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
  const text = renderAsText(parse(event)).toString().trim()

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
