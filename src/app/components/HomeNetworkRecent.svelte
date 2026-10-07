<script lang="ts">
  import {onDestroy} from "svelte"
  import {chunks, call, shuffle, sortBy, uniqBy} from "@welshman/lib"
  import {NOTE, getIdOrAddress} from "@welshman/util"
  import type {TrustedEvent} from "@welshman/util"
  import {getReplyTags} from "@welshman/domain"
  import Link from "@lib/components/Link.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import NoteItem from "@app/components/NoteItem.svelte"
  import {CONTENT_KINDS} from "@app/content"
  import {followLists, relayLists, user} from "@app/core"
  import {isFeedLoading, makeFeed, makeFeedContext, makeScrollLoader} from "@app/feeds"
  import type {FeedLoadState} from "@app/feeds"
  import {outboxUrls} from "@app/relays"

  const context = makeFeedContext({
    relays: $relayLists.readUrls($user.pubkey).get(),
    withReplies: true,
  })

  const followList = $derived($followLists.one($user.pubkey))
  const follows = $derived($followList?.pubkeys())

  let element: HTMLElement | undefined = $state()
  let pages = $state<TrustedEvent[][]>([])
  let states = $state<FeedLoadState[]>([])
  let started = false
  let destroyed = false
  const unsubscribers: (() => void)[] = []

  // Kind 1 replies read as half a conversation without their parent.
  const isRoot = (event: TrustedEvent) =>
    event.kind !== NOTE || getReplyTags(event.tags).replies.length === 0

  const items = $derived(
    uniqBy(
      getIdOrAddress,
      sortBy(e => -e.created_at, pages.flat().filter(isRoot)),
    ),
  )

  const loading = $derived(states.some(isFeedLoading))
  const exhausted = $derived(
    states.length > 0 && states.every(state => state.status === "exhausted"),
  )
  const isEmpty = $derived(follows?.length === 0 || (exhausted && items.length === 0))

  // Each group walks its own timeline, so a slow group holds up nobody else's next page.
  const startGroup = async (pubkeys: string[], index: number) => {
    const relays = await outboxUrls(pubkeys, 10)

    if (!destroyed) {
      const feed = makeFeed({
        relays,
        // Half the group's relays answering is enough to show its page, since the rest get asked again.
        threshold: 0.5,
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

    pages = groups.map(() => [])
    states = groups.map(() => ({status: "idle"}))
    groups.forEach(startGroup)
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
  {#if isEmpty}
    <div class="flex flex-col items-center gap-3 pb-4 text-center">
      <p class="font-medium">Follow a few people to fill this out</p>
      <p class="max-w-md text-sm opacity-75">
        Posts from the people you follow collect here. Spaces are a good place to find some.
      </p>
      <Link href="/spaces" class="button button-neutral button-sm">Browse spaces</Link>
    </div>
  {:else if items.length === 0}
    <div class="flex justify-center py-8">
      <Spinner loading>Loading recent posts...</Spinner>
    </div>
  {:else}
    {#each items as event (event.id)}
      <NoteItem {event} {context} showReply />
    {/each}
    {#if loading}
      <div class="flex justify-center py-8">
        <Spinner loading />
      </div>
    {/if}
  {/if}
</div>
