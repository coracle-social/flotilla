<script lang="ts">
  import {Thread} from "@welshman/domain"
  import {THREAD} from "@welshman/util"
  import {indexDocuments, rankDocuments} from "@lib/similarity"
  import Link from "@app/components/Link.svelte"
  import {reader} from "@app/core/domain"
  import {events} from "@app/core/plugins"
  import * as pages from "@app/navigation/pages"
  import {threadText} from "@app/tools/content"

  type Props = {
    url: string
    query: string
  }

  const {url, query}: Props = $props()

  const threads = $derived($events.forUrl(url, [{kinds: [THREAD], limit: 100}]).$)
  const index = $derived(indexDocuments($threads, threadText))
  const matches = $derived(rankDocuments(index, query))
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
