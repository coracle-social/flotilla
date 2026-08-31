<script lang="ts">
  import {uniq} from "@welshman/lib"
  import type {TrustedEvent, EventContent} from "@welshman/util"
  import {getAddress} from "@welshman/util"
  import {Article} from "@welshman/domain"
  import Link from "@lib/components/Link.svelte"
  import RoomName from "@app/components/RoomName.svelte"
  import {publishReaction, retractReaction} from "@app/reactions"
  import ReactionSummary from "@app/components/ReactionSummary.svelte"
  import type {FeedContext} from "@app/feeds"
  import ThunkStatusOrDeleted from "@app/components/ThunkStatusOrDeleted.svelte"
  import EventActivity from "@app/components/EventActivity.svelte"
  import EventActions from "@app/components/EventActions.svelte"
  import {reader} from "@app/core"
  import {makeArticlePath, makeSpacePath} from "@app/routes"

  type Props = {
    url: string
    event: TrustedEvent
    showRoom?: boolean
    showActivity?: boolean
    context: FeedContext
  }

  const {url, event, showRoom, showActivity, context}: Props = $props()

  const article = $derived(reader(Article)(event))
  const h = $derived(article.room())
  const topics = $derived(article.topics())
  const path = $derived(makeArticlePath(url, getAddress(event)))

  const deleteReaction = (reaction: TrustedEvent) => retractReaction(reaction, {url, h})

  const createReaction = (values: EventContent) => publishReaction(event, values, {url, h})
</script>

<div class="flex grow flex-wrap justify-end gap-2">
  {#if h && showRoom}
    <Link href={makeSpacePath(url, h)} class="button button-neutral button-xs rounded-full">
      Posted in #<RoomName {h} {url} />
    </Link>
  {/if}
  <div class="flex min-w-0 flex-wrap gap-2">
    {#each uniq(topics) as topic (topic)}
      <button type="button" class="button button-xs rounded-full font-normal">
        #{topic}
      </button>
    {/each}
  </div>
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
    <EventActions {url} {event} noun="Article" />
  </ThunkStatusOrDeleted>
</div>
