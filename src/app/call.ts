import {derived, get, writable} from "svelte/store"
import {first, uniqBy} from "@welshman/lib"
import {sortEventsDesc, tagSpec, tagValues} from "@welshman/util"
import {deriveDeduplicated} from "@welshman/store"
import {makeRoomKey} from "@welshman/app"
import type {Room} from "@welshman/app"
import type {Room as LiveKitRoom} from "livekit-client"
import {events, network} from "@app/core"
import {getLivekitEndpoint} from "@app/relays"
import {getHttpAuthHeader} from "@app/signer"

export const LIVEKIT_PARTICIPANTS = 39004

export type CallSession = {
  url: string
  h: string
  livekit: LiveKitRoom
  cameraOn: boolean
  screenShareOn: boolean
}

/** Mic mute state is separate so toggling it does not re-render video tiles. */
export const callMicMuted = writable(true)

export type CallParticipant = {pubkey?: string; liveKitIdentity: string}

export type ParticipantMediaState = {
  muted: boolean
  cameraOn: boolean
}

export enum CallState {
  Joining = "joining",
  Connected = "connected",
  Disconnected = "disconnected",
}

export enum VideoCallLayout {
  Chat = "chat",
  Video = "video",
  Split = "split",
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
  const engine = await import("@app/callEngine")

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

export const isParticipantSpeaking = derived(
  speakingParticipants,
  $participants => (p: CallParticipant) =>
    $participants.some(sp => participantKey(sp) === participantKey(p)),
)

export const videoTrackRevision = writable(0)

export const triggerVideoTrackRevision = () => {
  videoTrackRevision.update(n => n + 1)
}

export const videoCallLayout = writable<VideoCallLayout>(VideoCallLayout.Split)

// Seen shares live here, not in the component, so a remount does not re-steal the spotlight.
type VideoSpotlight = {
  liveShareKeys: string[]
  primaryKey: string | undefined
}

const noSpotlight: VideoSpotlight = {liveShareKeys: [], primaryKey: undefined}

const videoSpotlight = writable<VideoSpotlight>(noSpotlight)

export const videoPrimaryTileKey = derived(videoSpotlight, $s => $s.primaryKey)

export const resetVideoCallLayout = () => {
  videoCallLayout.set(VideoCallLayout.Chat)
}

export const resetVideoSpotlight = () => {
  videoSpotlight.set(noSpotlight)
}

export const toggleVideoPrimaryTile = (key: string) => {
  videoSpotlight.update(s => ({...s, primaryKey: s.primaryKey === key ? undefined : key}))
}

export const syncVideoSpotlight = (tileKeys: string[], shareKeys: string[]) => {
  videoSpotlight.update(({liveShareKeys, primaryKey}) => {
    const started = shareKeys.filter(k => !liveShareKeys.includes(k))
    const live = [...liveShareKeys.filter(k => shareKeys.includes(k)), ...started]
    const spotlightLost = primaryKey !== undefined && !tileKeys.includes(primaryKey)

    return {
      liveShareKeys: live,
      primaryKey: started.length > 0 || spotlightLost ? live.at(-1) : primaryKey,
    }
  })
}

export const loadCallParticipants = (url: string, h: string) =>
  network.get().loadLenient({
    relays: [url],
    filters: [{kinds: [LIVEKIT_PARTICIPANTS], "#d": [h]}],
  })

export const deriveCallParticipants = (url: string, h: string) =>
  // We use the livekit identity list while in a call, and fall back to the list in kind 39004.
  derived(
    [
      participantMediaState,
      callTargetRoom,
      deriveDeduplicated(
        events.get().forUrl(url, [{kinds: [LIVEKIT_PARTICIPANTS], "#d": [h]}]).$,
        events => first(sortEventsDesc(events)),
      ),
    ],
    ([$participantMediaState, $callTargetRoom, $publishedParticipantList]) => {
      const inCall = $participantMediaState.size > 0 && $callTargetRoom?.id === makeRoomKey(url, h)

      const identities = inCall
        ? [...$participantMediaState.keys()]
        : tagValues(tagSpec("participant"), $publishedParticipantList?.tags ?? [])

      return uniqBy(
        (p: CallParticipant) => participantKey(p),
        identities.map(participantFromLiveKitIdentity),
      )
    },
  )

export const pubkeyFromLiveKitIdentity = (liveKitIdentity: string): string | undefined =>
  /^[a-f0-9]{64}$/.test(liveKitIdentity.slice(0, 64)) ? liveKitIdentity.slice(0, 64) : undefined

export const participantFromLiveKitIdentity = (liveKitIdentity: string): CallParticipant => {
  const pk = pubkeyFromLiveKitIdentity(liveKitIdentity)
  return pk ? {pubkey: pk, liveKitIdentity} : {liveKitIdentity}
}

export const participantKey = (p: CallParticipant) => p.pubkey ?? p.liveKitIdentity

export const fetchLivekitToken = async (
  url: string,
  roomId: string,
  signal?: AbortSignal,
): Promise<{server_url: string; participant_token: string}> => {
  const endpoint = getLivekitEndpoint(url, roomId)

  if (signal?.aborted) {
    throw new DOMException("Aborted", "AbortError")
  }

  const response = await fetch(endpoint, {
    headers: {Authorization: await getHttpAuthHeader(endpoint)},
    signal,
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Token request failed (${response.status}): ${text}`)
  }

  return response.json()
}
