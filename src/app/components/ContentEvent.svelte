<script lang="ts">
  import {onDestroy} from "svelte"
  import LoadingFallback from "@lib/components/LoadingFallback.svelte"
  import NoteItem from "@app/components/NoteItem.svelte"
  import {events} from "@app/core/plugins"
  import {makeEngagement} from "@app/features/engagement"

  type Props = {
    url?: string
    value: string
    relays: string[]
  }

  const {url, value, relays}: Props = $props()

  const event = $events.one(value, relays).$
  const engagement = makeEngagement({relays: url ? [url] : undefined})

  onDestroy(engagement.stop)
</script>

{#if $event}
  <NoteItem {url} {engagement} event={$event} />
{:else}
  <LoadingFallback
    class="py-8"
    loadingMessage="Loading post..."
    failureMessage="Failed to load this post." />
{/if}
