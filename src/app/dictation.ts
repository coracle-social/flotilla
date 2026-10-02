import type {Transcribe} from "@app/inference"

const EXTENSIONS_BY_MIME_TYPE: Record<string, string> = {
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mp4": "m4a",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
}

export type Dictation = {
  controller?: AbortController
  recording: boolean
  // The microphone itself, so a level meter can read it while the recording runs.
  track: MediaStreamTrack
  stop: () => void
  // Resolves once recording has stopped, with the audio named for the format the recorder chose.
  audio: Promise<File>
  // Resolves once the transcript or the error is on the dictation, which stays in the registry.
  finished?: Promise<void>
  transcript?: string
  error?: unknown
}

// Held here rather than by the composer, so navigating away transcribes in the background.
const dictations = new Map<string, Dictation>()

export const getDictation = (key: string) => dictations.get(key)

export const clearDictation = (key: string) => {
  dictations.get(key)?.controller?.abort()
  dictations.delete(key)
}

export const transcribeDictation = (dictation: Dictation, transcribe: Transcribe) => {
  if (dictation.finished) {
    return
  }
  const controller = new AbortController()
  dictation.controller = controller
  dictation.error = undefined
  dictation.finished = dictation.audio
    .then(audio => transcribe(audio, controller.signal))
    .then(
      transcript => {
        dictation.transcript = transcript
      },
      error => {
        dictation.error = error
      },
    )
}

export const startDictation = async (key: string) => {
  const stream = await navigator.mediaDevices.getUserMedia({audio: true})
  const recorder = new MediaRecorder(stream)
  const chunks: Blob[] = []

  recorder.addEventListener("dataavailable", event => chunks.push(event.data))
  recorder.start()

  const audio = new Promise<File>(resolve => {
    recorder.addEventListener("stop", () => {
      for (const track of stream.getTracks()) {
        track.stop()
      }

      // The recorder names its codec alongside the container, which an imeta or a blossom url can't carry.
      const [type] = recorder.mimeType.split(";")
      const extension = EXTENSIONS_BY_MIME_TYPE[type] || "webm"

      resolve(new File(chunks, `dictation.${extension}`, {type}))
    })
  })

  const dictation: Dictation = {
    recording: true,
    track: stream.getAudioTracks()[0],
    stop: () => {
      dictation.recording = false
      recorder.stop()
    },
    audio,
  }

  dictations.set(key, dictation)

  return dictation
}
