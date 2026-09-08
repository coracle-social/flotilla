<script lang="ts">
  import {onDestroy, onMount} from "svelte"
  import {sortBy, uniqBy} from "@welshman/lib"
  import {NOTE} from "@welshman/util"
  import type {TrustedEvent} from "@welshman/util"
  import {getReplyTags} from "@welshman/domain"
  import {Feeds} from "@welshman/app"
  import {Scope, feedFromFilter, makeIntersectionFeed, makeScopeFeed} from "@welshman/feeds"
  import Planet from "@assets/icons/planet.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Link from "@lib/components/Link.svelte"
  import Button from "@lib/components/Button.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
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
        events = uniqBy(
          event => event.id,
          sortBy(event => -event.created_at, [...events, event]),
        )
        context.add(event)
      }
    },
  })

  let events = $state<TrustedEvent[]>([])
  let limit = $state(PAGE_SIZE)
  let loading = $state(true)

  const load = () => {
    loading = true
    controller
      .load(PAGE_SIZE * 4)
      .catch(e => console.error(e))
      .finally(() => (loading = false))
  }

  const showMore = () => {
    limit += PAGE_SIZE

    if (events.length < limit + PAGE_SIZE) {
      load()
    }
  }

  onMount(load)
</script>

<div class="card flex flex-col gap-3">
  <strong class="flex items-center gap-2 text-lg">
    <Icon icon={Planet} />
    Network
  </strong>
  {#if events.length === 0}
    {#if loading}
      <div class="flex justify-center py-8">
        <Spinner {loading}>Looking for notes from people you follow…</Spinner>
      </div>
    {:else}
      <div class="flex flex-col items-center gap-3 py-8 text-center">
        <p class="font-medium">Follow a few people to fill this out</p>
        <p class="max-w-md text-sm opacity-75">
          Notes from the people you follow collect here. Spaces are a good place to find some.
        </p>
        <Link href="/spaces" class="button button-neutral button-sm">Browse spaces</Link>
      </div>
    {/if}
  {:else}
    <div class="flex flex-col gap-2">
      {#each events.slice(0, limit) as event (event.id)}
        <NoteItem {event} {context} />
      {/each}
    </div>
    <Button class="button button-neutral button-sm" onclick={showMore}>Show more</Button>
  {/if}
</div>
