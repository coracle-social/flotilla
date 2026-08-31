<script lang="ts">
  import type {TrustedEvent, EventContent} from "@welshman/util"
  import {tagSpec, tagValue} from "@welshman/util"
  import Link from "@lib/components/Link.svelte"
  import RoomName from "@app/components/RoomName.svelte"
  import {publishReaction, retractReaction} from "@app/reactions"
  import ReactionSummary from "@app/components/ReactionSummary.svelte"
  import type {FeedContext} from "@app/feeds"
  import ThunkStatusOrDeleted from "@app/components/ThunkStatusOrDeleted.svelte"
  import EventActivity from "@app/components/EventActivity.svelte"
  import EventActions from "@app/components/EventActions.svelte"
  import {makePollPath, makeSpacePath} from "@app/routes"

  type Props = {
    url: string
    event: TrustedEvent
    showRoom?: boolean
    showActivity?: boolean
    context: FeedContext
  }

  const {url, event, showRoom, showActivity, context}: Props = $props()

  const h = tagValue(tagSpec("h"), event.tags)
  const path = makePollPath(url, event.id)

  const deleteReaction = (reaction: TrustedEvent) => retractReaction(reaction, {url, h})

  const createReaction = (values: EventContent) => publishReaction(event, values, {url, h})
</script>

<div class="flex grow flex-wrap justify-end gap-2">
  {#if h && showRoom}
    <Link href={makeSpacePath(url, h)} class="button button-neutral button-xs rounded-full">
      Posted in #<RoomName {h} {url} />
    </Link>
  {/if}
  <ThunkStatusOrDeleted {event} {context}>
    <ReactionSummary
      {url}
      {event}
      {context}
      {deleteReaction}
      {createReaction}
      reactionClass="tip-left" />
    {#if showActivity}
      <EventActivity {path} {event} {context} />
    {/if}
    <EventActions {url} {event} noun="Poll" />
  </ThunkStatusOrDeleted>
</div>
