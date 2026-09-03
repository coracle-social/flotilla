<script lang="ts">
  import type {TrustedEvent, EventContent} from "@welshman/util"
  import {tagSpec, tagValue} from "@welshman/util"
  import ReactionSummary from "@app/components/ReactionSummary.svelte"
  import type {FeedContext} from "@app/feeds"
  import {publishReaction, retractReaction} from "@app/reactions"
  import ThunkStatusOrDeleted from "@app/components/ThunkStatusOrDeleted.svelte"
  import EventActivity from "@app/components/EventActivity.svelte"
  import EventActions from "@app/components/EventActions.svelte"

  type Props = {
    url: string
    event: TrustedEvent
    showActivity?: boolean
    context: FeedContext
  }

  const {url, event, showActivity = false, context}: Props = $props()

  const h = tagValue(tagSpec("h"), event.tags)

  const deleteReaction = (reaction: TrustedEvent) => retractReaction(reaction, {url, h})

  const createReaction = (values: EventContent) => publishReaction(event, values, {url, h})
</script>

<div class="flex flex-wrap items-center justify-between gap-2">
  <div class="flex grow flex-wrap justify-end gap-2">
    <ThunkStatusOrDeleted {event} {context}>
      <ReactionSummary
        {url}
        {event}
        {context}
        {deleteReaction}
        {createReaction}
        reactionClass="tip-left" />
      {#if showActivity}
        <EventActivity {event} {context} />
      {/if}
      <EventActions {url} {event} noun="Comment" />
    </ThunkStatusOrDeleted>
  </div>
</div>
