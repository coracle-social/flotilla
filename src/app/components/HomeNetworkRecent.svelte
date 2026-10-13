<script lang="ts">
  import {onDestroy} from "svelte"
  import Link from "@lib/components/Link.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import HomeNetworkRecentFilters from "@app/components/HomeNetworkRecentFilters.svelte"
  import HomeNetworkRecentItem from "@app/components/HomeNetworkRecentItem.svelte"
  import {user} from "@app/core/app"
  import {followLists} from "@app/core/plugins"
  import {countNetworkFeedTypes, makeNetworkFeed} from "@app/features/social"

  const feed = makeNetworkFeed()

  const {context, candidates, items, entries, loading, exhausted} = feed

  const followList = $derived($followLists.one($user.pubkey))
  const follows = $derived($followList?.pubkeys())

  let element: HTMLElement | undefined = $state()
  let started = false

  const isEmpty = $derived(follows?.length === 0 || ($exhausted && $candidates.length === 0))
  const hidden = $derived($items.length === 0 && $candidates.length > 0)

  // The follow list is what the feed is made of, and follows added later don't rebuild it.
  $effect(() => {
    if (!started && element && follows && follows.length > 0) {
      started = true
      feed.start(element, follows)
    }
  })

  onDestroy(feed.stop)
</script>

<div class="flex flex-col gap-3 border-t border-line bg-surface-less p-4" bind:this={element}>
  <HomeNetworkRecentFilters counts={countNetworkFeedTypes($candidates)} />
  {#if isEmpty}
    <div class="flex flex-col items-center gap-3 pb-4 text-center">
      <p class="font-medium">Follow a few people to fill this out</p>
      <p class="max-w-md text-sm opacity-75">
        Posts from the people you follow collect here. Spaces are a good place to find some.
      </p>
      <Link href="/spaces" class="button button-neutral button-sm">Browse spaces</Link>
    </div>
  {:else if $entries.length > 0}
    {#each $entries as entry (entry.ref.id)}
      <HomeNetworkRecentItem {entry} {context} />
    {/each}
    {#if $loading}
      <div class="flex justify-center py-8">
        <Spinner loading />
      </div>
    {/if}
  {:else if hidden}
    <div class="pb-4 text-center font-medium">Nothing matches those filters</div>
  {:else}
    <div class="flex justify-center py-8">
      <Spinner loading>Loading recent posts...</Spinner>
    </div>
  {/if}
</div>
