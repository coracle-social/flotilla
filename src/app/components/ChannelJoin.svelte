<script lang="ts">
  import {hash, now, formatTimestampAsTime, formatTimestampAsDate} from "@welshman/lib"
  import type {TrustedEvent, EventContent} from "@welshman/util"
  import {thunks, deriveProfile, deriveProfileDisplay} from "@welshman/app"
  import {isMobile} from "@lib/html"
  import TapTarget from "@lib/components/TapTarget.svelte"
  import Avatar from "@lib/components/Avatar.svelte"
  import Button from "@lib/components/Button.svelte"
  import ThunkFailure from "@app/components/ThunkFailure.svelte"
  import ProfileDetail from "@app/components/ProfileDetail.svelte"
  import ReactionSummary from "@app/components/ReactionSummary.svelte"
  import ChannelMessageZapButton from "@app/components/ChannelMessageZapButton.svelte"
  import ChannelMessageEmojiButton from "@app/components/ChannelMessageEmojiButton.svelte"
  import ChannelMessageMenuButton from "@app/components/ChannelMessageMenuButton.svelte"
  import {colors, ENABLE_ZAPS} from "@app/core/state"
  import {publishDelete, publishReaction, canEnforceNip70} from "@app/core/commands"
  import {pushModal} from "@app/util/modal"

  interface Props {
    url: string
    event: TrustedEvent
    roomName?: string
    showPubkey?: boolean
  }

  const {url, event, roomName, showPubkey = false}: Props = $props()

  const thunk = $thunks[event.id]
  const shouldProtect = canEnforceNip70(url)
  const today = formatTimestampAsDate(now())
  const profile = deriveProfile(event.pubkey, [url])
  const profileDisplay = deriveProfileDisplay(event.pubkey, [url])
  const [_, colorValue] = colors[parseInt(hash(event.pubkey)) % colors.length]

  const openProfile = () => pushModal(ProfileDetail, {pubkey: event.pubkey, url})

  const deleteReaction = async (event: TrustedEvent) =>
    publishDelete({relays: [url], event, protect: await shouldProtect})

  const createReaction = async (template: EventContent) =>
    publishReaction({...template, event, relays: [url], protect: await shouldProtect})
</script>

<TapTarget
  onTap={null}
  data-event={event.id}
  class="group relative flex w-full cursor-default flex-col p-2 pb-3 text-left">
  <div class="flex w-full gap-3 overflow-auto">
    {#if showPubkey}
      <Button onclick={openProfile} class="flex items-start">
        <Avatar src={$profile?.picture} class="border border-solid border-base-content" size={8} />
      </Button>
    {:else}
      <div class="w-8 min-w-8 max-w-8"></div>
    {/if}
    <div class="min-w-0 flex-grow pr-1">
      {#if showPubkey}
        <div class="flex items-center gap-2">
          <Button onclick={openProfile} class="text-sm font-bold" style="color: {colorValue}">
            {$profileDisplay}
          </Button>
          <span class="text-xs opacity-50">
            {#if formatTimestampAsDate(event.created_at) === today}
              Today
            {:else}
              {formatTimestampAsDate(event.created_at)}
            {/if}
            at {formatTimestampAsTime(event.created_at)}
          </span>
        </div>
      {/if}
      <div class="text-sm">
        <span class="italic">{roomName ? `joined #${roomName}` : "joined the conversation"}</span>
        {#if thunk}
          <ThunkFailure showToastOnRetry {thunk} class="mt-2" />
        {/if}
      </div>
    </div>
  </div>
  <div class="row-2 ml-10 mt-1 pl-1">
    <ReactionSummary
      {url}
      {event}
      {deleteReaction}
      {createReaction}
      reactionClass="tooltip-right" />
  </div>
  {#if !isMobile}
    <button
      class="join absolute right-1 top-1 border border-solid border-neutral text-xs opacity-0 transition-all"
      class:group-hover:opacity-100={!isMobile}>
      {#if ENABLE_ZAPS}
        <ChannelMessageZapButton {url} {event} />
      {/if}
      <ChannelMessageEmojiButton {url} {event} />
      <ChannelMessageMenuButton {url} {event} />
    </button>
  {/if}
</TapTarget>
