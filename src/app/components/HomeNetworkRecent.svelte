<script lang="ts">
  import {onDestroy} from "svelte"
  import {derived} from "svelte/store"
  import Link from "@lib/components/Link.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import HomeNetworkRecentFilters from "@app/components/HomeNetworkRecentFilters.svelte"
  import NoteEntry from "@app/components/NoteEntry.svelte"
  import {user} from "@app/core/user"
  import {PLATFORM_RELAYS} from "@app/core/env"
  import {followLists} from "@app/core/plugins"
  import {makeFeedContext} from "@app/features/feeds"
  import {makePopularFeed} from "@app/features/social/popularFeed"
  import {
    countNetworkFeedTypes,
    includePopularNotes,
    isIncludedNetworkFeedEvent,
    makeNetworkFeed,
  } from "@app/features/social/networkFeed"

  const context = makeFeedContext({withReplies: true})

  const popular = makePopularFeed()

  const feed = makeNetworkFeed({
    context,
    isIncluded: isIncludedNetworkFeedEvent,
    // A muted note stays on the tab and reads as a muted card rather than being dropped from it.
    includeMuted: true,
    extra: popular.notes,
    includeExtra: includePopularNotes,
  })

  const {candidates, items, entries, loading, exhausted, extraCount} = feed

  // Popular pages behind the same scroll, so its spinner counts while it is on.
  const spinning = derived(
    [loading, popular.loading, includePopularNotes],
    ([$loading, $popularLoading, $includePopular]) =>
      $loading || ($includePopular && $popularLoading),
  )

  const followList = $derived($followLists.one($user.pubkey))
  const follows = $derived($followList?.pubkeys())

  const togglePopular = () => includePopularNotes.update($includePopular => !$includePopular)

  let element: HTMLElement | undefined = $state()
  let started = false
  let popularStarted = false

  const isEmpty = $derived(
    follows?.length === 0 || ($exhausted && $candidates.length === 0 && !$spinning),
  )
  const hidden = $derived($items.length === 0 && $candidates.length > 0)

  // The follow list is what the feed is made of, and follows added later don't rebuild it.
  $effect(() => {
    if (!started && element && follows && follows.length > 0) {
      started = true
      feed.start(element, follows)
    }
  })

  // Popular asks the same relays what the follows answered, and starts when it is first asked for.
  $effect(() => {
    if ($includePopularNotes && !popularStarted && element && follows && follows.length > 0) {
      popularStarted = true
      popular.start(element, follows)
    }
  })

  onDestroy(() => {
    feed.stop()
    popular.stop()
    context.cleanup()
  })
</script>

<div class="flex flex-col border-t border-line bg-surface-less">
  <div class="border-b border-line px-4 py-3">
    <HomeNetworkRecentFilters
      counts={countNetworkFeedTypes($candidates)}
      popular={$includePopularNotes}
      popularCount={$extraCount}
      onpopular={togglePopular} />
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
      {#if $spinning}
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
