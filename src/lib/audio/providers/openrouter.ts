import type {Maybe} from "@welshman/lib"
import {toWav} from "@lib/audio/codec"
import type {VoiceProvider} from "@lib/audio/voice"

export const makeOpenRouterProvider = ({getKey}: {getKey: () => string}): VoiceProvider => {
  // A successful response can be audio rather than json, so only a failure is read as json.
  const post = async (
    path: string,
    body: BodyInit,
    {headers, signal}: {headers?: Record<string, string>; signal?: AbortSignal} = {},
  ) => {
    const response = await fetch(`https://openrouter.ai/api/v1/${path}`, {
      method: "POST",
      headers: {Authorization: `Bearer ${getKey()}`, ...headers},
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

  return {
    name: "openrouter",
    ready: async () => Boolean(getKey()),
    tts: async (text: string, signal?: AbortSignal) => {
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

      return new File([toWav(audio)], "speech.wav", {type: "audio/wav"})
    },
    stt: async (audio: File, signal?: AbortSignal) => {
      const body = new FormData()

      body.append("model", "openai/whisper-large-v3-turbo")
      body.append("file", audio, audio.name)

      const response = await post("audio/transcriptions", body, {signal})
      const {text}: {text?: string} = await response.json()

      return text?.trim() ?? ""
    },
  }
}
