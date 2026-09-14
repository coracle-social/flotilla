<script lang="ts">
  import {sortBy} from "@welshman/lib"
  import type {TrustedEvent} from "@welshman/util"
  import SortVertical from "@assets/icons/sort-vertical.svg?dataurl"
  import Reply from "@assets/icons/reply-2.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import NoteCard from "@app/components/NoteCard.svelte"
  import NoteContent from "@app/components/NoteContent.svelte"
  import CommentActions from "@app/components/CommentActions.svelte"
  import EventReply from "@app/components/EventReply.svelte"
  import type {FeedContext} from "@app/feeds"

  type Props = {
    url: string
    event: TrustedEvent
    replies: TrustedEvent[]
    context: FeedContext
  }

  const {url, event, replies, context}: Props = $props()

  const expand = () => {
    showAll = true
  }

  const openReply = () => {
    showReply = true
  }

  const closeReply = () => {
    showReply = false
  }

  let showAll = $state(false)
  let showReply = $state(false)

  const ordered = $derived(sortBy(reply => reply.created_at, replies))
</script>

<div class="flex flex-col gap-2 sm:gap-4">
  {#if ordered.length === 0 && !showReply}
    <div class="flex flex-col items-center gap-3 py-6">
      <p class="opacity-75">No comments yet — start the conversation.</p>
      <Button class="button button-primary" onclick={openReply}>
        <Icon icon={Reply} />
        Leave comment
      </Button>
    </div>
  {:else}
    {#if !showAll && ordered.length > 4}
      <div class="flex justify-center">
        <Button class="button button-link" onclick={expand}>
          <Icon icon={SortVertical} />
          Show all {ordered.length} replies
        </Button>
      </div>
    {/if}
    {#each ordered.slice(0, showAll ? undefined : 4) as reply (reply.id)}
      <NoteCard event={reply} {url} class="card z-feature w-full">
        <div class="ml-12 flex flex-col gap-3">
          <NoteContent showEntire event={reply} {url} />
          <CommentActions event={reply} {url} {context} />
        </div>
      </NoteCard>
    {/each}
    {#if showReply}
      <EventReply {url} {event} onClose={closeReply} onSubmit={closeReply} />
    {:else}
      <div class="flex justify-end px-2 pb-2">
        <Button class="button button-primary" onclick={openReply}>
          <Icon icon={Reply} />
          Leave comment
        </Button>
      </div>
    {/if}
  {/if}
</div>
