<script lang="ts">
  import {onDestroy, onMount} from "svelte"
  import {followScroll} from "@lib/pager"
  import Link from "@app/components/Link.svelte"
  import HomeNetworkRecentFilters from "@app/components/HomeNetworkRecentFilters.svelte"
  import NoteEntry from "@app/components/NoteEntry.svelte"
  import NoteFeedFooter from "@app/components/NoteFeedFooter.svelte"
  import {PLATFORM_RELAYS} from "@app/core/env"
  import {userFollowList} from "@app/core/user"
  import {makeNetworkFeed} from "@app/features/feeds"

  const feed = makeNetworkFeed()

  const {counts, entries, loading, status} = feed

  const follows = $derived($userFollowList?.pubkeys())

  const isEmpty = $derived(follows?.length === 0 || $status === "empty")

  let element: HTMLElement | undefined = $state()

  onMount(() => followScroll(element!, feed.older, {threshold: 2000}))

  onDestroy(feed.stop)
</script>

<div class="flex flex-col border-t border-line bg-surface-less">
  <div class="border-b border-line px-4 py-3">
    <HomeNetworkRecentFilters counts={$counts} />
  </div>
  <div class="flex flex-col gap-3 p-4" bind:this={element}>
    {#if isEmpty}
      <div class="flex flex-col items-center gap-3 pb-4 text-center">
        <p class="font-medium">Follow a few people to fill this out</p>
        <p class="max-w-md text-sm opacity-75">
          Posts from the people you follow collect here. Spaces are a good place to find some.
        </p>
        {#if PLATFORM_RELAYS.length === 0}
          <Link href="/spaces" class="button button-neutral button-sm">Browse spaces</Link>
        {/if}
      </div>
    {:else if $status === "filtered"}
      <div class="pb-4 text-center font-medium">Nothing matches those filters</div>
    {:else}
      {#each $entries as entry (entry.key)}
        <NoteEntry {entry} />
      {/each}
      <NoteFeedFooter
        status={$status}
        loading={$loading}
        emptyMessage="Follow a few people to fill this out"
        loadingMessage="Loading recent posts..." />
    {/if}
  </div>
</div>
