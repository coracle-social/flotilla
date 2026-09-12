<script lang="ts">
  import cx from "classnames"
  import {readable} from "svelte/store"
  import {
    gte,
    now,
    uniq,
    displayList,
    formatTimestampAsTime,
    formatTimestampAsDate,
  } from "@welshman/lib"
  import type {TrustedEvent, EventContent} from "@welshman/util"
  import {
    MESSAGE,
    THREAD,
    getCommentFiltersForParent,
    getIdOrAddress,
    matchTag,
    tagSpec,
    tagValue,
  } from "@welshman/util"
  import {isMobile} from "@lib/html"
  import NotesMinimalistic from "@assets/icons/notes-minimalistic.svg?dataurl"
  import Pen from "@assets/icons/pen.svg?dataurl"
  import Reply from "@assets/icons/reply-2.svg?dataurl"
  import ReplyAlt from "@assets/icons/reply.svg?dataurl"
  import TapTarget from "@lib/components/TapTarget.svelte"
  import Icon from "@lib/components/Icon.svelte"
  import Link from "@lib/components/Link.svelte"
  import Button from "@lib/components/Button.svelte"
  import ThunkFailure from "@app/components/ThunkFailure.svelte"
  import {publishReaction, retractReaction} from "@app/reactions"
  import {deriveDisplaysByPubkey} from "@app/social"
  import ProfileDetail from "@app/components/ProfileDetail.svelte"
  import ProfileCircle from "@app/components/ProfileCircle.svelte"
  import ReactionSummary from "@app/components/ReactionSummary.svelte"
  import RoomItemZapButton from "@app/components/RoomItemZapButton.svelte"
  import RoomItemEmojiButton from "@app/components/RoomItemEmojiButton.svelte"
  import RoomItemMenuButton from "@app/components/RoomItemMenuButton.svelte"
  import RoomItemMenuMobile from "@app/components/RoomItemMenuMobile.svelte"
  import RoomItemContent from "@app/components/RoomItemContent.svelte"
  import {profiles, thunks, user} from "@app/core"
  import {noThunks, thunksByEventId} from "@app/thunks"
  import {colorFor} from "@app/theme"
  import {ENABLE_ZAPS} from "@app/env"
  import type {FeedContext} from "@app/feeds"
  import {deriveEvent, deriveEventsForUrl} from "@app/repository"
  import {makeContentPath, makeThreadPath} from "@app/routes"
  import {pushModal} from "@app/modal"

  type Props = {
    url: string
    event: TrustedEvent
    replyTo?: (event: TrustedEvent) => void
    showPubkey?: boolean
    context: FeedContext
    canEdit: (event: TrustedEvent) => boolean
    onEdit: (event: TrustedEvent) => void
  }

  const {
    url,
    event,
    replyTo = undefined,
    showPubkey = false,
    context,
    canEdit,
    onEdit,
  }: Props = $props()

  const h = tagValue(tagSpec("h"), event.tags)
  const today = formatTimestampAsDate(now())
  const profileDisplay = $profiles.display(event.pubkey, [url]).$
  const thunk = $derived($thunks.merge($thunksByEventId.get(event.id) ?? noThunks))
  const colorValue = colorFor(event.pubkey)

  const qTag = matchTag(tagSpec("q"), event.tags)
  const isQuoteOnly = Boolean(
    gte(qTag?.length, 2) && event.content.trim().match(/^nostr:n(event|addr)1\w+\s*$/),
  )
  const innerEvent = isQuoteOnly ? deriveEvent(qTag![1], [url]) : readable(undefined)
  const innerComments = $derived(
    $innerEvent ? deriveEventsForUrl(url, getCommentFiltersForParent([$innerEvent])) : readable([]),
  )

  const path = $derived(
    $innerEvent && makeContentPath(url, $innerEvent.kind, getIdOrAddress($innerEvent)),
  )

  const threads = deriveEventsForUrl(url, [{kinds: [THREAD], "#q": [event.id]}])

  const commenterDisplays = $derived(
    deriveDisplaysByPubkey(uniq($innerComments.map(e => e.pubkey)), url),
  )

  const reply = () => replyTo!(event)

  const edit = canEdit(event) ? () => onEdit(event) : undefined

  const onTap = () => pushModal(RoomItemMenuMobile, {url, event, reply, edit})

  const openProfile = () => pushModal(ProfileDetail, {pubkey: event.pubkey, url})

  const deleteReaction = (reaction: TrustedEvent) => retractReaction(reaction, {url, h})

  const createReaction = (values: EventContent) => publishReaction(event, values, {url, h})
