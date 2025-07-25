<script lang="ts">
  import {hash, now, formatTimestampAsTime, formatTimestampAsDate} from "@welshman/lib"
  import type {TrustedEvent, EventContent} from "@welshman/util"
  import {thunks, deriveProfile, deriveProfileDisplay} from "@welshman/app"
  import {isMobile} from "@lib/html"
  import TapTarget from "@lib/components/TapTarget.svelte"
  import Avatar from "@lib/components/Avatar.svelte"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import Content from "@app/components/Content.svelte"
  import ThunkStatus from "@app/components/ThunkStatus.svelte"
  import ProfileDetail from "@app/components/ProfileDetail.svelte"
  import ReactionSummary from "@app/components/ReactionSummary.svelte"
  import ChannelMessageZapButton from "@app/components/ChannelMessageZapButton.svelte"
  import ChannelMessageEmojiButton from "@app/components/ChannelMessageEmojiButton.svelte"
  import ChannelMessageMenuButton from "@app/components/ChannelMessageMenuButton.svelte"
  import ChannelMessageMenuMobile from "@app/components/ChannelMessageMenuMobile.svelte"
  import {colors, ENABLE_ZAPS} from "@app/state"
  import {publishDelete, publishReaction} from "@app/commands"
  import {pushModal} from "@app/modal"

  interface Props {
    url: string
    event: TrustedEvent
    replyTo?: (event: TrustedEvent) => void
    showPubkey?: boolean
    inert?: boolean
  }

  const {url, event, replyTo = undefined, showPubkey = false, inert = false}: Props = $props()

  const thunk = $thunks[event.id]
  const today = formatTimestampAsDate(now())
  const profile = deriveProfile(event.pubkey, [url])
  const profileDisplay = deriveProfileDisplay(event.pubkey, [url])
  const [_, colorValue] = colors[parseInt(hash(event.pubkey)) % colors.length]

  const reply = () => replyTo!(event)

  const onTap = () => pushModal(ChannelMessageMenuMobile, {url, event, reply})

  const openProfile = () => pushModal(ProfileDetail, {pubkey: event.pubkey, url})

  const deleteReaction = (event: TrustedEvent) => publishDelete({relays: [url], event})

  const createReaction = (template: EventContent) =>
    publishReaction({...template, event, relays: [url]})
</script>

<TapTarget
  data-event={event.id}
  onTap={inert ? null : onTap}
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
        <Content minimalQuote {event} {url} />
        {#if thunk}
          <ThunkStatus {thunk} class="mt-2" />
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
      {#if replyTo}
        <Button class="btn join-item btn-xs" onclick={reply}>
          <Icon icon="reply" size={4} />
        </Button>
      {/if}
      <ChannelMessageMenuButton {url} {event} />
    </button>
  {/if}
</TapTarget>
