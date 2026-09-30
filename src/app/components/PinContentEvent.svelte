<script lang="ts">
  import {onDestroy} from "svelte"
  import LoadingFallback from "@lib/components/LoadingFallback.svelte"
  import NoteItem from "@app/components/NoteItem.svelte"
  import {events} from "@app/core"
  import {makeFeedContext} from "@app/feeds"

  type Props = {
    url?: string
    value: string
    relays: string[]
  }

  const {url, value, relays}: Props = $props()

  const event = $events.one(value, relays).$
  const context = makeFeedContext({relays})

  onDestroy(context.cleanup)
</script>

{#if $event}
  <NoteItem {url} {context} event={$event} />
{:else}
  <LoadingFallback
    class="py-8"
    loadingMessage="Loading post..."
    failureMessage="Failed to load this post." />
{/if}
