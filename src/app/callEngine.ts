/**
 * Voice rooms via LiveKit. Note: Voice does not work on localhost in Firefox
 * (ICE candidate gathering fails). Use Chrome or test from deployed HTTPS.
 */
import {
  DisconnectReason,
  Room as LiveKitRoom,
  RoomEvent,
  Track,
  type AudioCaptureOptions,
  type LocalParticipant,
  type LocalTrackPublication,
  type Participant,
  type TrackPublication,
} from "livekit-client"
import {App} from "@capacitor/app"
import type {PluginListenerHandle} from "@capacitor/core"
import {get} from "svelte/store"
import {not, nthEq, reject} from "@welshman/lib"
import {makeHttpAuth, makeHttpAuthHeader} from "@welshman/util"
import {makeRoomKey} from "@welshman/app"
import {getLivekitEndpoint} from "$lib/livekit"
import {AbortError, TimeoutError, whenAborted, whenTimeout} from "$lib/util"
import {user} from "@app/core"
import {pushToast} from "@app/toast"
import {
  CallState,
  DeviceKind,
  callMicMuted,
  callState,
  callTargetRoom,
  currentCallSession,
  participantFromLiveKitIdentity,
  participantMediaState,
  resetVideoCallLayout,
  speakingParticipants,
  triggerVideoTrackRevision,
  videoPrimaryTileKey,
  type ParticipantMediaState,
} from "@app/call"

const LIVEKIT_DEFAULT_DEVICE_ID = "default"
const RECONNECT_DELAYS = [1000, 2000, 4000, 8000, 16000]

export const joinVoiceRoom = async (
  url: string,
  h: string,
  startMuted = true,
  preferredMicId?: string,
): Promise<void> => {
  abortJoinVoiceRoom()

  callTargetRoom.set({url, h, id: makeRoomKey(url, h)})
  callState.set(CallState.Joining)

  const controller = new AbortController()
  joinAbortController = controller
  const signal = controller.signal
  const isActive = () => joinAbortController === controller

  // Self-cleaning controller: aborted in finally so whenTimeout/whenAborted
  // helpers clear their timers/listeners once the races below have settled.
  const settle = new AbortController()

  try {
    // Tear down any existing session before joining. Bound it so a slow leave
    // (camera/screenshare renegotiation can take ~15s) cannot block this join.
    if (get(currentCallSession)) {
      await Promise.race([
        leaveVoiceRoom(),
        whenTimeout(15_000, {message: "Leaving previous call timed out.", signal: settle.signal}),
        whenAborted(signal),
      ]).catch(e => {
        if (e instanceof AbortError) throw e
      })

      // leaveVoiceRoom flips callState to Disconnected; re-assert Joining.
      callState.set(CallState.Joining)
    }

    if (signal.aborted) throw new AbortError()

    const {server_url, participant_token} = await Promise.race([
      fetchLivekitToken(url, h, signal),
      whenTimeout(15_000, {
        message: "Connection timed out. Please check your network and try again.",
        signal: settle.signal,
      }),
      whenAborted(signal),
    ])

    if (signal.aborted) throw new AbortError()

    const liveKitRoom = new LiveKitRoom({adaptiveStream: true, dynacast: true})
    activeRoom = liveKitRoom

    liveKitRoom.on(RoomEvent.Disconnected, makeOnRoomDisconnected(liveKitRoom))
    liveKitRoom.on(RoomEvent.Reconnected, makeOnRoomReconnected(liveKitRoom))
    liveKitRoom.on(RoomEvent.ParticipantConnected, onParticipantConnected)
    liveKitRoom.on(RoomEvent.ParticipantDisconnected, onParticipantDisconnected)
    liveKitRoom.on(RoomEvent.TrackSubscribed, onTrackSubscribed)
    liveKitRoom.on(RoomEvent.TrackUnsubscribed, onTrackUnsubscribed)
    liveKitRoom.on(RoomEvent.LocalTrackUnpublished, onLocalTrackUnpublished)
    liveKitRoom.on(RoomEvent.ActiveSpeakersChanged, onActiveSpeakersChanged)
    liveKitRoom.on(RoomEvent.TrackMuted, onParticipantMediaChanged)
    liveKitRoom.on(RoomEvent.TrackUnmuted, onParticipantMediaChanged)
    liveKitRoom.on(RoomEvent.TrackPublished, onParticipantMediaChanged)
    liveKitRoom.on(RoomEvent.TrackUnpublished, onParticipantMediaChanged)
    liveKitRoom.on(RoomEvent.LocalTrackPublished, onParticipantMediaChanged)

    try {
      await Promise.race([
        liveKitRoom.connect(server_url, participant_token, {maxRetries: 0}),
        whenTimeout(15_000, {
          message: "Connection timed out. Please check your network and try again.",
          signal: settle.signal,
        }),
        whenAborted(signal),
      ])
    } catch (e) {
      teardownRoom(liveKitRoom)
      throw e
    }

    participantMediaState.set(new Map())
    syncParticipantMedia(liveKitRoom.localParticipant)
    for (const p of liveKitRoom.remoteParticipants.values()) {
      syncParticipantMedia(p)
    }

    // Bounded against timeout/abort inside setUpMicrophone: a stuck permission
    // prompt resolves to muted rather than hanging the join forever.
    const muted = await setUpMicrophone(
      startMuted,
      preferredMicId,
      liveKitRoom.localParticipant,
      signal,
      settle.signal,
    )

    // A cancel during the mic step must tear down the connected room rather
    // than leaking it.
    if (signal.aborted) {
      teardownRoom(liveKitRoom)
      throw new AbortError()
    }

    callMicMuted.set(muted)
    currentCallSession.set({
      url,
      h,
      livekit: liveKitRoom,
      cameraOn: false,
      screenShareOn: false,
    })
    callState.set(CallState.Connected)
    clearReconnectSchedule()
    playJoinSound()
  } catch (e) {
    if (isActive()) callState.set(CallState.Disconnected)
    if (e instanceof AbortError) {
      clearReconnectSchedule()
      return
    }
    throw e
  } finally {
    settle.abort()
    if (isActive()) joinAbortController = undefined
  }
}

