import {sum} from "@welshman/lib"
import type {SpeechFile} from "./types"

export const speechModel = {
  id: "onnx-community/whisper-tiny",
  revision: "ff4177021cc41f7db950912b73ea4fdf7d01d8e7",
  device: "wasm",
  dtype: "q8",
} as const

const speechFiles: SpeechFile[] = [
  {path: "config.json", bytes: 2243},
  {path: "tokenizer.json", bytes: 2480466},
  {path: "tokenizer_config.json", bytes: 282683},
  {path: "preprocessor_config.json", bytes: 339},
  {path: "generation_config.json", bytes: 3772},
  {path: "onnx/encoder_model_quantized.onnx", bytes: 10124990},
  {path: "onnx/decoder_model_merged_quantized.onnx", bytes: 30719241},
]

export const speechCacheName = `local-speech-${speechModel.revision}`

export const speechModelBytes = sum(speechFiles.map(({bytes}) => bytes))

export const speechModelUrl = (file: string) =>
  `https://huggingface.co/${speechModel.id}/resolve/${speechModel.revision}/${file}`

// What a download has left to fetch, so its progress can be one number rather than each file's own.
export const missingSpeechBytes = async () => {
  const cache = await caches.open(speechCacheName)
  const sizes = await Promise.all(
    speechFiles.map(async ({path, bytes}) =>
      (await cache.match(speechModelUrl(path))) ? 0 : bytes,
    ),
  )

  return sum(sizes)
}

export const hasSpeechModel = async () => (await missingSpeechBytes()) === 0
