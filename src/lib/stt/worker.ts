import {sum} from "@welshman/lib"
import {missingSttBytes, openSttCache, sttFiles} from "./models"
import type {SttFile, SttRequest, SttResponse} from "./types"

// What the engine writes its answer into, which a five minute transcript with word times fits.
const outputCapacity = 1 << 19

type Engine = {
  HEAPU8: Uint8Array
  UTF8ToString: (pointer: number) => string
  _malloc: (bytes: number) => number
  _free: (pointer: number) => void
  _needle_load: (cact: number, bytes: bigint) => number
  _needle_transcribe: (
    pcm: number,
    samples: number,
    language: number,
    keywords: number,
    wordTimestamps: number,
    out: number,
    capacity: number,
  ) => number
}

type Factory = (options: {wasmBinary: ArrayBuffer}) => Promise<Engine>

type Answer = {text: string; language: string; words?: {probability: number}[]}

const send = (response: SttResponse) => postMessage(response)

// One bar over every file, so the engine and the weights read as a single download.
const trackDownload = (remaining: number) => {
  const loaded = new Map<string, number>()

  return (url: string, bytes: number) => {
    loaded.set(url, bytes)

    const percent = Math.min(100, (sum(Array.from(loaded.values())) / remaining) * 100)

    send({
      type: "progress",
      message: percent < 100 ? "Downloading model…" : "Preparing model…",
      percent,
    })
  }
}

type Track = ReturnType<typeof trackDownload>

const download = async (cache: Cache, {url}: SttFile, track: Track) => {
  const cached = await cache.match(url)

  if (cached) {
    return cached.arrayBuffer()
  }

  const response = await fetch(url)

  if (!response.ok || !response.body) {
    throw new Error("The speech model could not be downloaded.")
  }

  const reader = response.body.getReader()
  const chunks: BlobPart[] = []
  let loaded = 0
  let chunk = await reader.read()

  // Reading the body rather than handing it straight to the cache is what makes the bar move.
  while (!chunk.done) {
    chunks.push(chunk.value)
    loaded += chunk.value.byteLength
    track(url, loaded)
    chunk = await reader.read()
  }

  const body = new Blob(chunks)

  await cache.put(url, new Response(body))

  return body.arrayBuffer()
}

const load = async () => {
  const cache = await openSttCache()
  const track = trackDownload(await missingSttBytes())
  const [source, wasmBinary, weights] = await Promise.all([
    download(cache, sttFiles.script, track).then(buffer => new TextDecoder().decode(buffer)),
    download(cache, sttFiles.wasm, track),
    download(cache, sttFiles.weights, track),
  ])

  // The engine is a classic script naming its factory, so an export is what a module can import.
  const url = URL.createObjectURL(
    new Blob([source, "\nexport default createNeedle"], {type: "text/javascript"}),
  )
  const factory: Factory = await import(/* @vite-ignore */ url).then(module => module.default)

  URL.revokeObjectURL(url)

  const engine = await factory({wasmBinary})
  const bytes = new Uint8Array(weights)
  const cact = engine._malloc(bytes.length)
  const output = engine._malloc(outputCapacity)

  if (!cact || !output) {
    throw new Error("The speech model does not fit in this browser's memory.")
  }

  engine.HEAPU8.set(bytes, cact)

  if (engine._needle_load(cact, BigInt(bytes.length)) !== 0) {
    throw new Error("The speech model could not be loaded.")
  }

  return {engine, output}
}

const transcribe = (engine: Engine, output: number, samples: Float32Array) => {
  send({type: "progress", message: "Transcribing…"})

  const pcm = engine._malloc(samples.byteLength)

  if (!pcm) {
    throw new Error("The recording does not fit in this browser's memory.")
  }

  try {
    engine.HEAPU8.set(new Uint8Array(samples.buffer, samples.byteOffset, samples.byteLength), pcm)

    // Given no language the engine detects one, and the fifth argument asks for word times.
    if (engine._needle_transcribe(pcm, samples.length, 0, 0, 1, output, outputCapacity) < 0) {
      throw new Error("The recording could not be transcribed.")
    }
  } finally {
    engine._free(pcm)
  }

  const {text, language, words = []}: Answer = JSON.parse(engine.UTF8ToString(output))

  send({
    type: "transcript",
    text: text.trim(),
    language,
    confidence: words.length > 0 ? sum(words.map(word => word.probability)) / words.length : 0,
  })
}

// Holding the engine between requests saves reloading 17 MB of weights, several seconds a recording.
let loading: Promise<{engine: Engine; output: number}> | undefined

const getEngine = () =>
  (loading ||= load().catch(error => {
    loading = undefined
    throw error
  }))

addEventListener("message", async ({data}: MessageEvent<SttRequest>) => {
  try {
    const {engine, output} = await getEngine()

    if (data.samples) {
      transcribe(engine, output, data.samples)
    } else {
      send({type: "ready"})
    }
  } catch (error) {
    send({type: "error", message: error instanceof Error ? error.message : String(error)})
  }
})