export const leaveVoiceRoom = async () => {
  clearReconnectSchedule()
  const session = get(currentCallSession)
  if (!session) return

  const audio = new Audio("/leave-voice-room.mp3")
  audio.play().catch(() => {})

  if (session.cameraOn) {
    try {
      await session.livekit.localParticipant.setCameraEnabled(false)
    } catch {
      pushToast({theme: "error", message: "Error turning off camera."})
    }
  }

  if (session.screenShareOn) {
    try {
      await session.livekit.localParticipant.setScreenShareEnabled(false)
    } catch {
      pushToast({theme: "error", message: "Error turning off screen sharing."})
    }
  }

  // Always tear down this room's connection and listeners.
  teardownRoom(session.livekit)

  // Only reset shared UI state if this session is still current. A slow leave
  // that was superseded by a new join (bounded by a timeout in joinVoiceRoom)
  // must not clobber the freshly-joined session when it finally completes.
  //
  // Compare the LiveKit room rather than the session object: turning off the
  // screen share above emits LocalTrackUnpublished, whose handler replaces the
  // store value with a new object for the same call. An identity check would
  // fail there and leave the UI stuck in a connected state.
  if (get(currentCallSession)?.livekit === session.livekit) {
    callState.set(CallState.Disconnected)
    callMicMuted.set(true)
    currentCallSession.set(undefined)
    speakingParticipants.set([])
    participantMediaState.set(new Map())
  }
}

export const cancelJoinVoiceRoom = () => {
  clearReconnectSchedule()
  abortJoinVoiceRoom()
}

export const toggleMute = async () => {
  const session = get(currentCallSession)
  if (!session) return

  callMicMuted.update(not)

  const muted = get(callMicMuted)
  try {
    await session.livekit.localParticipant.setMicrophoneEnabled(!muted)
  } catch {
    callMicMuted.set(!muted)
    pushToast({
      theme: "error",
      message: muted ? "Could not mute microphone" : "Could not access microphone",
    })
  }
}

