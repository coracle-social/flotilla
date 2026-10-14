import {derived} from "svelte/store"
import {first, uniqBy} from "@welshman/lib"
import {sortEventsDesc, tagSpec, tagValues} from "@welshman/util"
import {deriveDeduplicated} from "@welshman/store"
import {Events, makeRoomKey} from "@welshman/app"
import {fromApp} from "@app/core/app"
import {network} from "@app/core/plugins"
import {
  callTargetRoom,
  participantMediaState,
  speakingParticipants,
} from "@app/features/spaces/calls/state"

export const LIVEKIT_PARTICIPANTS = 39004

export type CallParticipant = {pubkey?: string; liveKitIdentity: string}

export const isParticipantSpeaking = derived(
  speakingParticipants,
  $participants => (p: CallParticipant) =>
    $participants.some(sp => participantKey(sp) === participantKey(p)),
)

export const loadCallParticipants = (url: string, h: string) =>
  network.get().load({
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
        fromApp(
          $app => $app.use(Events).forUrl(url, [{kinds: [LIVEKIT_PARTICIPANTS], "#d": [h]}]).$,
        ),
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
