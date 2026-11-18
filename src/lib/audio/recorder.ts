const EXTENSIONS_BY_MIME_TYPE: Record<string, string> = {
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mp4": "m4a",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
}

export type Recorder = {
  // The microphone itself, so a level meter can read it while the recording runs.
  track: MediaStreamTrack
  stop: () => void
  // Resolves once recording has stopped, with the audio named for the format the recorder chose.
  audio: Promise<File>
}

export const record = async (name: string): Promise<Recorder> => {
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

      resolve(new File(chunks, `${name}.${extension}`, {type}))
    })
  })

  return {track: stream.getAudioTracks()[0], stop: () => recorder.stop(), audio}
}