export const toggleCamera = async () => {
  const session = get(currentCallSession)
  if (!session) return

  const cameraOn = !session.cameraOn
  try {
    await session.livekit.localParticipant.setCameraEnabled(cameraOn)
    currentCallSession.update(s => s && {...s, cameraOn})
  } catch {
    pushToast({
      theme: "error",
      message: cameraOn ? "Could not access camera" : "Could not turn off camera",
    })
  }
}

export const toggleScreenShare = async () => {
  const session = get(currentCallSession)
  if (!session) return

  const screenShareOn = !session.screenShareOn
  try {
    await session.livekit.localParticipant.setScreenShareEnabled(screenShareOn)
    currentCallSession.update(s => s && {...s, screenShareOn})
  } catch {
    pushToast({
      theme: "error",
      message: screenShareOn ? "Could not start screen sharing" : "Could not stop screen sharing",
    })
  }
}

export const switchCallActiveDevice = async (
  kind: DeviceKind,
  targetDeviceId: string,
): Promise<void> => {
  const session = get(currentCallSession)
  if (!session) return
  const id = targetDeviceId === "" ? LIVEKIT_DEFAULT_DEVICE_ID : targetDeviceId
  try {
    await session.livekit.switchActiveDevice(kind, id)
  } catch {
    let label: string
    switch (kind) {
      case DeviceKind.AudioInput:
        label = "microphone"
        break
      case DeviceKind.AudioOutput:
        label = "speaker"
        break
      case DeviceKind.VideoInput:
        label = "camera"
        break
    }
    pushToast({theme: "error", message: `Error changing ${label}`})
  }
}

// The room whose events are allowed to mutate shared state. Abandoned rooms
// (after switching calls or an engine reconnect give-up) must not clobber it.
let activeRoom: LiveKitRoom | undefined
let reconnectTimeout: ReturnType<typeof setTimeout> | undefined
let reconnectAttempt = 0
// Captured from the dropped session so a full rejoin (as opposed to LiveKit's
// own internal reconnect, which reuses the existing tracks) restores the
// user's mic state instead of always rejoining muted.
let reconnectMicMuted = true
let reconnectMicDeviceId: string | undefined
let joinAbortController: AbortController | undefined
let hadCallSession = false
let audioResumeListener: Promise<PluginListenerHandle> | undefined

/**
 * On mobile, locking the screen can suspend microphone capture without ever
 * ending the underlying MediaStreamTrack: the local participant still looks
 * connected and unmuted, but publishes silence until the track is manually
 * reacquired. LiveKit only guards against this for tracks attached to a DOM
 * element (i.e. video), so the mic needs the same treatment on foreground
 * return. `App.addListener("appStateChange", ...)` fires from Capacitor's web
 * fallback too, so this covers both native and browser tabs.
 */
currentCallSession.subscribe(session => {
  if (session) {
    hadCallSession = true
    audioResumeListener ??= App.addListener("appStateChange", ({isActive}) => {
      if (isActive) void reacquireMicrophoneIfNeeded()
    })
    return
  }
  if (!hadCallSession) return
  hadCallSession = false
  void audioResumeListener?.then(l => l.remove())
  audioResumeListener = undefined
  videoPrimaryTileKey.set(undefined)
  resetVideoCallLayout()
})

const teardownRoom = (livekit: LiveKitRoom) => {
  if (activeRoom === livekit) activeRoom = undefined

  // Dropping the listeners keeps TrackUnsubscribed from removing the hidden
  // audio elements onTrackSubscribed appended, so detach them here instead.
  for (const participant of livekit.remoteParticipants.values()) {
    for (const publication of participant.audioTrackPublications.values()) {
      publication.track?.detach().forEach(el => el.remove())
    }
  }

  livekit.removeAllListeners()
  livekit.disconnect()
}

const participantMediaFrom = (participant: Participant): ParticipantMediaState => ({
  muted: !participant.isMicrophoneEnabled,
  cameraOn: participant.isCameraEnabled,
})

const deleteParticipant = (liveKitIdentity: string) => {
  participantMediaState.update(m => new Map(reject(nthEq(0, liveKitIdentity), [...m])))
}

