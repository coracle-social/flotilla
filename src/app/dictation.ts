import {getSetting} from "@app/settings"

const TRANSCRIPTION_MODEL = "openai/whisper-large-v3-turbo"

// OpenRouter chooses a decoder using the uploaded file's extension, and MediaRecorder's output
// format varies by engine — webm on chromium, mp4 on webkit.
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

  const response = await fetch("https://openrouter.ai/api/v1/audio/transcriptions", {
    method: "POST",
    headers: {Authorization: `Bearer ${getSetting("openrouter_key")}`},
    body,
  })

  const {text, error}: {text?: string; error?: {message?: string}} = await response.json()

  if (!response.ok) {
    throw new Error(error?.message || `OpenRouter returned a ${response.status}.`)
  }

  return text?.trim() ?? ""
}

export type Dictation = {
  recording: boolean
  stop: () => void
  // Resolves once recording has stopped, with the audio named for the format the recorder chose.
  audio: Promise<File>
  // Set when the speaker asks for a transcript, and resolves once that or the error is on the
  // dictation, so that awaiting it never takes the result out of the registry — whoever is still
  // around when it lands reads it from there.
  finished?: Promise<void>
  transcript?: string
  error?: unknown
}

// Dictations are held here rather than by the composer that started one, so navigating away from a
// conversation transcribes in the background and leaves the transcript for the next composer the
// way a draft is left.
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

// Reports how loud the microphone is once per frame, so the caller can show the speaker that we're
// hearing them. Levels follow the waveform's envelope — jumping to each peak, then decaying — since
// the raw root mean square drops to nothing in the gaps between words.
export const startDictation = async (key: string, onLevel: (level: number) => void) => {
  const stream = await navigator.mediaDevices.getUserMedia({audio: true})
  const recorder = new MediaRecorder(stream)
  const chunks: Blob[] = []

  recorder.addEventListener("dataavailable", event => chunks.push(event.data))
  recorder.start()

  const context = new AudioContext()
  const analyser = context.createAnalyser()

  analyser.fftSize = 512

  context.createMediaStreamSource(stream).connect(analyser)

  const samples = new Uint8Array(analyser.frequencyBinCount)

  let level = 0

  const measure = () => {
    analyser.getByteTimeDomainData(samples)

    let sumSquares = 0

    for (const sample of samples) {
      sumSquares += ((sample - 128) / 128) ** 2
    }

    level = Math.max(Math.sqrt(sumSquares / samples.length), level * 0.92)

    onLevel(level)

    frame = requestAnimationFrame(measure)
  }

  let frame = requestAnimationFrame(measure)

  const audio = new Promise<File>(resolve => {
    recorder.addEventListener("stop", () => {
      cancelAnimationFrame(frame)
      context.close()

      for (const track of stream.getTracks()) {
        track.stop()
      }

      // The recorder names its codec alongside the container, which is more than the imeta on a
      // voice note or the extension on a blossom url can carry, so keep the container alone.
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
