<script lang="ts">
  import {onDestroy, onMount} from "svelte"
  import {page} from "$app/stores"
  import {sleep} from "@welshman/lib"
  import type {MakeNonOptional} from "@welshman/lib"
  import {POLL, POLL_RESPONSE, getCommentFiltersForRoot} from "@welshman/util"
  import {deriveEventsAsc} from "@welshman/store"
  import SortVertical from "@assets/icons/sort-vertical.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import PageContent from "@lib/components/PageContent.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import Button from "@lib/components/Button.svelte"
  import SpaceBar from "@app/components/SpaceBar.svelte"
  import NoteCard from "@app/components/NoteCard.svelte"
  import NoteContent from "@app/components/NoteContent.svelte"
  import CommentActions from "@app/components/CommentActions.svelte"
  import EventReply from "@app/components/EventReply.svelte"
  import {network} from "@app/core"
  import {deriveEvent, deriveEventsById} from "@app/repository"
  import {makeFeedContext} from "@app/feeds"
  import {decodeRelay} from "@app/relays"

  const {relay, id} = $page.params as MakeNonOptional<typeof $page.params>
  const url = decodeRelay(relay)
  const context = makeFeedContext({relays: [url]})
  const event = deriveEvent(id, [url])
  const filters = $derived($event ? getCommentFiltersForRoot([$event]) : [])
  const comments = $derived(deriveEventsAsc(deriveEventsById(filters)))

  const back = () => history.back()

  const openReply = () => {
    showReply = true
  }

  const closeReply = () => {
    showReply = false
  }

  const expand = () => {
    showAll = true
  }

  onDestroy(context.cleanup)

  let showAll = $state(false)
  let showReply = $state(false)

  onMount(() => {
    const controller = new AbortController()

    $network.request({
      relays: [url],
      filters: [
        {kinds: [POLL], ids: [id]},
        {kinds: [POLL_RESPONSE], "#e": [id]},
      ],
      signal: controller.signal,
    })

    return () => {
      controller.abort()
    }
  })

  $effect(() => {
    if (filters.length > 0) {
      const controller = new AbortController()

      $network.request({relays: [url], filters, signal: controller.signal})

      return () => controller.abort()
    }
  })
</script>

<SpaceBar {back}>
  {#snippet title()}
    <h1 class="text-xl">{$event?.content || "Poll"}</h1>
  {/snippet}
</SpaceBar>

<PageContent class="flex flex-col gap-2 p-2 sm:gap-4 sm:p-4">
  {#if $event}
    <div class="flex flex-col gap-3">
      <NoteCard event={$event} {url} class="card z-feature w-full">
        <div class="flex flex-col gap-3 ml-12 flex flex-col gap-3">
          <NoteContent showEntire event={$event} {url} />
          <CommentActions showActivity {url} event={$event} {context} />
        </div>
      </NoteCard>
      {#if !showAll && $comments.length > 4}
        <div class="flex justify-center">
          <Button class="button button-link" onclick={expand}>
            <Icon icon={SortVertical} />
            Show all {$comments.length} comments
          </Button>
        </div>
      {/if}
      {#each $comments.slice(0, showAll ? undefined : 4) as reply (reply.id)}
        <NoteCard event={reply} {url} class="card z-feature w-full">
          <div class="flex flex-col gap-3 ml-12">
            <NoteContent showEntire event={reply} {url} />
            <CommentActions event={reply} {url} {context} />
          </div>
        </NoteCard>
      {/each}
    </div>
    {#if showReply}
      <EventReply {url} event={$event} onClose={closeReply} onSubmit={closeReply} />
    {:else}
      <div class="flex justify-end">
        <Button class="button button-primary" onclick={openReply}>Comment on this poll</Button>
      </div>
    {/if}
  {:else}
    <div class="flex justify-center py-20">
      {#await sleep(5000)}
        <Spinner loading>Loading poll...</Spinner>
      {:then}
        <p>Failed to load poll.</p>
      {/await}
    </div>
  {/if}
</PageContent>
