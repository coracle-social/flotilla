<script lang="ts">
  import {onDestroy} from "svelte"
  import {derived} from "svelte/store"
  import Link from "@lib/components/Link.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import HomeNetworkRecentFilters from "@app/components/HomeNetworkRecentFilters.svelte"
  import NoteEntry from "@app/components/NoteEntry.svelte"
  import {userFollowList} from "@app/core/user"
  import {PLATFORM_RELAYS} from "@app/core/env"
  import {makeFeedContext} from "@app/features/feeds"
  import {
    includedNetworkFeedTypes,
    makeNoteFeed,
    makeNotesTimeline,
  } from "@app/features/social/noteFeed"
  import {makePopularFeed} from "@app/features/social/popularFeed"

  const context = makeFeedContext({withReplies: true})

  const popularIncluded = derived(includedNetworkFeedTypes, $types => $types.includes("popular"))

  const notes = makeNotesTimeline({onEvent: context.add})

  const popular = makePopularFeed()

  const feed = makeNoteFeed({sources: [notes, popular], included: includedNetworkFeedTypes})

  const {counts, items, entries, loading, exhausted} = feed

  const follows = $derived($userFollowList?.pubkeys())

  const total = $derived(Array.from($counts.values()).reduce((sum, count) => sum + count, 0))
  const anyTypeIncluded = $derived($includedNetworkFeedTypes.length > 0)

  const isEmpty = $derived(
    follows?.length === 0 || ($exhausted && total === 0 && anyTypeIncluded && !$loading),
  )
  const hidden = $derived($items.length === 0 && total > 0 && !$loading)

  let element: HTMLElement | undefined = $state()
  let started = false
  let popularStarted = false

  // The follow list is what the feed is made of, and follows added later don't rebuild it.
  $effect(() => {
    if (!started && element && follows && follows.length > 0) {
      started = true
      notes.start(follows)
      feed.start(element)
    }
  })

  // Popular asks the same relays what the follows answered, and starts when it is first asked for.
  $effect(() => {
    if ($popularIncluded && !popularStarted && follows && follows.length > 0) {
      popularStarted = true
      popular.start(follows)
    }
  })

  onDestroy(() => {
    feed.stop()
    context.cleanup()
  })
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
    {:else if $entries.length > 0}
      {#each $entries as entry (entry.key)}
        <NoteEntry {entry} {context} />
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
</div>
