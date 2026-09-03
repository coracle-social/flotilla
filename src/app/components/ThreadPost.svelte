<script lang="ts">
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
  import Content from "@app/components/Content.svelte"
  import CommentActions from "@app/components/CommentActions.svelte"
  import type {FeedContext} from "@app/feeds"
  import ThreadActions from "@app/components/ThreadActions.svelte"
  import {handles, profiles} from "@app/core"
  import {makeEventPermalink} from "@app/routes"
  import {pushModal} from "@app/modal"
  import {clip} from "@app/toast"

  type Props = {
    url: string
    event: TrustedEvent
    threadPubkey: string
    onReply: (event: TrustedEvent) => void
    context: FeedContext
  }

  const {url, event, threadPubkey, onReply, context}: Props = $props()

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
  class="bg-surface border-b"
  style="border-color: var(--line)">
  <div class="flex flex-col md:flex-row">
    <aside
      class="bg-surface flex shrink-0 flex-row items-center gap-3 border-b p-3 md:w-40 md:flex-col md:items-center md:border-b-0 md:border-r md:p-4 md:text-center"
      style="border-color: var(--line)">
      <Button onclick={openProfile}>
        <ProfileCircle pubkey={event.pubkey} {url} size={10} class="md:size-14" />
      </Button>
      <div class="flex min-w-0 flex-col gap-1 md:items-center">
        <Button onclick={openProfile} class="text-bold truncate min-w-0 text-sm">
          {$profileDisplay}
        </Button>
        {#if $handle}
          <span class="truncate min-w-0 text-xs opacity-75">{displayHandle($handle)}</span>
        {/if}
        {#if isOp}
          <Badge variant="primary" class="w-fit self-start md:self-center">OP</Badge>
        {/if}
      </div>
    </aside>
    <div class="flex min-w-0 grow flex-col">
      <div
        class="bg-surface flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2 text-xs sm:px-4 sm:text-sm"
        style="border-color: var(--line)">
        <span class="opacity-75">{formatTimestamp(event.created_at)}</span>
        <Button
          class="button button-ghost button-xs h-auto min-h-0 gap-1 px-1 py-0"
          onclick={copyPermalink}>
          <Icon icon={LinkRound} size={3} />
          Permalink
        </Button>
      </div>
      <div class="px-3 py-4 sm:px-4">
        {#if isComment}
          <Content showEntire {event} {url} />
        {:else}
          <NoteContent showEntire {event} {url} />
        {/if}
      </div>
      <div
        class="bg-surface flex shrink-0 flex-col gap-2 border-t px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4"
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
