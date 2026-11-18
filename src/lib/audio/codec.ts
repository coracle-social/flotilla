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
