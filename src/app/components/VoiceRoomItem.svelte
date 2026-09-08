<script lang="ts">
  import cx from "classnames"
  import {makeRoomKey} from "@welshman/app"
  import SecondaryNavItem from "@lib/components/SecondaryNavItem.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import ProfileCircle from "@app/components/ProfileCircle.svelte"
  import ProfileName from "@app/components/ProfileName.svelte"
  import ProfileCircles from "@app/components/ProfileCircles.svelte"
  import RoomImage from "@app/components/RoomImage.svelte"
  import RoomName from "@app/components/RoomName.svelte"
  import {makeRoomPath} from "@app/routes"
  import {navigate, pushModal} from "@app/modal"
  import VoiceRoomJoinDialog from "@app/components/VoiceRoomJoinDialog.svelte"
  import VoiceParticipantMediaBadges from "@app/components/VoiceParticipantMediaBadges.svelte"
  import {
    CallState,
    callTargetRoom,
    isParticipantSpeaking,
    mediaStateByIdentity,
    participantKey,
    callState,
    deriveCallParticipants,
    loadCallParticipants,
    type CallParticipant,
  } from "@app/call"
  import {cancelJoinVoiceRoom} from "@app/callEngine"
  import {profiles} from "@app/core"

  interface Props {
    url: string
    h: string
    notification?: boolean
  }

  const {url, h, notification = false}: Props = $props()

  // Beyond this many participants, a full name+avatar row per person makes the
  // sidebar item too tall — fall back to the compact ProfileCircles cluster instead.
  const ACTIVE_LIST_MAX = 5

  const participants = deriveCallParticipants(url, h)
  const participantPubkeys = $derived($participants.flatMap(p => (p.pubkey ? [p.pubkey] : [])))
  const isActive = $derived(
    $callState === CallState.Connected && $callTargetRoom?.id === makeRoomKey(url, h),
  )
  const isJoining = $derived(
    $callState === CallState.Joining && $callTargetRoom?.id === makeRoomKey(url, h),
  )

  const handleClick = async (e: MouseEvent) => {
    if (isActive) return

    if (isJoining) {
      e.preventDefault()
      cancelJoinVoiceRoom()
      return
    }

    e.preventDefault()
    await navigate(makeRoomPath(url, h))
    pushModal(VoiceRoomJoinDialog, {url, h})
  }

  $effect(() => {
    void loadCallParticipants(url, h)
  })

  $effect(() => {
    for (const p of $participants) {
      if (p.pubkey) $profiles.load(p.pubkey, [url])
    }
  })
</script>

<SecondaryNavItem
  href={makeRoomPath(url, h)}
  {notification}
  onclick={handleClick}
  class={cx("items-start!", isActive && "bg-surface! text-content!")}>
  <div class="flex w-full min-w-0 flex-col gap-2">
    <div class="flex gap-2 items-center">
      {#if isJoining}
        <Spinner size="sm" />
      {:else}
        <RoomImage {url} {h} size={4} />
      {/if}
      <RoomName {url} {h} />
    </div>
    {#if participantPubkeys.length > 0}
      {#if isActive && $participants.length <= ACTIVE_LIST_MAX}
        {#each $participants as p (participantKey(p as CallParticipant))}
          {@const media = $mediaStateByIdentity(p.liveKitIdentity)}
          <div class="flex items-center gap-2 ml-6">
            <div
              class={cx(
                "inline-flex shrink-0 items-center justify-center rounded-full transition-shadow",
                $isParticipantSpeaking(p) && "ring-2",
              )}
              style={$isParticipantSpeaking(p) ? "--tw-ring-color: var(--success)" : undefined}>
              <ProfileCircle pubkey={p.pubkey} size={5} class="h-5 w-5" />
            </div>
            <span class="truncate min-w-0 flex-1 text-xs opacity-70">
              {#if p.pubkey}
                <ProfileName pubkey={p.pubkey} {url} />
              {:else}
                Unknown
              {/if}
            </span>
            <VoiceParticipantMediaBadges
              muted={media.muted}
              cameraOn={media.cameraOn}
              size={3}
              class="shrink-0" />
          </div>
        {/each}
      {:else}
        <div class="ml-6">
          <ProfileCircles pubkeys={participantPubkeys} size={5} limit={3} />
        </div>
      {/if}
    {/if}
  </div>
</SecondaryNavItem>
