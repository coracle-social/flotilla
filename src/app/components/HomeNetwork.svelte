<script lang="ts">
  import {onDestroy} from "svelte"
  import {writable} from "svelte/store"
  import type {Writable} from "svelte/store"
  import {sortBy} from "@welshman/lib"
  import type {Maybe} from "@welshman/lib"
  import {NOTE, outbox} from "@welshman/util"
  import type {TrustedEvent} from "@welshman/util"
  import {getReplyTags} from "@welshman/domain"
  import Planet from "@assets/icons/planet.svg?dataurl"
  import Link from "@lib/components/Link.svelte"
  import Masonry from "@lib/components/Masonry.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import HomeSection from "@app/components/HomeSection.svelte"
  import NoteItem from "@app/components/NoteItem.svelte"
  import {followLists, relayLists, router, user} from "@app/core"
  import {isFeedLoading, makeFeed, makeFeedContext, makeScrollLoader} from "@app/feeds"

  // The hubs most of the user's follows publish to, which is the same set and the same limit
  // `syncFollowNetwork` reads their lists from.
  const RELAY_LIMIT = 8

  const context = makeFeedContext({relays: $relayLists.readUrls($user.pubkey).get()})

  const followList = $derived($followLists.one($user.pubkey))
  const follows = $derived($followList?.pubkeys())

  let element: HTMLElement | undefined = $state()
  let older: Maybe<ReturnType<typeof makeScrollLoader>> = $state()
  let events: Writable<TrustedEvent[]> = $state(writable([]))
  let started = false
  let stop: Maybe<() => void>

  // Replies are left out - without their parent they read as half a conversation.
  const notes = $derived(
    sortBy(
      e => -e.created_at,
      $events.filter(e => getReplyTags(e.tags).replies.length === 0),
    ),
  )

  const loading = $derived(isFeedLoading($older))
  const exhausted = $derived($older?.status === "exhausted")
  const isEmpty = $derived(follows?.length === 0 || (exhausted && notes.length === 0))

  const start = async (pubkeys: string[]) => {
    const scenario = await $router.resolve(pubkeys.map(pubkey => outbox(pubkey)))
    const feed = makeFeed({
      relays: scenario.limit(RELAY_LIMIT).getUrls(),
      filters: [{kinds: [NOTE], authors: pubkeys}],
      onEvent: context.add,
    })

    events = feed.events
    older = makeScrollLoader(element!, feed.loadOlder)
    stop = () => {
      older?.stop()
      feed.cleanup()
    }
  }

  // The follow list is what the feed is made of, so it waits for one rather than asking about
  // nobody. Follows added later don't rebuild it - the feed keeps what is already on screen.
  $effect(() => {
    if (!started && follows && follows.length > 0) {
      started = true
      start(follows)
    }
  })

  onDestroy(() => {
    stop?.()
    context.cleanup()
  })
</script>

<HomeSection title="Network" icon={Planet}>
  <div class="flex flex-col gap-3 px-4 pb-4" bind:this={element}>
    {#if isEmpty}
      <div class="flex flex-col items-center gap-3 pb-4 text-center">
        <p class="font-medium">Follow a few people to fill this out</p>
        <p class="max-w-md text-sm opacity-75">
          Notes from the people you follow collect here. Spaces are a good place to find some.
        </p>
        <Link href="/spaces" class="button button-neutral button-sm">Browse spaces</Link>
      </div>
    {:else if notes.length === 0}
      <div class="flex justify-center pb-4">
        <Spinner loading>Looking for notes from people you follow…</Spinner>
      </div>
    {:else}
      <Masonry items={notes} getKey={event => event.id} columnWidth={80} maxColumns={2} gap={3}>
        {#snippet child(event)}
          <NoteItem {event} {context} />
        {/snippet}
      </Masonry>
      {#if loading}
        <div class="flex justify-center py-4">
          <Spinner loading />
        </div>
      {/if}
    {/if}
  </div>
</HomeSection>
