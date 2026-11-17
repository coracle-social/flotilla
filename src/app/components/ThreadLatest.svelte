<script lang="ts">
  import type {TrustedEvent} from "@welshman/util"
  import ThreadLatestItem from "@app/components/ThreadLatestItem.svelte"
  import type {Interactions} from "@app/features/interactions"

  type Props = {
    url: string
    items: TrustedEvent[]
    interactions: Interactions
  }

  const {url, items, interactions}: Props = $props()
</script>

<section class="card card-flat hidden p-0 lg:block">
  <header class="border-b border-solid border-line px-4 py-3">
    <h2 class="text-lg">Latest</h2>
  </header>
  {#if items.length === 0}
    <p class="text-content-muted p-4 text-sm">No topics yet.</p>
  {:else}
    <div>
      {#each items as event (event.id)}
        <ThreadLatestItem {url} {event} {interactions} />
      {/each}
    </div>
  {/if}
</section>
