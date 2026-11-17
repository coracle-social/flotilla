<script lang="ts">
  import {onDestroy} from "svelte"
  import LoadingFallback from "@lib/components/LoadingFallback.svelte"
  import NoteItem from "@app/components/NoteItem.svelte"
  import {events} from "@app/core/plugins"
  import {makeInteractions} from "@app/features/interactions"

  type Props = {
    url?: string
    value: string
    relays: string[]
  }

  const {url, value, relays}: Props = $props()

  const event = $events.one(value, relays).$
  const interactions = makeInteractions({relays: url ? [url] : undefined})

  onDestroy(interactions.stop)
</script>

{#if $event}
  <NoteItem {url} {interactions} event={$event} />
{:else}
  <LoadingFallback
    class="py-8"
    loadingMessage="Loading post..."
    failureMessage="Failed to load this post." />
{/if}
