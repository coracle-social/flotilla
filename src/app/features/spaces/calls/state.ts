import {derived, get, writable} from "svelte/store"
import type {Room} from "@welshman/app"
import type {Room as LiveKitRoom} from "livekit-client"
import type {CallParticipant} from "@app/features/spaces/calls/participants"

export type CallSession = {
  url: string
  h: string
  livekit: LiveKitRoom
  cameraOn: boolean
  screenShareOn: boolean
}

/** Mic mute state is separate so toggling it does not re-render video tiles. */
export const callMicMuted = writable(true)

export type ParticipantMediaState = {
  muted: boolean
  cameraOn: boolean
}

export enum CallState {
  Joining = "joining",
  Connected = "connected",
  Disconnected = "disconnected",
}

export enum DeviceKind {
  AudioInput = "audioinput",
  AudioOutput = "audiooutput",
  VideoInput = "videoinput",
}

export const currentCallSession = writable<CallSession | undefined>(undefined)

export const callState = writable<CallState>(CallState.Disconnected)

export const callTargetRoom = writable<Room | undefined>(undefined)

export const isCallActive = derived(
  callState,
  $state => $state === CallState.Joining || $state === CallState.Connected,
)

export const deriveRoomCallState = (url: string, h?: string) =>
  derived([callState, callTargetRoom], ([$callState, $targetRoom]) =>
    $targetRoom?.url === url && $targetRoom.h === h ? $callState : CallState.Disconnected,
  )

export const deriveIsCallActiveElsewhere = (url: string | undefined, h: string | undefined) =>
  derived(
    [isCallActive, callTargetRoom],
    ([$isCallActive, $targetRoom]) =>
      $isCallActive &&
      $targetRoom !== undefined &&
      !($targetRoom.url === url && $targetRoom.h === h),
  )

// leaveVoiceRoom no-ops during Joining, so cancel the in-flight join instead.
export const endCall = async () => {
  const engine = await import("@app/features/spaces/calls/engine")

  if (get(callState) === CallState.Joining) {
    engine.cancelJoinVoiceRoom()
  } else {
    await engine.leaveVoiceRoom()
  }
}

export const speakingParticipants = writable<CallParticipant[]>([])

export const participantMediaState = writable(new Map<string, ParticipantMediaState>())

export const mediaStateByIdentity = derived(
  [participantMediaState, currentCallSession, callMicMuted],
  ([$media, $session, $micMuted]) =>
    (liveKitIdentity: string) => {
      if ($session?.livekit.localParticipant.identity === liveKitIdentity) {
        return {muted: $micMuted, cameraOn: $session.cameraOn}
      }
      return $media.get(liveKitIdentity) ?? {muted: true, cameraOn: false}
    },
)

export const videoTrackRevision = writable(0)

export const triggerVideoTrackRevision = () => {
  videoTrackRevision.update(n => n + 1)
}
