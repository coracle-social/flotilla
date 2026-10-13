import {sum} from "@welshman/lib"
import type {SttFile} from "./types"

export const sttModel = {
  id: "onnx-community/whisper-tiny",
  revision: "ff4177021cc41f7db950912b73ea4fdf7d01d8e7",
  device: "wasm",
  dtype: "q8",
  sampleRate: 16000,
} as const

const sttFiles: SttFile[] = [
  {path: "config.json", bytes: 2243},
  {path: "tokenizer.json", bytes: 2480466},
  {path: "tokenizer_config.json", bytes: 282683},
  {path: "preprocessor_config.json", bytes: 339},
  {path: "generation_config.json", bytes: 3772},
  {path: "onnx/encoder_model_quantized.onnx", bytes: 10124990},
  {path: "onnx/decoder_model_merged_quantized.onnx", bytes: 30719241},
]

// Users' downloaded models live under this name, so renaming it would strand them.
export const sttCacheName = `local-speech-${sttModel.revision}`

export const sttModelBytes = sum(sttFiles.map(({bytes}) => bytes))

export const sttModelUrl = (file: string) =>
  `https://huggingface.co/${sttModel.id}/resolve/${sttModel.revision}/${file}`

// What a download has left to fetch, so its progress can be one number rather than each file's own.
export const missingSttBytes = async () => {
  const cache = await caches.open(sttCacheName)
  const sizes = await Promise.all(
    sttFiles.map(async ({path, bytes}) => ((await cache.match(sttModelUrl(path))) ? 0 : bytes)),
  )

  return sum(sizes)
}

export const hasSttModel = async () => (await missingSttBytes()) === 0
