<script lang="ts">
  import {onDestroy, onMount} from "svelte"
  import {readable} from "svelte/store"
  import type {Readable} from "svelte/store"
  import {sortBy, groupBy} from "@welshman/lib"
  import type {Maybe} from "@welshman/lib"
  import type {TrustedEvent} from "@welshman/util"
  import {THREAD} from "@welshman/util"
  import {Thread} from "@welshman/domain"
  import NotesMinimalistic from "@assets/icons/notes-minimalistic.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import PageContent from "@lib/components/PageContent.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import SpaceBar from "@app/components/SpaceBar.svelte"
  import ThreadBoard from "@app/components/ThreadBoard.svelte"
  import {reader} from "@app/core/domain"
  import {decodeRelay} from "@app/core/relays"
  import {displayRoom} from "@app/features/rooms"
  import {makeCommentFilter, partitionByActivity} from "@app/features/content"
  import {isFeedLoading, makeFeed, makeFeedContext, makeScrollLoader} from "@app/features/feeds"
  import type {PageProps} from "./$types"

  const {params}: PageProps = $props()

  const url = decodeRelay(params.relay)
  const context = makeFeedContext({relays: [url]})

  onDestroy(context.cleanup)

  let older: Maybe<ReturnType<typeof makeScrollLoader>> = $state()

  const loading = $derived(isFeedLoading($older))
  const exhausted = $derived($older?.status === "exhausted")
  let element: HTMLElement | undefined = $state()
  let events: Readable<TrustedEvent[]> = $state(readable([]))

  const threadFeed = $derived.by(() => {
    const {items} = partitionByActivity(THREAD, $events)
    const grouped = groupBy(e => reader(Thread)(e).room() || "", items)
    const byRoom = new Map<string, TrustedEvent[]>([["", []], ...grouped])
    const roomName = (h: string) => (h ? displayRoom(url, h) : "general").toLowerCase()
    const boards = sortBy(([h]) => roomName(h), Array.from(byRoom.entries()))

    return {items, boards}
  })

  onMount(() => {
    const feed = makeFeed({
      relays: [url],
      onEvent: context.add,
      filters: [{kinds: [THREAD]}, makeCommentFilter([THREAD])],
    })

    events = feed.events

    // These lists are newest first, so the bottom is the oldest thing loaded.
    older = makeScrollLoader(element!, feed.loadOlder)

    return () => {
      older?.stop()
      feed.cleanup()
    }
  })
</script>

<SpaceBar>
  {#snippet leading()}
    <Icon icon={NotesMinimalistic} />
  {/snippet}
  {#snippet title()}
    <strong>Threads</strong>
  {/snippet}
</SpaceBar>

<PageContent bind:element class="flex flex-col gap-2 p-2 sm:gap-4 sm:p-4">
  {#each threadFeed.boards as [h, threads] (h)}
    <ThreadBoard {url} {h} {threads} {context} />
  {/each}
  <p class="flex h-10 items-center justify-center py-20">
    <Spinner {loading}>
      {#if loading}
        Looking for threads...
      {:else if exhausted && threadFeed.items.length === 0}
        No threads found.
      {/if}
    </Spinner>
  </p>
</PageContent>
