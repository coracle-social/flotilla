<script lang="ts">
  import {onDestroy, onMount} from "svelte"
  import {derived} from "svelte/store"
  import Link from "@lib/components/Link.svelte"
  import FeedStatus from "@app/components/FeedStatus.svelte"
  import HomeNetworkRecentFilters from "@app/components/HomeNetworkRecentFilters.svelte"
  import NoteEntry from "@app/components/NoteEntry.svelte"
  import {userFollowList, userFollowPubkeys} from "@app/core/user"
  import {PLATFORM_RELAYS} from "@app/core/env"
  import {makeEngagementIndex} from "@app/features/engagement"
  import {
    includedNoteFacets,
    makeEngagedSource,
    makeNoteFeed,
    makeNotesSource,
  } from "@app/features/social"

  const engagement = makeEngagementIndex({withReplies: true})

  const notes = makeNotesSource({onEvent: engagement.add, pubkeys: userFollowPubkeys})

  // Interactions is asked for once its facet is first shown, and keeps flowing once it has been.
  let engagedAsked = false

  const engagedPubkeys = derived([userFollowPubkeys, includedNoteFacets], ([$pubkeys, $facets]) => {
    if ($facets.includes("engaged")) {
      engagedAsked = true
    }

    return engagedAsked ? $pubkeys : []
  })

  const engaged = makeEngagedSource({pubkeys: engagedPubkeys})

  const feed = makeNoteFeed({sources: [notes, engaged], included: includedNoteFacets})

  const {counts, entries, loading, status} = feed

  const follows = $derived($userFollowList?.pubkeys())

  const isEmpty = $derived(follows?.length === 0 || $status === "empty")

  let element: HTMLElement | undefined = $state()

  onMount(() => {
    feed.start(element!)
  })

  onDestroy(() => {
    feed.stop()
    engagement.stop()
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
    {:else if $status === "filtered"}
      <div class="pb-4 text-center font-medium">Nothing matches those filters</div>
    {:else}
      {#each $entries as entry (entry.key)}
        <NoteEntry {entry} {engagement} />
      {/each}
      <FeedStatus
        status={$status}
        loading={$loading}
        emptyMessage="Follow a few people to fill this out"
        loadingMessage="Loading recent posts..." />
    {/if}
  </div>
</div>
