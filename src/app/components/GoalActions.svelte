<script lang="ts">
  import type {TrustedEvent, EventContent} from "@welshman/util"
  import {ZapGoal} from "@welshman/domain"
  import Link from "@lib/components/Link.svelte"
  import {reader} from "@app/core"
  import ReactionSummary from "@app/components/ReactionSummary.svelte"
  import type {FeedContext} from "@app/feeds"
  import {publishReaction, retractReaction} from "@app/reactions"
  import ThunkStatusOrDeleted from "@app/components/ThunkStatusOrDeleted.svelte"
  import EventActivity from "@app/components/EventActivity.svelte"
  import EventActions from "@app/components/EventActions.svelte"
  import RoomName from "@app/components/RoomName.svelte"
  import {makeSpacePath} from "@app/routes"

  interface Props {
    url: string
    event: TrustedEvent
    showRoom?: boolean
    showActivity?: boolean
    context: FeedContext
  }

  const {url, event, showRoom, showActivity, context}: Props = $props()

  const goal = reader(ZapGoal)(event)

  const h = goal.room()

  const deleteReaction = (reaction: TrustedEvent) => retractReaction(reaction, {url})

  const createReaction = (values: EventContent) => publishReaction(event, values, {url})
</script>

<div class="flex min-w-0 grow flex-wrap justify-end gap-2">
  {#if h && showRoom}
    <Link href={makeSpacePath(url, h)} class="button button-neutral button-xs rounded-full">
      Posted in #<RoomName {h} {url} />
    </Link>
  {/if}
  <ThunkStatusOrDeleted {event} {context}>
    <ReactionSummary
      hideZaps
      {url}
      {event}
      {context}
      {deleteReaction}
      {createReaction}
      reactionClass="tip-left" />
    {#if showActivity}
      <EventActivity {event} {context} />
    {/if}
    <EventActions {url} {event} hideZap noun="Goal" />
  </ThunkStatusOrDeleted>
</div>
