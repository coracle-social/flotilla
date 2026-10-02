import {writable} from "svelte/store"
import {decodeDictation} from "./audio"
import {hasSpeechModel, speechCacheName} from "./models"
import type {SpeechProgress, SpeechRequest, SpeechResponse, SpeechResult} from "./types"
import {getTestSpeech} from "@lib/test/speech"

export const localSpeechStatus = writable<SpeechProgress>({message: ""})

// The name every abort in the platform carries, so a caller tests one rather than a class.
const aborted = () => new DOMException("Aborted", "AbortError")

let queue = Promise.resolve()
const controllers = new Set<AbortController>()

let worker: Worker | undefined
let idle: ReturnType<typeof setTimeout> | undefined

const releaseWorker = () => {
  clearTimeout(idle)
  worker?.terminate()
  worker = undefined
}

// The worker holds its model between recordings, so only an idle one gives that memory back.
const idleWorker = () => {
  clearTimeout(idle)
  idle = setTimeout(releaseWorker, 120000)
}

const getWorker = () => {
  clearTimeout(idle)
  worker ||= new Worker(new URL("./worker.ts", import.meta.url), {type: "module"})

  return worker
}

export const hasLocalSpeech = () =>
  (import.meta.env.DEV && getTestSpeech()?.hasModel()) || hasSpeechModel()

export const runLocalSpeech = (
  request: SpeechRequest,
  signal?: AbortSignal,
): Promise<SpeechResult> => {
  const controller = new AbortController()
  const abort = () => controller.abort()
  signal?.addEventListener("abort", abort, {once: true})
  if (signal?.aborted) {
    abort()
  }
  controllers.add(controller)

  const progress = (update: SpeechProgress) => localSpeechStatus.set(update)

  const result = queue.then(async () => {
    if (controller.signal.aborted) {
      throw aborted()
    }
    progress({message: "Loading model…"})

    const test = import.meta.env.DEV && getTestSpeech()
    if (test) {
      return test.run(request, controller.signal, progress)
    }

    const active = getWorker()
    // One worker serves every request, so this request's listeners go when it resolves.
    const listening = new AbortController()
    const options = {signal: listening.signal}
    try {
      return await new Promise<SpeechResult>((resolve, reject) => {
        controller.signal.addEventListener("abort", () => reject(aborted()), {once: true})
        active.addEventListener(
          "error",
          event => reject(new Error(event.message || "The local speech model could not start.")),
          options,
        )
        active.addEventListener(
          "messageerror",
          () => reject(new Error("The local speech model returned unreadable data.")),
          options,
        )
        active.addEventListener(
          "message",
          ({data}: MessageEvent<SpeechResponse>) => {
            if (data.type === "progress") {
              progress({message: data.message, percent: data.percent})
            } else if (data.type === "error") {
              reject(new Error(data.message))
            } else {
              resolve(data)
            }
          },
          options,
        )
        active.postMessage(request)
      })
    } catch (error) {
      // An abandoned request leaves the worker mid-inference, so it goes rather than waits.
      releaseWorker()
      throw error
    } finally {
      listening.abort()
      if (worker === active) {
        idleWorker()
      }
    }
  })

  const finished = result.finally(() => {
    controllers.delete(controller)
    signal?.removeEventListener("abort", abort)
    progress({message: ""})
  })
  // Serializing requests keeps two of them from competing for mobile memory.
  queue = finished.then(
    () => {},
    () => {},
  )
  return finished
}

export const removeLocalSpeech = async () => {
  for (const controller of controllers) {
    controller.abort()
  }
  await queue
  releaseWorker()
  await caches.delete(speechCacheName)
}

export const transcribeLocally = async (audio: Blob, signal?: AbortSignal) => {
  const samples = await decodeDictation(audio)
  if (!samples.length || samples.every(sample => Math.abs(sample) < 0.0001)) {
    return ""
  }
  const result = await runLocalSpeech({samples}, signal)
  if (result.type !== "transcript") {
    throw new Error("The speech model returned no transcript.")
  }
  return result.text
}
