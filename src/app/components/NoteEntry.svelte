<script lang="ts">
  import type {TrustedEvent} from "@welshman/util"
  import EventQuoteAction from "@app/components/EventQuoteAction.svelte"
  import NoteItem from "@app/components/NoteItem.svelte"
  import ReplyList from "@app/components/ReplyList.svelte"
  import type {NoteEntry} from "@app/tools/feeds/cards"

  type Props = {
    entry: NoteEntry
    showReplies: boolean
    spaceUrls?: string[]
  }

  const {entry, showReplies, spaceUrls}: Props = $props()
</script>

{#snippet quoteNote(event: TrustedEvent)}
  <EventQuoteAction {event} noun="Note" />
{/snippet}

<div data-component="NoteEntry" class="flex flex-col gap-1">
  <NoteItem event={entry.note} customActions={quoteNote} showReply showThreadLinks {spaceUrls} />
  {#if showReplies}
    <ReplyList replies={entry.replies} {spaceUrls} {quoteNote} />
  {/if}
</div>
