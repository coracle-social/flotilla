<script lang="ts">
  import {onMount} from "svelte"
  import type {TrustedEvent} from "@welshman/util"
  import {Thread} from "@welshman/domain"
  import Link from "@lib/components/Link.svelte"
  import {reader} from "@app/core/domain"
  import * as pages from "@app/navigation/pages"
  import {loadSpaceThreads, rankThreads, tokenize} from "@app/features/spaces/relatedThreads"

  type Props = {
    url: string
    // The draft's title and body, joined, matched against the space's existing threads.
    query: string
  }

  const {url, query}: Props = $props()

  // The space's thread roots, filled as the feed loads them for ranking.
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

  // A draft that barely exists is not a question worth answering yet.
  const queryTokens = $derived(tokenize(query))
  const matches = $derived(
    queryTokens.size === 0 ? [] : rankThreads({query: queryTokens, candidates: threads}),
  )
</script>

{#if matches.length > 0}
  <div class="flex flex-col gap-1 rounded-xl border border-solid border-line bg-surface p-2">
    <p class="text-content-muted px-2 pt-1 text-xs">
      These threads may already answer your question:
    </p>
    {#each matches as event (event.id)}
      <Link
        href={pages.thread.path({url, id: event.id})}
        class="truncate rounded-lg px-2 py-1.5 hover:bg-surface-less">
        {reader(Thread)(event).title() || "Untitled thread"}
      </Link>
    {/each}
  </div>
{/if}
