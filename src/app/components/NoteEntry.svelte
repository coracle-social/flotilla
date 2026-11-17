<script lang="ts">
  import type {TrustedEvent} from "@welshman/util"
  import EventQuoteAction from "@app/components/EventQuoteAction.svelte"
  import NoteItem from "@app/components/NoteItem.svelte"
  import ReplyList from "@app/components/ReplyList.svelte"
  import type {Interactions} from "@app/features/interactions"
  import type {NoteEntry} from "@app/features/feeds"

  type Props = {
    entry: NoteEntry
    interactions: Interactions
  }

  const {entry, interactions}: Props = $props()
</script>

{#snippet quoteNote(event: TrustedEvent)}
  <EventQuoteAction {event} noun="Note" />
{/snippet}

<div data-component="NoteEntry" class="flex flex-col gap-1">
  <NoteItem event={entry.note} {interactions} customActions={quoteNote} showReply showThreadLinks />
  <ReplyList replies={entry.replies} {interactions} {quoteNote} />
</div>
