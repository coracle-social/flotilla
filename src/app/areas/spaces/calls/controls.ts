import type {PickSource} from "@app/areas/spaces/calls/screenShare"
import type {DeviceKind} from "@app/areas/spaces/calls/state"

// The engine holds livekit, so it loads with the first call operation rather than at startup.
const loadEngine = () => import("@app/areas/spaces/calls/engine")

export const joinVoiceRoom = async (
  url: string,
  h: string,
  startMuted?: boolean,
  preferredMicId?: string,
) => {
  const engine = await loadEngine()

  return engine.joinVoiceRoom(url, h, startMuted, preferredMicId)
}

export const leaveVoiceRoom = async () => {
  const engine = await loadEngine()

  return engine.leaveVoiceRoom()
}

export const cancelJoinVoiceRoom = async () => {
  const engine = await loadEngine()

  return engine.cancelJoinVoiceRoom()
}

export const endCall = async () => {
  const engine = await loadEngine()

  return engine.endCall()
}

export const toggleMute = async () => {
  const engine = await loadEngine()

  return engine.toggleMute()
}

export const toggleCamera = async () => {
  const engine = await loadEngine()

  return engine.toggleCamera()
}

export const toggleScreenShare = async (pickSource: PickSource) => {
  const engine = await loadEngine()

  return engine.toggleScreenShare(pickSource)
}

export const switchCallActiveDevice = async (kind: DeviceKind, targetDeviceId: string) => {
  const engine = await loadEngine()

  return engine.switchCallActiveDevice(kind, targetDeviceId)
}
