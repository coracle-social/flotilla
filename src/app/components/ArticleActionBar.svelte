<script lang="ts">
  import type {TrustedEvent} from "@welshman/util"
  import ShareCircle from "@assets/icons/share-circle.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import EventReactions from "@app/components/EventReactions.svelte"
  import PublicationStatusOrDeleted from "@app/components/PublicationStatusOrDeleted.svelte"
  import EventActivity from "@app/components/EventActivity.svelte"
  import {events} from "@app/core/plugins"
  import type {FeedContext} from "@app/features/feeds"
  import {shareEvent} from "@app/features/share"

  type Props = {
    event: TrustedEvent
    context: FeedContext
    url?: string
  }

  const {event, context, url}: Props = $props()

  const deleted = $derived($events.isDeleted(event).$)

  const share = () => shareEvent(url, "Article", event)
</script>

<div
  data-component="ArticleActionBar"
  class="flex w-full min-w-0 flex-wrap items-center justify-between gap-2">
  <div class="flex min-w-0 flex-wrap items-center gap-2">
    <PublicationStatusOrDeleted {event} {context}>
      <EventReactions {url} {event} {context} placement="top" emojiMenu />
      <EventActivity {event} {context} hideLastActive />
    </PublicationStatusOrDeleted>
  </div>
  {#if !$deleted}
    <Button
      aria-label="Share to Chat"
      class="button button-neutral button-xs shrink-0 rounded-full font-normal"
      onclick={share}>
      <Icon icon={ShareCircle} size={4} />
      Share
    </Button>
  {/if}
</div>
