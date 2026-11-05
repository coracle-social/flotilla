<script lang="ts">
  import {onMount} from "svelte"
  import type {TrustedEvent} from "@welshman/util"
  import ThreadBoardItem from "@app/components/ThreadBoardItem.svelte"
  import type {FeedContext} from "@app/features/feeds"
  import {loadSpaceThreads, rankThreads, threadTokens} from "@app/features/spaces/relatedThreads"

  type Props = {
    url: string
    event: TrustedEvent
    context: FeedContext
  }

  const {url, event, context}: Props = $props()

  // The space's other thread roots, filled as the feed loads them for ranking.
  let threads: TrustedEvent[] = $state([])

  onMount(() => {
    const feed = loadSpaceThreads(url)
    const unsubscribe = feed.events.subscribe(events => {
      threads = events
    })

    return () => {
      unsubscribe()
      feed.cleanup()
    }
  })

  const related = $derived(
    rankThreads({query: threadTokens(event), candidates: threads, exclude: event.id}),
  )
</script>

{#if related.length > 0}
  <section class="border-t border-solid border-line">
    <header class="px-4 py-3">
      <h2 class="text-lg">Related Threads</h2>
    </header>
    {#each related as threadEvent (threadEvent.id)}
      <ThreadBoardItem {url} event={threadEvent} {context} stacked />
    {/each}
  </section>
{/if}
