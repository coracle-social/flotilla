<script lang="ts">
  import {onDestroy, onMount} from "svelte"
  import {sortBy, uniqBy} from "@welshman/lib"
  import {NOTE} from "@welshman/util"
  import type {TrustedEvent} from "@welshman/util"
  import {getReplyTags} from "@welshman/domain"
  import {Feeds} from "@welshman/app"
  import {Scope, feedFromFilter, makeIntersectionFeed, makeScopeFeed} from "@welshman/feeds"
  import Planet from "@assets/icons/planet.svg?dataurl"
  import {createScroller} from "@lib/html"
  import Link from "@lib/components/Link.svelte"
  import Masonry from "@lib/components/Masonry.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import HomeSection from "@app/components/HomeSection.svelte"
  import NoteItem from "@app/components/NoteItem.svelte"
  import {app, relayLists, user} from "@app/core"
  import {makeFeedContext} from "@app/feeds"

  const PAGE_SIZE = 5

  const context = makeFeedContext({relays: $relayLists.readUrls($user.pubkey).get()})

  onDestroy(context.cleanup)

  // Notes from the people the user follows, resolved against each author's outbox relays.
  // Replies are left out - without their parent they read as half a conversation.
  const controller = $app.use(Feeds).makeFeedController({
    useWindowing: true,
    feed: makeIntersectionFeed(makeScopeFeed(Scope.Follows), feedFromFilter({kinds: [NOTE]})),
    onEvent: (event: TrustedEvent) => {
      if (getReplyTags(event.tags).replies.length === 0) {
        buffer.push(event)
        context.add(event)
      }
    },
  })

  let element: Element | undefined = $state()
  let events = $state<TrustedEvent[]>([])
  let loading = $state(false)
  let caughtUp = $state(false)
  let buffer: TrustedEvent[] = []

  const isEmpty = $derived(caughtUp && events.length === 0)

  const load = async () => {
    if (!loading) {
      loading = true

      try {
        await controller.load(PAGE_SIZE * 4)
      } catch (e) {
        console.error(e)
      } finally {
        loading = false
        caughtUp = buffer.length === 0
      }
    }
  }

  onMount(() => {
    const scroller = createScroller({
      element: element!,
      delay: 300,
      threshold: 3000,
      onScroll: () => {
        buffer = uniqBy(
          e => e.id,
          sortBy(e => -e.created_at, buffer),
        )

        events = uniqBy(e => e.id, [...events, ...buffer.splice(0, PAGE_SIZE)])

        if (buffer.length < PAGE_SIZE * 4) {
          load()
        }
      },
    })

    return scroller.stop
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
    {:else if events.length === 0}
      <div class="flex justify-center pb-4">
        <Spinner loading>Looking for notes from people you follow…</Spinner>
      </div>
    {:else}
      <Masonry items={events} getKey={event => event.id} columnWidth={80} maxColumns={2} gap={3}>
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
