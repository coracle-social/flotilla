import type {Maybe} from "@welshman/lib"
import {toWav} from "@lib/audio"
import OpenRouterEnable from "@app/components/OpenRouterEnable.svelte"
import {pushModal} from "@app/ui/modal"
import {getSetting} from "@app/core/settings"
import type {
  InferenceEnable,
  InferenceProvider,
  InferenceTask,
} from "@app/features/inference/adapters/common"

const prompts: Record<InferenceTask, {feature: string; subtitle: string}> = {
  synthesize: {
    feature: "Read out loud",
    subtitle: "Have a message read to you instead of reading it yourself.",
  },
  transcribe: {
    feature: "Voice input",
    subtitle: "Say what you want to write and have it typed for you.",
  },
}

// A successful response can be audio rather than json, so only a failure is read as json.
const post = async (
  path: string,
  body: BodyInit,
  {headers, signal}: {headers?: Record<string, string>; signal?: AbortSignal} = {},
) => {
  const response = await fetch(`https://openrouter.ai/api/v1/${path}`, {
    method: "POST",
    headers: {Authorization: `Bearer ${getSetting("openrouter_key")}`, ...headers},
    body,
    signal,
  })

  if (!response.ok) {
    const payload: Maybe<{error?: {message?: string}}> = await response
      .json()
      .catch(() => undefined)

    throw new Error(payload?.error?.message || `OpenRouter returned a ${response.status}.`)
  }

  return response
}

export const openrouter: InferenceProvider = {
  ready: async () => Boolean(getSetting("openrouter_key")),
  enable: (task: InferenceTask, {onReady, onCancel, nested}: InferenceEnable) =>
    pushModal(OpenRouterEnable, {...prompts[task], onReady, onCancel}, {nested}),
  synthesize: async (text: string, signal?: AbortSignal) => {
    const response = await post(
      "audio/speech",
      JSON.stringify({
        model: "hexgrad/kokoro-82m",
        voice: "am_michael",
        input: text,
        // Raw pcm carries no header, so decoding the mp3 is what reads its rate and format.
        response_format: "mp3",
      }),
      {headers: {"Content-Type": "application/json"}, signal},
    )
    // An offline context never reaches for the speakers, and resamples to the rate given here.
    const audio = await new OfflineAudioContext(1, 1, 48000).decodeAudioData(
      await response.arrayBuffer(),
    )

    return toWav(audio)
  },
  transcribe: async (audio: File, signal?: AbortSignal) => {
    const body = new FormData()

    body.append("model", "openai/whisper-large-v3-turbo")
    body.append("file", audio, audio.name)

    const response = await post("audio/transcriptions", body, {signal})
    const {text}: {text?: string} = await response.json()

    return text?.trim() ?? ""
  },
}
