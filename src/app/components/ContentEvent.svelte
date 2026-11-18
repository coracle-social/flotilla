<script lang="ts">
  import LoadingFallback from "@lib/components/LoadingFallback.svelte"
  import NoteItem from "@app/components/NoteItem.svelte"
  import {events} from "@app/core/plugins"

  type Props = {
    url?: string
    value: string
    relays: string[]
  }

  const {url, value, relays}: Props = $props()

  const event = $events.one(value, relays).$
</script>

{#if $event}
  <NoteItem {url} event={$event} />
{:else}
  <LoadingFallback
    class="py-8"
    loadingMessage="Loading post..."
    failureMessage="Failed to load this post." />
{/if}
