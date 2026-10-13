<script lang="ts">
  import type {TrustedEvent, EventContent} from "@welshman/util"
  import ReactionSummary from "@app/components/ReactionSummary.svelte"
  import PublicationStatusOrDeleted from "@app/components/PublicationStatusOrDeleted.svelte"
  import EventActivity from "@app/components/EventActivity.svelte"
  import EventActionBar from "@app/components/EventActionBar.svelte"
  import {events} from "@app/core/plugins"
  import type {FeedContext} from "@app/features/feeds"
  import {publishReaction, retractReaction} from "@app/features/reactions"

  type Props = {
    url: string
    event: TrustedEvent
    context: FeedContext
  }

  const {url, event, context}: Props = $props()

  const deleted = $derived($events.isDeleted(event).$)

  const deleteReaction = (reaction: TrustedEvent) => retractReaction(reaction, {url})

  const createReaction = (values: EventContent) => publishReaction(event, values, {url})
</script>

<div data-component="ArticleActionBar" class="flex w-full min-w-0 flex-col gap-3">
  <PublicationStatusOrDeleted {event} {context}>
    <ReactionSummary {url} {event} {context} {deleteReaction} {createReaction} placement="top" />
  </PublicationStatusOrDeleted>
  {#if !$deleted}
    <EventActionBar {url} {event} noun="Article">
      {#snippet leading()}
        <EventActivity {event} {context} size="sm" hideLastActive />
      {/snippet}
    </EventActionBar>
  {/if}
</div>
