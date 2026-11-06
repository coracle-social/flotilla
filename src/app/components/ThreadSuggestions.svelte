<script lang="ts">
  import {onDestroy} from "svelte"
  import {Thread} from "@welshman/domain"
  import {indexDocuments, rankDocuments} from "@lib/similarity"
  import Link from "@lib/components/Link.svelte"
  import {reader} from "@app/core/domain"
  import * as pages from "@app/navigation/pages"
  import {makeThreadFeed, threadText} from "@app/features/spaces"

  type Props = {
    url: string
    query: string
  }

  const {url, query}: Props = $props()

  const feed = makeThreadFeed(url)
  const threads = feed.events
  const index = $derived(indexDocuments($threads, threadText))
  const matches = $derived(rankDocuments(index, query))

  onDestroy(feed.cleanup)
</script>

{#if matches.length > 0}
  <div class="flex flex-col gap-1 rounded-xl border border-line p-2">
    <p class="px-2 pt-1 text-xs text-content-muted">
      These threads may already answer your question:
    </p>
    {#each matches as thread (thread.id)}
      <Link
        href={pages.thread.path({url, id: thread.id})}
        class="truncate rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-surface-less">
        {reader(Thread)(thread).title() || "Untitled thread"}
      </Link>
    {/each}
  </div>
{/if}
