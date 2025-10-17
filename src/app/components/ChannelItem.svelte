<script lang="ts">
  import cx from "classnames"
  import {hash, now, displayList, formatTimestampAsTime, formatTimestampAsDate} from "@welshman/lib"
  import type {TrustedEvent, EventContent} from "@welshman/util"
  import {MESSAGE, COMMENT} from "@welshman/util"
  import {
    thunks,
    pubkey,
    mergeThunks,
    deriveProfile,
    deriveProfileDisplay,
    displayProfileByPubkey,
  } from "@welshman/app"
  import {isMobile} from "@lib/html"
  import Pen from "@assets/icons/pen.svg?dataurl"
  import Reply from "@assets/icons/reply-2.svg?dataurl"
  import ReplyAlt from "@assets/icons/reply.svg?dataurl"
  import TapTarget from "@lib/components/TapTarget.svelte"
  import Avatar from "@lib/components/Avatar.svelte"
  import Icon from "@lib/components/Icon.svelte"
  import Link from "@lib/components/Link.svelte"
  import Button from "@lib/components/Button.svelte"
  import ThunkFailure from "@app/components/ThunkFailure.svelte"
  import ProfileDetail from "@app/components/ProfileDetail.svelte"
  import ReactionSummary from "@app/components/ReactionSummary.svelte"
  import ChannelItemZapButton from "@app/components/ChannelItemZapButton.svelte"
  import ChannelItemEmojiButton from "@app/components/ChannelItemEmojiButton.svelte"
  import ChannelItemMenuButton from "@app/components/ChannelItemMenuButton.svelte"
  import ChannelItemMenuMobile from "@app/components/ChannelItemMenuMobile.svelte"
  import ChannelItemContent from "@app/components/ChannelItemContent.svelte"
  import {colors, ENABLE_ZAPS, deriveEventsForUrl} from "@app/core/state"
  import {publishDelete, publishReaction, canEnforceNip70} from "@app/core/commands"
  import {getChannelItemPath} from "@app/util/routes"
  import {pushModal} from "@app/util/modal"

  interface Props {
    url: string
    event: TrustedEvent
    replyTo?: (event: TrustedEvent) => void
    showPubkey?: boolean
    inert?: boolean
    canEdit: (event: TrustedEvent) => boolean
    onEdit: (event: TrustedEvent) => void
  }

  const {
    url,
    event,
    replyTo = undefined,
    showPubkey = false,
    inert = false,
    canEdit,
    onEdit,
  }: Props = $props()

  const path = getChannelItemPath(url, event)
  const shouldProtect = canEnforceNip70(url)
  const today = formatTimestampAsDate(now())
  const profile = deriveProfile(event.pubkey, [url])
  const profileDisplay = deriveProfileDisplay(event.pubkey, [url])
  const thunk = mergeThunks($thunks.filter(t => t.event.id === event.id))
  const [_, colorValue] = colors[parseInt(hash(event.pubkey)) % colors.length]
  const comments = deriveEventsForUrl(url, [{kinds: [COMMENT], "#e": [event.id]}])

  const reply = () => replyTo!(event)
  const edit = canEdit(event) ? () => onEdit(event) : undefined

  const onTap = () => pushModal(ChannelItemMenuMobile, {url, event, reply, edit})

  const openProfile = () => pushModal(ProfileDetail, {pubkey: event.pubkey, url})

  const deleteReaction = async (event: TrustedEvent) =>
    publishDelete({relays: [url], event, protect: await shouldProtect})

  const createReaction = async (template: EventContent) =>
    publishReaction({...template, event, relays: [url], protect: await shouldProtect})
</script>

<TapTarget
  data-event={event.id}
  onTap={inert ? null : onTap}
  class="group relative flex w-full cursor-default flex-col p-2 pb-3 text-left hover:bg-base-100/50">
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
      <div class:mt-2={showPubkey && event.kind !== MESSAGE}>
        <ChannelItemContent {url} {event} />
        {#if thunk}
          <ThunkFailure showToastOnRetry {thunk} class="mt-2 text-sm" />
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
    {#if path && $comments.length > 0}
      {@const pubkeys = $comments.map(e => e.pubkey)}
      {@const isOwn = $pubkey && pubkeys.includes($pubkey)}
      {@const info = displayList(pubkeys.map(pubkey => displayProfileByPubkey(pubkey)))}
      {@const tooltip = `${info} commented`}
      <div data-tip={tooltip} class="tooltip tooltip-right flex">
        <Link
          href={path}
          class={cx("btn btn-xs gap-1 rounded-full", {
            "btn-neutral": !isOwn,
            "btn-primary": isOwn,
          })}>
          <Icon icon={ReplyAlt} />
          <span>{$comments.length} comment{$comments.length === 1 ? "" : "s"}</span>
        </Link>
      </div>
    {/if}
  </div>
  {#if !isMobile}
    <button
      class="join absolute right-1 top-1 border border-solid border-neutral text-xs opacity-0 transition-all"
      class:group-hover:opacity-100={!isMobile}>
      {#if ENABLE_ZAPS}
        <ChannelItemZapButton {url} {event} />
      {/if}
      <ChannelItemEmojiButton {url} {event} />
      {#if replyTo}
        <Button class="btn join-item btn-xs" onclick={reply}>
          <Icon icon={Reply} size={4} />
        </Button>
      {/if}
      {#if edit}
        <Button class="btn join-item btn-xs" onclick={edit}>
          <Icon icon={Pen} size={4} />
        </Button>
      {/if}
      <ChannelItemMenuButton {url} {event} />
    </button>
  {/if}
</TapTarget>
