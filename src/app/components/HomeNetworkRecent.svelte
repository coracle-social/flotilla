<script lang="ts">
  import {onDestroy} from "svelte"
  import {SvelteMap} from "svelte/reactivity"
  import {
    chunks,
    call,
    indexBy,
    removeUndefined,
    shuffle,
    sortBy,
    take,
    uniqBy,
  } from "@welshman/lib"
  import type {Maybe} from "@welshman/lib"
  import {NOTE, getIdOrAddress} from "@welshman/util"
  import type {TrustedEvent} from "@welshman/util"
  import {createScroller} from "@lib/html"
  import Link from "@lib/components/Link.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import HomeNetworkRecentFilters from "@app/components/HomeNetworkRecentFilters.svelte"
  import HomeNetworkRecentItem from "@app/components/HomeNetworkRecentItem.svelte"
  import {CONTENT_KINDS} from "@app/content"
  import {followLists, relayLists, user} from "@app/core"
  import {isFeedLoading, makeFeed, makeFeedContext, makeScrollLoader} from "@app/feeds"
  import type {FeedLoadState} from "@app/feeds"
  import {outboxUrls} from "@app/relays"
  import {
    groupNetworkFeedEvents,
    isEventMuted,
    isIncludedNetworkFeedEvent,
    notes,
  } from "@app/social"

  const context = makeFeedContext({
    relays: $relayLists.readUrls($user.pubkey).get(),
    withReplies: true,
  })

  const followList = $derived($followLists.one($user.pubkey))
  const follows = $derived($followList?.pubkeys())

  let element: HTMLElement | undefined = $state()
  let pages = $state<TrustedEvent[][]>([])
  let states = $state<FeedLoadState[]>([])
  let drawn = $state<string[]>([])
  let admitting = false
  let started = false
  let destroyed = false
  const anchors = new SvelteMap<string, Maybe<TrustedEvent>>()
  const unsubscribers: (() => void)[] = []

  const candidates = $derived(
    uniqBy(
      getIdOrAddress,
      sortBy(
        e => -e.created_at,
        pages.flat().filter(e => !$isEventMuted(e)),
      ),
    ),
  )

  const items = $derived(candidates.filter($isIncludedNetworkFeedEvent))

  const entries = $derived(groupNetworkFeedEvents(items))

  const entryByRef = $derived(indexBy(entry => entry.ref.id, entries))

  // Drawn entries keep the order they were drawn in, so nothing already on screen moves.
  const shown = $derived(removeUndefined(drawn.map(ref => entryByRef.get(ref))))

  // What the feed holds and has not drawn, newest first. An entry waits here for its note.
  const buffer = $derived(entries.filter(entry => !anchors.has(entry.ref.id)))

  const loading = $derived(states.some(isFeedLoading))
  const exhausted = $derived(
    states.length > 0 && states.every(state => state.status === "exhausted"),
  )
  const isEmpty = $derived(follows?.length === 0 || (exhausted && candidates.length === 0))
  const hidden = $derived(items.length === 0 && candidates.length > 0)

  // Every entry's note is in hand before it is drawn, so no card gains one above it afterwards.
  const admit = async () => {
    if (!admitting && buffer.length > 0) {
      admitting = true

      try {
        const batch = take(10, buffer)

        await Promise.all(
          batch.map(async entry =>
            anchors.set(
              entry.ref.id,
              entry.note ?? (await $notes.loadParent(entry.ref, entry.replies)),
            ),
          ),
        )

        drawn = [...drawn, ...batch.map(entry => entry.ref.id)]
      } finally {
        admitting = false
      }
    }
  }

  // Each group walks its own timeline, so a slow group holds up nobody else's next page.
  const startGroup = async (pubkeys: string[], index: number) => {
    const relays = await outboxUrls(pubkeys, 10)

    if (!destroyed) {
      const feed = makeFeed({
        relays,
        // Half the group's relays answering is enough to show its page, since the rest get asked again.
        threshold: 0.5,
        useCache: false,
        filters: [{kinds: [NOTE, ...CONTENT_KINDS], authors: pubkeys}],
        onEvent: context.add,
      })

      const loader = makeScrollLoader(element!, feed.loadOlder)

      unsubscribers.push(
        feed.events.subscribe(events => {
          pages[index] = events
        }),
        loader.subscribe(state => {
          states[index] = state
        }),
        loader.stop,
        feed.cleanup,
      )
    }
  }

  // One selection over every follow lands on the few biggest relays, so each group scores its own.
  const start = (pubkeys: string[]) => {
    const groups = chunks(3, shuffle(pubkeys)).filter(group => group.length > 0)
    const scroller = createScroller({element: element!, delay: 300, onScroll: admit})

    pages = groups.map(() => [])
    states = groups.map(() => ({status: "idle"}))
    groups.forEach(startGroup)
    unsubscribers.push(scroller.stop)
  }

  // The follow list is what the feed is made of, and follows added later don't rebuild it.
  $effect(() => {
    if (!started && follows && follows.length > 0) {
      started = true
      start(follows)
    }
  })

  onDestroy(() => {
    destroyed = true
    unsubscribers.forEach(call)
    context.cleanup()
  })
</script>

<div class="flex flex-col gap-3 border-t border-line bg-surface-less p-4" bind:this={element}>
  <HomeNetworkRecentFilters />
  {#if isEmpty}
    <div class="flex flex-col items-center gap-3 pb-4 text-center">
      <p class="font-medium">Follow a few people to fill this out</p>
      <p class="max-w-md text-sm opacity-75">
        Posts from the people you follow collect here. Spaces are a good place to find some.
      </p>
      <Link href="/spaces" class="button button-neutral button-sm">Browse spaces</Link>
    </div>
  {:else if shown.length > 0}
    <!-- A note the feed carries itself still belongs on its card when the load missed it. -->
    {#each shown as entry (entry.ref.id)}
      <HomeNetworkRecentItem {entry} {context} note={anchors.get(entry.ref.id) ?? entry.note} />
    {/each}
    {#if loading || buffer.length > 0}
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
