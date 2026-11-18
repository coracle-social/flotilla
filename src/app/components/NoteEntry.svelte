<script lang="ts">
  import type {TrustedEvent} from "@welshman/util"
  import EventQuoteAction from "@app/components/EventQuoteAction.svelte"
  import NoteItem from "@app/components/NoteItem.svelte"
  import ReplyList from "@app/components/ReplyList.svelte"
  import type {NoteEntry} from "@app/tools/feeds/network"

  type Props = {
    entry: NoteEntry
  }

  const {entry}: Props = $props()
</script>

{#snippet quoteNote(event: TrustedEvent)}
  <EventQuoteAction {event} noun="Note" />
{/snippet}

<div data-component="NoteEntry" class="flex flex-col gap-1">
  <NoteItem event={entry.note} customActions={quoteNote} showReply showThreadLinks />
  <ReplyList replies={entry.replies} {quoteNote} />
</div>
