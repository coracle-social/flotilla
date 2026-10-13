import {env, pipeline, Tensor} from "@huggingface/transformers"
import type {ProgressInfo} from "@huggingface/transformers"
import {sum} from "@welshman/lib"
import wasmUrl from "@stt-runtime/ort-wasm-simd-threaded.jsep.wasm?url"
import wasmModuleUrl from "@stt-runtime/ort-wasm-simd-threaded.jsep.mjs?url"
import {sttCacheName, sttModel, missingSttBytes} from "./models"
import type {SttRequest, SttResponse} from "./types"

env.allowLocalModels = false
env.useBrowserCache = false
env.useCustomCache = true
if (env.backends.onnx.wasm) {
  env.backends.onnx.wasm.numThreads = 1
  env.backends.onnx.wasm.proxy = false
  env.backends.onnx.wasm.wasmPaths = {wasm: wasmUrl, mjs: wasmModuleUrl}
}

const send = (response: SttResponse) => postMessage(response)

// Each file reports its own percent, so the bar reads bytes against the whole download instead.
const downloadProgress = (remaining: number) => {
  const loaded = new Map<string, number>()

  return (info: ProgressInfo) => {
    if (info.status === "progress") {
      loaded.set(info.file, info.loaded)

      const percent = Math.min(100, (sum(Array.from(loaded.values())) / remaining) * 100)

      send({
        type: "progress",
        message: percent < 100 ? "Downloading model…" : "Preparing model…",
        percent,
      })
    }
  }
}

type Progress = ReturnType<typeof downloadProgress>

const loadTranscriber = (progress: Progress) => {
  const {id, revision, device, dtype} = sttModel

  return pipeline("automatic-speech-recognition", id, {
    revision,
    dtype,
    device,
    progress_callback: progress,
  })
}

// Holding the model between requests saves rebuilding its ONNX session, several seconds a recording.
let transcriber: Promise<Awaited<ReturnType<typeof loadTranscriber>>> | undefined

const getTranscriber = (progress: Progress) =>
  (transcriber ||= loadTranscriber(progress).catch(error => {
    transcriber = undefined
    throw error
  }))

const transcribe = async (
  model: Awaited<ReturnType<typeof loadTranscriber>>,
  samples: Float32Array,
) => {
  send({type: "progress", message: "Transcribing…"})

  // Transformers.js 3 defaults to English; detect the language from Whisper's first token.
  const config = model.model.generation_config as NonNullable<
    typeof model.model.generation_config
  > & {
    lang_to_id: Record<string, number>
  }
  const features = await model.processor(samples.slice(0, sttModel.sampleRate * 30))
  const {logits}: {logits: Tensor} = await model.model({
    ...features,
    decoder_input_ids: new Tensor("int64", [BigInt(config.decoder_start_token_id)], [1, 1]),
  })
  const language = Object.entries(config.lang_to_id)
    .reduce((best, candidate) =>
      Number(logits.data[candidate[1]]) > Number(logits.data[best[1]]) ? candidate : best,
    )[0]
    .slice(2, -2)
  const result = await model(samples, {
    language,
    chunk_length_s: 30,
    stride_length_s: 5,
    task: "transcribe",
  })

  send({
    type: "transcript",
    text: (Array.isArray(result) ? result.map(item => item.text).join(" ") : result.text).trim(),
  })
}

addEventListener("message", async ({data}: MessageEvent<SttRequest>) => {
  try {
    env.customCache = await caches.open(sttCacheName)

    const progress = downloadProgress(await missingSttBytes())

    send({type: "progress", message: "Loading model…"})

    const model = await getTranscriber(progress)

    if (data.samples) {
      await transcribe(model, data.samples)
    } else {
      send({type: "ready"})
    }
  } catch (error) {
    send({type: "error", message: error instanceof Error ? error.message : String(error)})
  }
})
