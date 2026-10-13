import {noop} from "@welshman/lib"

const WAV_BIT_DEPTH = 16

const WAV_HEADER_LENGTH = 44

export const toWav = (audio: AudioBuffer) => {
  const {numberOfChannels, sampleRate, length} = audio
  const bytesPerFrame = (numberOfChannels * WAV_BIT_DEPTH) / 8
  const dataLength = length * bytesPerFrame
  const wav = new ArrayBuffer(WAV_HEADER_LENGTH + dataLength)
  const view = new DataView(wav)
  const ascii = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) {
      view.setUint8(offset + i, value.charCodeAt(i))
    }
  }

  ascii(0, "RIFF")
  view.setUint32(4, 36 + dataLength, true)
  ascii(8, "WAVEfmt ")
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, numberOfChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * bytesPerFrame, true)
  view.setUint16(32, bytesPerFrame, true)
  view.setUint16(34, WAV_BIT_DEPTH, true)
  ascii(36, "data")
  view.setUint32(40, dataLength, true)

  const channels = Array.from({length: numberOfChannels}, (_, i) => audio.getChannelData(i))

  let offset = WAV_HEADER_LENGTH

  for (let frame = 0; frame < length; frame++) {
    for (const samples of channels) {
      // A decoded sample runs from -1 to 1, and the two ends of a signed 16 bit range differ in size.
      const sample = Math.max(-1, Math.min(1, samples[frame]))

      view.setInt16(offset, Math.round(sample * (sample < 0 ? 0x8000 : 0x7fff)), true)

      offset += 2
    }
  }

  return new Blob([wav], {type: "audio/wav"})
}

export const listMediaDevices = async (): Promise<MediaDeviceInfo[]> => {
  try {
    return (await navigator.mediaDevices?.enumerateDevices?.()) ?? []
  } catch {
    return []
  }
}

// Calls onFrame with the root mean square of the stream's waveform, from 0 to 1, on every animation frame.
export const watchAudioLevel = (stream: MediaStream, onFrame: (rms: number) => void) => {
  const context = new AudioContext()
  const analyser = context.createAnalyser()

  analyser.fftSize = 512

  context.createMediaStreamSource(stream).connect(analyser)

  const samples = new Uint8Array(analyser.frequencyBinCount)

  const measure = () => {
    analyser.getByteTimeDomainData(samples)

    let sumSquares = 0

    for (const sample of samples) {
      sumSquares += ((sample - 128) / 128) ** 2
    }

    onFrame(Math.sqrt(sumSquares / samples.length))

    frame = requestAnimationFrame(measure)
  }

  let frame = requestAnimationFrame(measure)

  return () => {
    cancelAnimationFrame(frame)
    context.close().catch(noop)
  }
}

// Mixes every channel down to one and resamples it to the rate a model expects.
export const decodeMono = async (file: Blob, sampleRate: number) => {
  let audio = await new OfflineAudioContext(1, 1, sampleRate).decodeAudioData(
    await file.arrayBuffer(),
  )

  if (audio.sampleRate !== sampleRate) {
    const context = new OfflineAudioContext(
      audio.numberOfChannels,
      Math.ceil(audio.duration * sampleRate),
      sampleRate,
    )
    const source = context.createBufferSource()
    source.buffer = audio
    source.connect(context.destination)
    source.start()
    audio = await context.startRendering()
  }

  const samples = new Float32Array(audio.length)
  for (let channel = 0; channel < audio.numberOfChannels; channel++) {
    const data = audio.getChannelData(channel)
    for (let i = 0; i < samples.length; i++) {
      samples[i] += data[i] / audio.numberOfChannels
    }
  }
  return samples
}

const EXTENSIONS_BY_MIME_TYPE: Record<string, string> = {
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mp4": "m4a",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
}

export type Recording = {
  // The microphone itself, so a level meter can read it while the recording runs.
  track: MediaStreamTrack
  stop: () => void
  // Resolves once recording has stopped, with the audio named for the format the recorder chose.
  audio: Promise<File>
}

export const record = async (name: string): Promise<Recording> => {
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
