<script lang="ts">
  import type {TrustedEvent} from "@welshman/util"
  import {WEEK, sortBy, uniq} from "@welshman/lib"
  import {tagValues, topicTags} from "@welshman/util"
  import Link from "@lib/components/Link.svelte"
  import RoomNameWithImage from "@app/components/RoomNameWithImage.svelte"
  import ThreadBoardItem from "@app/components/ThreadBoardItem.svelte"
  import {normalizeTopic} from "@lib/util"
  import {rooms} from "@app/core/plugins"
  import * as pages from "@app/navigation/pages"
  import type {FeedContext} from "@app/features/feeds"

  type Props = {
    url: string
    h: string
    threads: TrustedEvent[]
    context: FeedContext
  }

  const {url, h, threads, context}: Props = $props()
  const boardPath = $derived(
    pages.threads.path({url}) + (h ? `?board=${encodeURIComponent(h)}` : "?board="),
  )

  const room = $rooms.forRoom(url, h)
  const description = $derived($room?.meta?.about() ?? "")
  const topicsThisWeek = $derived(
    threads.filter(e => e.created_at > Math.floor(Date.now() / 1000) - WEEK).length,
  )
  const hashtags = $derived(
    sortBy(
      tag => normalizeTopic(tag),
      uniq(threads.flatMap(e => tagValues(topicTags("t"), e.tags))),
    ),
  )
</script>

<section class="card card-flat p-0">
  <Link
    href={boardPath}
    class="hover:bg-surface-less flex w-full items-start justify-between gap-2 px-4 py-3 transition-colors">
    <div class="min-w-0">
      <h2 class="text-lg">
        {#if h}
          <RoomNameWithImage {url} {h} />
        {:else}
          General
        {/if}
      </h2>
      {#if description}
        <p class="text-content-muted mt-1 text-sm">{description}</p>
      {/if}
      {#if hashtags.length > 0}
        <div class="mt-2 flex flex-wrap gap-1">
          {#each hashtags as tag (tag)}
            <span class="button button-xs rounded-full font-normal">#{normalizeTopic(tag)}</span>
          {/each}
        </div>
      {/if}
    </div>
    <span class="text-content-muted whitespace-nowrap pt-1 text-sm">{topicsThisWeek} / week</span>
  </Link>
  <!-- The board's own rows only on mobile, where the Latest panel is hidden. -->
  <div class="lg:hidden">
    {#if threads.length === 0}
      <p class="text-content-muted p-4 text-sm">No topics yet.</p>
    {:else}
      <div class="border-t border-solid border-line">
        {#each threads as event (event.id)}
          <ThreadBoardItem stacked {url} {event} {context} />
        {/each}
      </div>
    {/if}
  </div>
</section>
