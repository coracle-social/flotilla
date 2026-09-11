<script lang="ts">
  import {onDestroy, onMount} from "svelte"
  import {writable} from "svelte/store"
  import type {Readable} from "svelte/store"
  import {sortBy, uniqBy, now} from "@welshman/lib"
  import type {Maybe} from "@welshman/lib"
  import {NOTE, outbox} from "@welshman/util"
  import type {TrustedEvent} from "@welshman/util"
  import {getReplyTags} from "@welshman/domain"
  import {fly} from "@lib/transition"
  import Spinner from "@lib/components/Spinner.svelte"
  import NoteItem from "@app/components/NoteItem.svelte"
  import {router} from "@app/core"
  import {isFeedLoading, makeFeed, makeFeedContext, makeScrollLoader} from "@app/feeds"
  import {derivePinnedEvents} from "@app/pins"

  type Props = {
    pubkey: string
  }

  const {pubkey}: Props = $props()

  const relays = $router.resolver.relays([outbox(pubkey)])
  const context = makeFeedContext({relays})

  onDestroy(context.cleanup)

  const pinnedEvents = derivePinnedEvents(pubkey)

  const pinnedIds = $derived($pinnedEvents.map(e => e.id))

  let element: HTMLElement | undefined = $state()
  let older: Maybe<ReturnType<typeof makeScrollLoader>> = $state()

  const exhausted = $derived($older?.status === "exhausted")
  const loading = $derived(isFeedLoading($older))
  let events: Readable<TrustedEvent[]> = $state(writable([]))

  const feedEvents = $derived(
    sortBy(
      e => (pinnedIds.includes(e.id) ? -(now() + e.created_at) : -e.created_at),
      uniqBy(e => e.id, [...$pinnedEvents, ...$events]).filter(
        e => getReplyTags(e.tags).replies.length === 0,
      ),
    ),
  )

  onMount(() => {
    let cleanup: (() => void) | undefined

    relays.then($relays => {
      const feed = makeFeed({
        relays: $relays,
        filters: [{kinds: [NOTE], authors: [pubkey]}],
        onEvent: context.add,
      })

      events = feed.events

      older = makeScrollLoader(element!, feed.loadOlder)

      cleanup = () => {
        older?.stop()
        feed.cleanup()
      }
    })

    return () => cleanup?.()
  })
</script>

<div class="flex flex-col gap-4" bind:this={element}>
  {#each feedEvents as event (event.id)}
    <div in:fly>
      <NoteItem {event} {context} />
    </div>
  {:else}
    {#if exhausted}
      <p class="py-12 text-center text-sm opacity-75">No notes found for this profile.</p>
    {/if}
  {/each}
  {#if loading}
    <p class="my-12 flex items-center justify-center gap-2">
      <Spinner loading />
      Loading notes...
    </p>
  {/if}
</div>
