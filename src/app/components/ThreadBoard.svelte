<script lang="ts">
  import type {TrustedEvent} from "@welshman/util"
  import {WEEK, sortBy, uniq} from "@welshman/lib"
  import {tagValues, topicTags} from "@welshman/util"
  import Link from "@lib/components/Link.svelte"
  import RoomNameWithImage from "@app/components/RoomNameWithImage.svelte"
  import {normalizeTopic} from "@lib/util"
  import {rooms} from "@app/core/plugins"
  import {displayRoom} from "@app/features/spaces/rooms"
  import * as pages from "@app/navigation/pages"

  type Props = {
    url: string
    h: string
    threads: TrustedEvent[]
  }

  const {url, h, threads}: Props = $props()
  const boardPath = $derived(
    pages.threads.path({url}) + (h ? `?board=${encodeURIComponent(h)}` : "?board="),
  )

  const room = $rooms.forRoom(url, h)
  const description = $derived($room?.meta?.about() ?? "")
  const boardName = $derived(h ? displayRoom(url, h) : "General")
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

<section class="card card-interactive card-flat relative p-0">
  <Link
    href={boardPath}
    aria-label={`View the ${boardName} board`}
    class="absolute inset-0 cursor-pointer rounded-3xl" />
  <div class="pointer-events-none relative flex w-full items-start justify-between gap-2 px-4 py-3">
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
  </div>
</section>
