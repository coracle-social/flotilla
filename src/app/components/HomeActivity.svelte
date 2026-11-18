<script lang="ts">
  import {onMount} from "svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import {createScroller} from "@lib/html"
  import HomeActivityFilters from "@app/components/HomeActivityFilters.svelte"
  import HomeActivityItem from "@app/components/HomeActivityItem.svelte"
  import HomeActivityItemSpace from "@app/components/HomeActivityItemSpace.svelte"
  import HomeActivityNote from "@app/components/HomeActivityNote.svelte"
  import {activityLoaded} from "@app/areas/home/activity/sync"
  import {
    activityCounts,
    activityItems,
    activityUnread,
    readActivity,
  } from "@app/areas/home/activity/stream"

  // Something is waiting and the filters are what is keeping it off the screen.
  const hidden = $derived(
    $activityItems.length === 0 && [...$activityCounts.values()].some(count => count > 0),
  )

  let element: HTMLElement | undefined = $state()

  // A month of notes can run to hundreds of rows, so they render a page at a time as the reader nears the end.
  let limit = $state(30)

  // Anything that lands while the stream is showing has been read by the time it is drawn.
  $effect(() => {
    if ($activityUnread) {
      readActivity()
    }
  })

  onMount(() => {
    const scroller = createScroller({
      element: element!,
      delay: 300,
      onScroll: () => {
        limit += 30
      },
    })

    return () => scroller.stop()
  })
</script>

<div
  bind:this={element}
  class="flex flex-col divide-y divide-line border-t border-line bg-surface-less">
  <div class="px-4 py-3">
    <HomeActivityFilters />
  </div>
  {#each $activityItems.slice(0, limit) as item (item.key)}
    {#if item.type === "chat"}
      <HomeActivityItem {item} />
    {:else if item.type === "space"}
      <HomeActivityItemSpace {item} />
    {:else}
      <div class="p-4">
        <HomeActivityNote {item} />
      </div>
    {/if}
  {/each}
  {#if hidden}
    <div class="px-4 py-12 text-center font-medium">Nothing matches those filters</div>
  {:else if $activityItems.length === 0 && !$activityLoaded}
    <div class="flex justify-center px-4 py-12">
      <Spinner loading />
    </div>
  {:else if $activityItems.length === 0}
    <div class="flex flex-col items-center gap-3 px-4 py-12 text-center">
      <p class="font-medium">You're all caught up</p>
      <p class="max-w-md text-sm opacity-75">
        Your rooms, chats and direct messages collect here, with replies and reactions to your
        notes.
      </p>
    </div>
  {/if}
</div>
