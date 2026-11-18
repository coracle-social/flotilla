import {noop, tryCatch} from "@welshman/lib"

export const listMediaDevices = async (): Promise<MediaDeviceInfo[]> => {
  try {
    return (await navigator.mediaDevices?.enumerateDevices?.()) ?? []
  } catch {
    return []
  }
}

// enumerateDevices leaves a device's id empty until permission for its kind has been granted.
export const selectableDevices = (devices: MediaDeviceInfo[], kind: MediaDeviceKind) =>
  devices.filter(d => d.kind === kind && d.deviceId !== "")

// Granting permission for a kind is the only thing that reveals its devices.
export const requestDevicePermission = async (constraints: MediaStreamConstraints) => {
  const stream = await tryCatch(() => navigator.mediaDevices.getUserMedia(constraints))

  stream?.getTracks().forEach(t => t.stop())
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
