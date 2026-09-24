import {derived, get, writable} from "svelte/store"
import {first, uniqBy} from "@welshman/lib"
import {sortEventsDesc, tagSpec, tagValues} from "@welshman/util"
import {deriveDeduplicated} from "@welshman/store"
import {makeRoomKey} from "@welshman/app"
import type {Room} from "@welshman/app"
import type {Room as LiveKitRoom} from "livekit-client"
import {network} from "@app/core"
import {deriveEventsForUrl} from "@app/repository"

export const LIVEKIT_PARTICIPANTS = 39004

/** The lower aspect bound is 1:1 on landscape and 3:4 on portrait, and the upper is 16:9. */
const TILE_ASPECT_PORTRAIT = 3 / 4
const TILE_ASPECT_LANDSCAPE = 16 / 9
const TILE_GAP = 8

/** Below this the grid scrolls rather than forcing portrait tiles, which is ~6-8 tiles on a portrait phone. */
const MIN_TILE_HEIGHT = 120

export type TileRow = {
  columnCount: number
  tileWidth: number
  tileHeight: number
  /** Total width of this row including gaps — for the template's max-width */
  rowWidth: number
  aspectRatio: number
}

/** All tiles share one size. Full rows fill the container width and a partial row is centered. */
export type AdaptiveTileGrid = {
  rows: TileRow[]
  totalWidth: number
  totalHeight: number
}

/** Score for comparing candidate layouts. Lower is better. */
type LayoutScore = {
  /** Penalty for vertical overflow: 0 if none, else huge */
  verticalOverflowPenalty: number
  /** Penalty for horizontal overflow: 0 if none, else huge */
  horizontalOverflowPenalty: number
  /** Penalty when tiles fall below MIN_TILE_HEIGHT even while fitting */
  minTileHeightPenalty: number
  /** Negative tile area (we want to maximize area, so negate) */
  negativeArea: number
  /** Leftover whitespace (underflow) in px */
  whitespace: number
  /** Average absolute deviation from 16:9 across all tiles */
  aspectDeviation: number
}

const compareScores = (a: LayoutScore, b: LayoutScore): number => {
  const fields: (keyof LayoutScore)[] = [
    "verticalOverflowPenalty",
    "horizontalOverflowPenalty",
    "minTileHeightPenalty",
    "negativeArea",
    "whitespace",
    "aspectDeviation",
  ]
  for (const field of fields) {
    if (a[field] !== b[field]) {
      return a[field] - b[field]
    }
  }
  return 0
}

/** The largest tile that fits, shrunk to whichever dimension is more constraining. */
const fitTile = (availWidth: number, availHeight: number, minAspect: number) => {
  const fillAspect = availWidth / availHeight
  const aspectRatio = Math.max(minAspect, Math.min(TILE_ASPECT_LANDSCAPE, fillAspect))
  if (fillAspect >= aspectRatio) {
    const tileWidth = availHeight * aspectRatio
    return {tileWidth, tileHeight: availHeight, aspectRatio}
  }
  const tileHeight = availWidth / aspectRatio
  return {tileWidth: availWidth, tileHeight, aspectRatio}
}

/** A candidate grid for a given column count, with the partial last row centered. */
const buildCandidate = (
  tileCount: number,
  columnCount: number,
  containerWidth: number,
  containerHeight: number,
  minAspect: number,
): AdaptiveTileGrid | undefined => {
  const gap = TILE_GAP
  const fullRowCount = Math.floor(tileCount / columnCount)
  const remainder = tileCount % columnCount
  const totalRowCount = fullRowCount + (remainder > 0 ? 1 : 0)

  const availHeight = (containerHeight - (totalRowCount - 1) * gap) / totalRowCount
  const availWidth = (containerWidth - (columnCount - 1) * gap) / columnCount
  if (availWidth <= 0 || availHeight <= 0) {
    return undefined
  }

  const {tileWidth, tileHeight, aspectRatio} = fitTile(availWidth, availHeight, minAspect)

  const rows: TileRow[] = []
  for (let r = 0; r < fullRowCount; r++) {
    rows.push({
      columnCount,
      tileWidth,
      tileHeight,
      rowWidth: columnCount * tileWidth + (columnCount - 1) * gap,
      aspectRatio,
    })
  }
  if (remainder > 0) {
    rows.push({
      columnCount: remainder,
      tileWidth,
      tileHeight,
      rowWidth: remainder * tileWidth + (remainder - 1) * gap,
      aspectRatio,
    })
  }

  const totalHeight = totalRowCount * tileHeight + (totalRowCount - 1) * gap
  const totalWidth = columnCount * tileWidth + (columnCount - 1) * gap

  return {rows, totalWidth, totalHeight}
}

/** Scored on overflow first, then whitespace, then distance from 16:9, then tile size. */
export const computeAdaptiveGrid = (
  tileCount: number,
  containerWidth: number,
  containerHeight: number,
): AdaptiveTileGrid | undefined => {
  if (tileCount <= 0 || containerWidth <= 0 || containerHeight <= 0) {
    return undefined
  }

  const minAspect = containerWidth / containerHeight >= 4 / 3 ? 1 : TILE_ASPECT_PORTRAIT

  let best: AdaptiveTileGrid | undefined
  let bestScore: LayoutScore | undefined

  for (let columnCount = 1; columnCount <= tileCount; columnCount++) {
    const candidate = buildCandidate(
      tileCount,
      columnCount,
      containerWidth,
      containerHeight,
      minAspect,
    )
    if (!candidate) {
      continue
    }

    const {tileWidth, tileHeight, aspectRatio} = candidate.rows[0]
    const verticalOverflow = Math.max(0, candidate.totalHeight - containerHeight)
    const horizontalOverflow = Math.max(0, candidate.totalWidth - containerWidth)
    const whitespace =
      Math.max(0, containerWidth - candidate.totalWidth) +
      Math.max(0, containerHeight - candidate.totalHeight)
    const totalArea = tileWidth * tileHeight * tileCount

    const overflowPenaltyMultiplier = tileHeight >= MIN_TILE_HEIGHT ? 1_000_000 : 1
    const verticalOverflowPenalty = verticalOverflow * overflowPenaltyMultiplier
    const horizontalOverflowPenalty = horizontalOverflow * overflowPenaltyMultiplier
    const minTileHeightPenalty =
      tileHeight < MIN_TILE_HEIGHT ? (MIN_TILE_HEIGHT - tileHeight) * 1000 : 0

    const score: LayoutScore = {
      verticalOverflowPenalty,
      horizontalOverflowPenalty,
      minTileHeightPenalty,
      negativeArea: -totalArea,
      whitespace,
      aspectDeviation: Math.abs(aspectRatio - TILE_ASPECT_LANDSCAPE),
    }

    if (!bestScore || compareScores(score, bestScore) < 0) {
      bestScore = score
      best = candidate
    }
  }

  return best
}

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

export const videoPrimaryTileKey = writable<string | undefined>(undefined)

export const resetVideoCallLayout = () => {
  videoCallLayout.set(VideoCallLayout.Chat)
}

export const toggleVideoPrimaryTile = (key: string) => {
  videoPrimaryTileKey.update(k => (k === key ? undefined : key))
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
        deriveEventsForUrl(url, [{kinds: [LIVEKIT_PARTICIPANTS], "#d": [h]}]),
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
