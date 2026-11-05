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
  <aside class="bg-surface border-line hidden shrink-0 flex-col @2xl:flex @2xl:w-80">
    <div class="flex flex-col @2xl:sticky @2xl:top-0">
      <section class="flex flex-col gap-2 px-4 py-4">
        <h2 class="text-sm font-bold tracking-wide uppercase opacity-60">Related Threads</h2>
        <div class="flex flex-col">
          {#each related as threadEvent (threadEvent.id)}
            <ThreadBoardItem {url} event={threadEvent} {context} stacked />
          {/each}
        </div>
      </section>
    </div>
  </aside>
{/if}
