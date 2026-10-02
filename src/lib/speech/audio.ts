import {int, MINUTE} from "@welshman/lib"

export const decodeDictation = async (file: Blob) => {
  let audio = await new OfflineAudioContext(1, 1, 16000).decodeAudioData(await file.arrayBuffer())

  if (audio.duration > int(5, MINUTE)) {
    throw new Error(
      "Transcribe recordings up to five minutes long. You can still send this recording as a voice note.",
    )
  }

  if (audio.sampleRate !== 16000) {
    const context = new OfflineAudioContext(
      audio.numberOfChannels,
      Math.ceil(audio.duration * 16000),
      16000,
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
