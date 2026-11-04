<script lang="ts">
  import type {TrustedEvent} from "@welshman/util"
  import {WEEK, sortBy, uniq} from "@welshman/lib"
  import {tagValues, topicTags} from "@welshman/util"
  import Add from "@assets/icons/add.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import RoomNameWithImage from "@app/components/RoomNameWithImage.svelte"
  import ThreadBoardItem from "@app/components/ThreadBoardItem.svelte"
  import ThreadCreate from "@app/components/ThreadCreate.svelte"
  import {normalizeTopic} from "@lib/util"
  import {rooms} from "@app/core/plugins"
  import type {FeedContext} from "@app/features/feeds"
  import {pushModal} from "@app/navigation/dialogs"

  type Props = {
    url: string
    h: string
    threads: TrustedEvent[]
    context: FeedContext
  }

  const {url, h, threads, context}: Props = $props()

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

  const createThread = () => pushModal(ThreadCreate, {url, h})
</script>

<section class="card card-flat p-0">
  <header
    class="flex items-center justify-between gap-2 border-b border-solid border-line px-4 py-3">
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
    <div class="flex shrink-0 flex-col items-end gap-2">
      <span class="text-content-muted whitespace-nowrap text-sm">
        {topicsThisWeek} / week
      </span>
      <Button class="button button-primary button-sm" onclick={createThread}>
        <Icon icon={Add} />
        Create
      </Button>
    </div>
  </header>
  <!-- The board's own rows only on mobile, where the Latest panel is hidden. -->
  <div class="lg:hidden">
    {#if threads.length === 0}
      <p class="text-content-muted p-4 text-sm">No topics yet.</p>
    {:else}
      <div class="pb-4">
        {#each threads as event (event.id)}
          <ThreadBoardItem stacked {url} {event} {context} />
        {/each}
      </div>
    {/if}
  </div>
</section>
