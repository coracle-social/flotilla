<script lang="ts">
  import type {TrustedEvent, EventContent} from "@welshman/util"
  import ReactionSummary from "@app/components/ReactionSummary.svelte"
  import type {FeedContext} from "@app/features/feeds"
  import {publishReaction, retractReaction} from "@app/features/reactions"
  import PublicationStatusOrDeleted from "@app/components/PublicationStatusOrDeleted.svelte"
  import EventActivity from "@app/components/EventActivity.svelte"
  import EventActions from "@app/components/EventActions.svelte"

  type Props = {
    url: string
    event: TrustedEvent
    showActivity?: boolean
    context: FeedContext
  }

  const {url, event, showActivity = false, context}: Props = $props()

  const deleteReaction = (reaction: TrustedEvent) => retractReaction(reaction, {url})

  const createReaction = (values: EventContent) => publishReaction(event, values, {url})
</script>

<div class="flex flex-wrap items-center justify-between gap-2">
  <div class="flex grow flex-wrap justify-end gap-2">
    <PublicationStatusOrDeleted {event} {context}>
      <ReactionSummary {url} {event} {context} {deleteReaction} {createReaction} placement="left" />
      {#if showActivity}
        <EventActivity {event} {context} />
      {/if}
      <EventActions {url} {event} noun="Comment" />
    </PublicationStatusOrDeleted>
  </div>
</div>