</script>

<TapTarget
  data-event={event.id}
  {onTap}
  class={cx(
    "room__item group relative flex w-full cursor-default flex-col px-2 py-0.5 text-left transition-colors",
    {"mt-1.5": showPubkey},
  )}>
  <div class="flex w-full gap-3 overflow-auto">
    {#if showPubkey}
      <Button onclick={openProfile} class="flex items-start pt-1.5 justify-center w-8 shrink-0">
        <ProfileCircle
          pubkey={event.pubkey}
          class="border border-solid"
          style="border-color: var(--line)"
          size={8} />
      </Button>
    {:else}
      <div class="w-8 shrink-0"></div>
    {/if}
    <div class="min-w-0 grow pr-1">
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
        <RoomItemContent {url} event={$innerEvent ?? event} />
        {#if thunk}
          <ThunkFailure showToastOnRetry {thunk} class="mt-1 flex justify-end" />
        {/if}
      </div>
    </div>
  </div>
  <div class="flex gap-2 ml-10 mt-1 pl-1">
    <ReactionSummary
      {url}
      {event}
      {context}
      {deleteReaction}
      {createReaction}
      reactionClass="tip-right"
      innerEvent={$innerEvent} />
    {#each $threads as thread (thread.id)}
      <Link
        href={makeThreadPath(url, thread.id)}
        class="button button-xs button-neutral gap-1 rounded-full">
        <Icon icon={NotesMinimalistic} />
        <span class="max-w-48 truncate">
          {tagValue(tagSpec("title"), thread.tags) || "Thread"}
        </span>
      </Link>
    {/each}
    {#if path && $innerComments.length > 0}
      {@const pubkeys = $innerComments.map(e => e.pubkey)}
      {@const isOwn = pubkeys.includes($user.pubkey)}
      {@const info = displayList(pubkeys.map(pubkey => $commenterDisplays.get(pubkey) ?? ""))}
      {@const tooltip = `${info} commented`}
      <div data-tip={tooltip} class="tip tip-right flex">
        <Link
          href={path}
          class={cx("button button-xs gap-1 rounded-full", {
            "button-neutral": !isOwn,
            "button-primary": isOwn,
          })}>
          <Icon icon={ReplyAlt} />
          <span>{$innerComments.length} comment{$innerComments.length === 1 ? "" : "s"}</span>
        </Link>
      </div>
    {/if}
  </div>
  {#if !isMobile}
    <div
      class="room__item-actions join absolute right-2 top-0.5 opacity-0 transition-all focus-within:opacity-100 group-hover:opacity-100">
      {#if ENABLE_ZAPS}
        <RoomItemZapButton {url} {event} />
      {/if}
      <RoomItemEmojiButton {url} {event} />
      {#if replyTo}
        <Button
          aria-label="Reply"
          class="button button-xs button-neutral join-item"
          onclick={reply}>
          <Icon icon={Reply} size={4} />
        </Button>
      {/if}
      {#if edit}
        <Button aria-label="Edit" class="button button-xs button-neutral join-item" onclick={edit}>
          <Icon icon={Pen} size={4} />
        </Button>
      {/if}
      <RoomItemMenuButton {url} {event} />
    </div>
  {/if}
</TapTarget>
