<script lang="ts">
  import type {TrustedEvent, EventContent} from "@welshman/util"
  import ShareCircle from "@assets/icons/share-circle.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import ReactionSummary from "@app/components/ReactionSummary.svelte"
  import PublicationStatusOrDeleted from "@app/components/PublicationStatusOrDeleted.svelte"
  import EventActivity from "@app/components/EventActivity.svelte"
  import {events} from "@app/core/plugins"
  import type {FeedContext} from "@app/features/feeds"
  import {publishReaction, retractReaction} from "@app/features/spaces"
  import {shareEvent} from "@app/features/share"

  type Props = {
    url: string
    event: TrustedEvent
    context: FeedContext
  }

  const {url, event, context}: Props = $props()

  const deleted = $derived($events.isDeleted(event).$)

  const deleteReaction = (reaction: TrustedEvent) => retractReaction(url, reaction)

  const createReaction = (values: EventContent) => publishReaction(url, event, values)

  const share = () => shareEvent(url, "Article", event)
</script>

<div data-component="ArticleActionBar" class="flex w-full min-w-0 flex-col gap-3">
  <PublicationStatusOrDeleted {event} {context}>
    <ReactionSummary
      {url}
      {event}
      {context}
      {deleteReaction}
      {createReaction}
      placement="top"
      emojiMenu />
  </PublicationStatusOrDeleted>
  {#if !$deleted}
    <div class="flex w-full min-w-0 items-start justify-between gap-x-4">
      <EventActivity {event} {context} size="sm" hideLastActive />
      <Button
        aria-label="Share to Chat"
        class="button button-neutral button-sm shrink-0 rounded-full"
        onclick={share}>
        <Icon icon={ShareCircle} size={4} />
        Share
      </Button>
    </div>
  {/if}
</div>
