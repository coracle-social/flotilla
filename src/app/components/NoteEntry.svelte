<script lang="ts">
  import type {TrustedEvent} from "@welshman/util"
  import EventQuoteAction from "@app/components/EventQuoteAction.svelte"
  import NoteItem from "@app/components/NoteItem.svelte"
  import ReplyList from "@app/components/ReplyList.svelte"
  import type {EngagementIndex} from "@app/features/engagement"
  import type {NoteEntry} from "@app/features/social"

  type Props = {
    entry: NoteEntry
    engagement: EngagementIndex
  }

  const {entry, engagement}: Props = $props()
</script>

{#snippet quoteNote(event: TrustedEvent)}
  <EventQuoteAction {event} noun="Note" />
{/snippet}

<div data-component="NoteEntry" class="flex flex-col gap-1">
  <NoteItem event={entry.note} {engagement} customActions={quoteNote} showReply showThreadLinks />
  <ReplyList replies={entry.replies} {engagement} {quoteNote} />
</div>
