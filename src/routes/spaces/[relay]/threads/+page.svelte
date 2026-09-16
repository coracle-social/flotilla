<script lang="ts">
  import {onDestroy, onMount} from "svelte"
  import {readable} from "svelte/store"
  import type {Readable} from "svelte/store"
  import {sortBy, partition, spec, max, pushToMapKey, groupBy} from "@welshman/lib"
  import type {Maybe} from "@welshman/lib"
  import type {TrustedEvent} from "@welshman/util"
  import {THREAD, tagValue, tagSpec} from "@welshman/util"
  import NotesMinimalistic from "@assets/icons/notes-minimalistic.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import PageContent from "@lib/components/PageContent.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import SpaceBar from "@app/components/SpaceBar.svelte"
  import ThreadBoard from "@app/components/ThreadBoard.svelte"
  import {decodeRelay} from "@app/relays"
  import {displayRoom} from "@app/rooms"
  import {makeCommentFilter} from "@app/content"
  import {isFeedLoading, makeFeed, makeFeedContext, makeScrollLoader} from "@app/feeds"
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
    const scores = new Map<string, number[]>()
    const [threads, comments] = partition(spec({kind: THREAD}), $events)

    for (const comment of comments) {
      const id = tagValue(tagSpec("E"), comment.tags)

      if (id) {
        pushToMapKey(scores, id, comment.created_at)
      }
    }

    const items = sortBy(e => -max([...(scores.get(e.id) || []), e.created_at]), threads)

    const grouped = groupBy(e => tagValue(tagSpec("h"), e.tags) || "", items)
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

    // These lists are sorted newest first, so reaching the bottom is reaching the oldest thing
    // loaded.
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
