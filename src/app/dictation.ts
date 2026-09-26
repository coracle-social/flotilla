import {watchAudioLevel} from "@lib/audio"
import {postOpenRouter} from "@app/openrouter"

const TRANSCRIPTION_MODEL = "openai/whisper-large-v3-turbo"

// OpenRouter chooses a decoder from the file extension, and MediaRecorder's format varies by engine.
const EXTENSIONS_BY_MIME_TYPE: Record<string, string> = {
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mp4": "m4a",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
}

const transcribe = async (audio: File) => {
  const body = new FormData()

  body.append("model", TRANSCRIPTION_MODEL)
  body.append("file", audio, audio.name)

  const response = await postOpenRouter("audio/transcriptions", body)
  const {text}: {text?: string} = await response.json()

  return text?.trim() ?? ""
}

export type Dictation = {
  recording: boolean
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

export const clearDictation = (key: string) => dictations.delete(key)

export const transcribeDictation = (dictation: Dictation) => {
  dictation.finished = dictation.audio.then(transcribe).then(
    transcript => {
      dictation.transcript = transcript
    },
    error => {
      dictation.error = error
    },
  )
}

// Levels follow the waveform's envelope, since raw root mean square drops to nothing between words.
export const startDictation = async (key: string, onLevel: (level: number) => void) => {
  const stream = await navigator.mediaDevices.getUserMedia({audio: true})
  const recorder = new MediaRecorder(stream)
  const chunks: Blob[] = []

  recorder.addEventListener("dataavailable", event => chunks.push(event.data))
  recorder.start()

  let level = 0

  const stopMeter = watchAudioLevel(stream, rms => {
    level = Math.max(rms, level * 0.92)

    onLevel(level)
  })

  const audio = new Promise<File>(resolve => {
    recorder.addEventListener("stop", () => {
      stopMeter()

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
    stop: () => {
      dictation.recording = false
      recorder.stop()
    },
    audio,
  }

  dictations.set(key, dictation)
}
