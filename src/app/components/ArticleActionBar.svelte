<script lang="ts">
  import type {TrustedEvent} from "@welshman/util"
  import ShareCircle from "@assets/icons/share-circle.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import EventReactions from "@app/components/EventReactions.svelte"
  import PublicationStatusOrDeleted from "@app/components/PublicationStatusOrDeleted.svelte"
  import EventActivity from "@app/components/EventActivity.svelte"
  import {events} from "@app/core/plugins"
  import type {Engagement} from "@app/features/engagement"
  import {shareEvent} from "@app/features/share"

  type Props = {
    event: TrustedEvent
    engagement: Engagement
    url?: string
  }

  const {event, engagement, url}: Props = $props()

  const deleted = $derived($events.isDeleted(event).$)

  const share = () => shareEvent(url, "Article", event)
</script>

<div data-component="ArticleActionBar" class="flex w-full min-w-0 flex-col gap-3">
  <PublicationStatusOrDeleted {event}>
    <EventReactions {url} {event} {engagement} placement="top" emojiMenu />
  </PublicationStatusOrDeleted>
  {#if !$deleted}
    <div class="flex w-full min-w-0 items-start justify-between gap-x-4">
      <EventActivity {event} {engagement} size="sm" hideLastActive />
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
