<script lang="ts">
  import type {TrustedEvent, EventContent} from "@welshman/util"
  import ReactionSummary from "@app/components/ReactionSummary.svelte"
  import type {FeedContext} from "@app/features/feeds"
  import PublicationStatusOrDeleted from "@app/components/PublicationStatusOrDeleted.svelte"
  import EventActivity from "@app/components/EventActivity.svelte"
  import EventMenuButton from "@app/components/EventMenuButton.svelte"
  import {publishReaction, retractReaction} from "@app/features/spaces"

  type Props = {
    url: string
    event: TrustedEvent
    showActivity?: boolean
    context: FeedContext
  }

  const {url, event, showActivity = false, context}: Props = $props()

  const deleteReaction = (reaction: TrustedEvent) => retractReaction(url, reaction)

  const createReaction = (values: EventContent) => publishReaction(url, event, values)
</script>

<div class="flex flex-wrap items-center justify-between gap-2">
  <div class="flex grow flex-wrap justify-end gap-2">
    <PublicationStatusOrDeleted {event} {context}>
      <ReactionSummary {url} {event} {context} {deleteReaction} {createReaction} placement="left" />
      {#if showActivity}
        <EventActivity {event} {context} />
      {/if}
      <EventMenuButton {url} {event} noun="Comment" class="rounded-full" />
    </PublicationStatusOrDeleted>
  </div>
</div>
