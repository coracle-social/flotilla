<script lang="ts">
  import {onDestroy, onMount} from "svelte"
  import {readable} from "svelte/store"
  import type {Readable} from "svelte/store"
  import {sortBy, groupBy} from "@welshman/lib"
  import type {Maybe} from "@welshman/lib"
  import type {TrustedEvent} from "@welshman/util"
  import {THREAD} from "@welshman/util"
  import {Thread} from "@welshman/domain"
  import {page} from "$app/stores"
  import NotesMinimalistic from "@assets/icons/notes-minimalistic.svg?dataurl"
  import Add from "@assets/icons/add.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import PageContent from "@lib/components/PageContent.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import {makeCommentFilter} from "@lib/util"
  import SpaceBar from "@app/components/SpaceBar.svelte"
  import ThreadBoard from "@app/components/ThreadBoard.svelte"
  import ThreadCreate from "@app/components/ThreadCreate.svelte"
  import ThreadLatest from "@app/components/ThreadLatest.svelte"
  import ThreadLatestItem from "@app/components/ThreadLatestItem.svelte"
  import {reader} from "@app/core/domain"
  import * as pages from "@app/navigation/pages"
  import {displayRoom} from "@app/features/spaces/rooms"
  import {partitionByActivity} from "@app/features/spaces"
  import {isFeedLoading, makeFeed, makeFeedContext, makeScrollLoader} from "@app/features/feeds"
  import {pushModal} from "@app/navigation/dialogs"
  import type {PageProps} from "./$types"

  const {params}: PageProps = $props()

  const {url} = pages.threads.decode(params)
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

  // The board a board card opened, named as a query so the same page shows
  // that board's topics alone, most recent activity first.
  const board = $derived($page.url.searchParams.get("board") ?? undefined)
  const inBoard = $derived(board !== undefined)
  const back = () => history.back()
  const boardName = $derived(board === "" ? "General" : board ? displayRoom(url, board) : "")
  const boardItems = $derived(
    inBoard ? threadFeed.items.filter(e => (reader(Thread)(e).room() || "") === board) : [],
  )

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

<SpaceBar back={inBoard ? back : undefined}>
  {#snippet leading()}
    <Icon icon={NotesMinimalistic} />
  {/snippet}
  {#snippet title()}
    <strong>{inBoard ? boardName : "Threads"}</strong>
  {/snippet}
  {#snippet action()}
    <Button
      class="button button-primary button-sm"
      onclick={() => pushModal(ThreadCreate, {url, h: board ?? undefined})}>
      <Icon icon={Add} />
      New topic
    </Button>
  {/snippet}
</SpaceBar>

<PageContent bind:element noPad={inBoard} class={inBoard ? "flex flex-col" : "p-2 sm:p-4"}>
  {#if inBoard}
    <div class="bg-surface border-y border-line">
      {#if boardItems.length === 0}
        <p class="text-content-muted p-4 text-sm">No topics yet in this board.</p>
      {:else}
        {#each boardItems as event (event.id)}
          <ThreadLatestItem {url} {event} {context} showRoom={false} />
        {/each}
      {/if}
    </div>
  {:else}
    <div class="grid items-start gap-2 sm:gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <div class="flex flex-col gap-2 sm:gap-4">
        {#each threadFeed.boards as [h, threads] (h)}
          <ThreadBoard {url} {h} {threads} />
        {/each}
      </div>
      <ThreadLatest {url} items={threadFeed.items} {context} />
    </div>
  {/if}
  <p class="flex h-10 items-center justify-center py-20">
    <Spinner {loading}>
      {#if loading}
        Looking for threads...
      {:else if exhausted && (inBoard ? boardItems.length : threadFeed.items.length) === 0}
        No threads found.
      {/if}
    </Spinner>
  </p>
</PageContent>
