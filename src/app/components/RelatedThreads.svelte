<script lang="ts">
  import {onDestroy} from "svelte"
  import {formatTimestamp} from "@welshman/lib"
  import type {TrustedEvent} from "@welshman/util"
  import {Thread} from "@welshman/domain"
  import {indexDocuments, rankDocuments} from "@lib/similarity"
  import Link from "@lib/components/Link.svelte"
  import ProfileName from "@app/components/ProfileName.svelte"
  import {reader} from "@app/core/domain"
  import * as pages from "@app/navigation/pages"
  import {makeThreadFeed, threadText} from "@app/features/spaces"

  type Props = {
    url: string
    event: TrustedEvent
  }

  const {url, event}: Props = $props()

  const feed = makeThreadFeed(url)
  const threads = feed.events
  const index = $derived(
    indexDocuments(
      $threads.filter(thread => thread.id !== event.id),
      threadText,
    ),
  )
  const related = $derived(rankDocuments(index, threadText(event)))

  onDestroy(feed.cleanup)
</script>

{#if related.length > 0}
  <aside class="bg-surface hidden w-80 shrink-0 flex-col border-l border-line @2xl:flex">
    <section class="flex flex-col gap-2 p-4 @2xl:sticky @2xl:top-0">
      <h2 class="text-sm font-bold tracking-wide uppercase opacity-60">Related threads</h2>
      <div class="flex flex-col">
        {#each related as thread (thread.id)}
          <Link
            href={pages.thread.path({url, id: thread.id})}
            class="hover:bg-surface-less -mx-2 flex flex-col gap-1 rounded-xl p-2 transition-colors">
            <p class="line-clamp-2 text-sm font-bold">
              {reader(Thread)(thread).title() || "Untitled thread"}
            </p>
            <p class="text-xs opacity-75">
              <ProfileName pubkey={thread.pubkey} {url} /> · {formatTimestamp(thread.created_at)}
            </p>
          </Link>
        {/each}
      </div>
    </section>
  </aside>
{/if}
