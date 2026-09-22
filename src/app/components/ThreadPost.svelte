<script lang="ts">
  import cx from "classnames"
  import {formatTimestamp} from "@welshman/lib"
  import type {TrustedEvent} from "@welshman/util"
  import {COMMENT, displayHandle} from "@welshman/util"
  import Reply from "@assets/icons/reply-2.svg?dataurl"
  import LinkRound from "@assets/icons/link-round.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import Badge from "@lib/components/Badge.svelte"
  import ProfileCircle from "@app/components/ProfileCircle.svelte"
  import ProfileDetail from "@app/components/ProfileDetail.svelte"
  import NoteContent from "@app/components/NoteContent.svelte"
  import CommentActions from "@app/components/CommentActions.svelte"
  import type {FeedContext} from "@app/feeds"
  import ThreadActions from "@app/components/ThreadActions.svelte"
  import {handles, profiles} from "@app/core"
  import {highlightedEvent, makeEventPermalink} from "@app/routes"
  import {pushModal} from "@app/modal"
  import {clip} from "@app/toast"

  type Props = {
    url: string
    event: TrustedEvent
    threadPubkey: string
    onReply: (event: TrustedEvent) => void
    context: FeedContext
    replyCount?: number
  }

  const {url, event, threadPubkey, onReply, context, replyCount}: Props = $props()

  const profileDisplay = $profiles.display(event.pubkey, [url]).$
  const handle = $handles.forPubkey(event.pubkey).$
  const isOp = event.pubkey === threadPubkey
  const isComment = event.kind === COMMENT

  const openProfile = () => pushModal(ProfileDetail, {pubkey: event.pubkey, url})

  const copyPermalink = () => clip(makeEventPermalink(event, url))

  const reply = () => onReply(event)
</script>

<article
  id="post-{event.id}"
  data-event={event.id}
  class={cx("bg-surface border-b @container", {"highlight-target": $highlightedEvent === event.id})}
  style="border-color: var(--line)">
  <div class="flex flex-col @2xl:flex-row">
    <aside
      class="bg-surface flex shrink-0 flex-row items-center gap-3 border-b p-3 @2xl:w-40 @2xl:flex-col @2xl:items-center @2xl:border-b-0 @2xl:border-r @2xl:p-4 @2xl:text-center"
      style="border-color: var(--line)">
      <Button onclick={openProfile}>
        <ProfileCircle pubkey={event.pubkey} {url} size={10} class="@2xl:size-14" />
      </Button>
      <div class="flex min-w-0 flex-col gap-1 @2xl:items-center">
        <Button onclick={openProfile} class="text-bold truncate min-w-0 text-sm">
          {$profileDisplay}
        </Button>
        {#if $handle}
          <span class="truncate min-w-0 text-xs opacity-75">{displayHandle($handle)}</span>
        {/if}
        {#if isOp}
          <Badge variant="primary" class="w-fit self-start @2xl:self-center">OP</Badge>
        {/if}
      </div>
    </aside>
    <div class="flex min-w-0 grow flex-col">
      <div
        class="bg-surface flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2 text-xs @lg:px-4 @lg:text-sm"
        style="border-color: var(--line)">
        <div class="flex items-center gap-2 opacity-75">
          <span>{formatTimestamp(event.created_at)}</span>
          {#if replyCount !== undefined}
            <span>·</span>
            <span>{replyCount} {replyCount === 1 ? "reply" : "replies"}</span>
          {/if}
        </div>
        <Button
          class="button button-ghost button-xs h-auto min-h-0 gap-1 px-1 py-0"
          onclick={copyPermalink}>
          <Icon icon={LinkRound} size={3} />
          Permalink
        </Button>
      </div>
      <div class="px-3 py-4 @lg:px-4">
        <NoteContent showEntire {event} {url} />
      </div>
      <div
        class="bg-surface flex shrink-0 flex-col gap-2 border-t px-3 py-3 @lg:flex-row @lg:items-center @lg:justify-between @lg:px-4"
        style="border-color: var(--line)">
        <Button class="button button-neutral button-xs w-fit gap-1" onclick={reply}>
          <Icon icon={Reply} size={4} />
          Reply
        </Button>
        {#if isComment}
          <CommentActions {event} {url} {context} />
        {:else}
          <ThreadActions {event} {url} {context} />
        {/if}
      </div>
    </div>
  </div>
</article>