const syncParticipantMedia = (participant: Participant) => {
  const state = participantMediaFrom(participant)
  participantMediaState.update(m => {
    const prev = m.get(participant.identity)
    if (prev?.muted === state.muted && prev?.cameraOn === state.cameraOn) return m
    const next = new Map(m)
    next.set(participant.identity, state)
    return next
  })
}

// LiveKit does not emit ParticipantConnected/Disconnected during reconnect.
const resyncAfterReconnect = (livekit: LiveKitRoom) => {
  if (livekit !== activeRoom) return

  const next = new Map<string, ParticipantMediaState>()
  for (const p of [livekit.localParticipant, ...livekit.remoteParticipants.values()]) {
    next.set(p.identity, participantMediaFrom(p))
  }
  participantMediaState.set(next)

  const session = get(currentCallSession)
  if (!session) return

  const {localParticipant} = livekit
  callMicMuted.set(!localParticipant.isMicrophoneEnabled)
  currentCallSession.set({
    ...session,
    cameraOn: localParticipant.isCameraEnabled,
    screenShareOn: localParticipant.isScreenShareEnabled,
  })
  triggerVideoTrackRevision()
}

const fetchLivekitToken = async (
  url: string,
  roomId: string,
  signal?: AbortSignal,
): Promise<{server_url: string; participant_token: string}> => {
  const endpoint = getLivekitEndpoint(url, roomId)

  if (signal?.aborted) throw new DOMException("Aborted", "AbortError")

  const template = await makeHttpAuth(endpoint, "GET")
  const signedEvent = await user.get().signer.sign(template)
  const authHeader = makeHttpAuthHeader(signedEvent)

  const response = await fetch(endpoint, {
    headers: {Authorization: authHeader},
    signal,
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Token request failed (${response.status}): ${text}`)
  }

  return response.json()
}

const setUpMicrophone = async (
  startMuted: boolean,
  preferredMicId: string | undefined,
  participant: LocalParticipant,
  signal?: AbortSignal,
  settleSignal?: AbortSignal,
): Promise<boolean> => {
  if (startMuted) {
    return true
  }

  let muted = true
  let capture: AudioCaptureOptions | undefined = undefined
  if (preferredMicId) {
    capture = {deviceId: preferredMicId}
  }
  try {
    await Promise.race([
      participant.setMicrophoneEnabled(true, capture),
      whenTimeout(15_000, {message: "Microphone access timed out.", signal: settleSignal}),
      whenAborted(signal),
    ])
    muted = false
  } catch (e) {
    // Timeout or microphone rejection: join muted, the call is still usable. A
    // genuine abort is surfaced to the caller so it can tear down the room.
    if (e instanceof AbortError) throw e
    if (!(e instanceof TimeoutError)) {
      pushToast({theme: "error", message: "Could not access microphone"})
    }
  }
  return muted
}

const reacquireMicrophoneIfNeeded = async () => {
  const session = get(currentCallSession)
  if (!session || get(callMicMuted)) return

  const track = session.livekit.localParticipant.getTrackPublication(
    Track.Source.Microphone,
  )?.audioTrack
  if (!track || track.isMuted || track.isUserProvided) return

  // Mirrors LiveKit's own (mobile-only, video-track-only) reacquisition
  // check: a capture device that died silently still reports readyState
  // "live", but the browser flips `muted`/`enabled` on the underlying
  // MediaStreamTrack. Checking for actual silence instead would false-
  // positive any time the user simply isn't talking.
  const {mediaStreamTrack} = track
  const needsReacquisition =
    mediaStreamTrack.readyState !== "live" || mediaStreamTrack.muted || !mediaStreamTrack.enabled
  if (!needsReacquisition) return

  try {
    await track.restartTrack()
  } catch {
    // Best-effort: the user can still recover via mute/unmute or by
    // rejoining if reacquiring the mic fails here.
  }
}

const clearReconnectSchedule = () => {
  if (reconnectTimeout !== undefined) {
    clearTimeout(reconnectTimeout)
    reconnectTimeout = undefined
  }
  reconnectAttempt = 0
}

const attemptReconnect = async () => {
  const target = get(callTargetRoom)
  if (!target) return

  try {
    await joinVoiceRoom(target.url, target.h, reconnectMicMuted, reconnectMicDeviceId)
  } catch {
    if (reconnectAttempt >= RECONNECT_DELAYS.length) {
      pushToast({theme: "error", message: "Voice connection lost."})
      clearReconnectSchedule()
      return
    }
    scheduleReconnect()
  }
}

const scheduleReconnect = () => {
  if (reconnectTimeout !== undefined) return
  if (!get(callTargetRoom)) return
  if (reconnectAttempt >= RECONNECT_DELAYS.length) {
    pushToast({theme: "error", message: "Voice connection lost."})
    return
  }

  const delay = RECONNECT_DELAYS[reconnectAttempt]!
  reconnectAttempt++
  reconnectTimeout = setTimeout(() => {
    reconnectTimeout = undefined
    void attemptReconnect()
  }, delay)
}

const makeOnRoomReconnected = (livekit: LiveKitRoom) => () => {
  if (livekit !== activeRoom) return
  resyncAfterReconnect(livekit)
}

const makeOnRoomDisconnected = (livekit: LiveKitRoom) => (reason?: DisconnectReason) => {
  // Ignore disconnects from rooms that are no longer the active session.
  if (livekit !== activeRoom) return

  // Livekit unsubscribes remote tracks before emitting Disconnected, so
  // onTrackUnsubscribed has already removed their audio elements by now.
  activeRoom = undefined
  livekit.removeAllListeners()

  // Capture mic state before resetting it, so a subsequent full rejoin (see
  // scheduleReconnect/attemptReconnect below) can restore it instead of
  // silently coming back muted regardless of what the user had set.
  reconnectMicMuted = get(callMicMuted)
  reconnectMicDeviceId = livekit.getActiveDevice(DeviceKind.AudioInput)

  callMicMuted.set(true)
  currentCallSession.set(undefined)
  if (reason !== undefined && reason !== DisconnectReason.CLIENT_INITIATED) {
    callState.set(CallState.Disconnected)
    if (reason === DisconnectReason.JOIN_FAILURE) {
      pushToast({theme: "error", message: "Could not connect to voice room. Please try again."})
    } else if (get(callTargetRoom)) {
      clearReconnectSchedule()
      scheduleReconnect()
    } else {
      pushToast({theme: "error", message: "Voice connection lost."})
    }
  }
  speakingParticipants.set([])
  participantMediaState.set(new Map())
}

const onParticipantMediaChanged = (_publication: TrackPublication, participant: Participant) => {
  syncParticipantMedia(participant)
}

const onTrackSubscribed = (track: Track) => {
  if (track.kind === Track.Kind.Audio) {
    const element = track.attach()
    element.style.display = "none"
    document.body.appendChild(element)
    element.play().catch(() => {})
  } else if (track.kind === Track.Kind.Video) {
    triggerVideoTrackRevision()
  }
}

const onTrackUnsubscribed = (track: Track) => {
  track.detach().forEach(el => el.remove())
  if (track.kind === Track.Kind.Video) {
    triggerVideoTrackRevision()
  }
}

const onActiveSpeakersChanged = (participants: {identity: string}[]) => {
  speakingParticipants.set(participants.map(p => participantFromLiveKitIdentity(p.identity)))
}

const playJoinSound = () => {
  const audio = new Audio("/join-voice-room.mp3")
  audio.play().catch(() => {})
}

const onParticipantConnected = (participant: Participant) => {
  syncParticipantMedia(participant)
  playJoinSound()
}

const onParticipantDisconnected = (participant: {identity: string}) => {
  deleteParticipant(participant.identity)
}

const onLocalTrackUnpublished = (
  publication: LocalTrackPublication,
  participant: LocalParticipant,
) => {
  if (publication.source !== Track.Source.ScreenShare) return
  const session = get(currentCallSession)
  if (!session || participant.identity !== session.livekit.localParticipant.identity) return
  if (!session.screenShareOn) return
  currentCallSession.set({...session, screenShareOn: false})
}

const abortJoinVoiceRoom = () => {
  joinAbortController?.abort()
}
