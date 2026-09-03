<script lang="ts">
  import {onDestroy} from "svelte"
  import {derived} from "svelte/store"
  import {page} from "$app/stores"
  import {sortBy, sleep} from "@welshman/lib"
  import type {MakeNonOptional} from "@welshman/lib"
  import {getCommentFiltersForRoot} from "@welshman/util"
  import {TimeEvent} from "@welshman/domain"
  import SortVertical from "@assets/icons/sort-vertical.svg?dataurl"
  import Reply from "@assets/icons/reply-2.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import PageContent from "@lib/components/PageContent.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import Button from "@lib/components/Button.svelte"
  import SpaceBar from "@app/components/SpaceBar.svelte"
  import Content from "@app/components/Content.svelte"
  import NoteContent from "@app/components/NoteContent.svelte"
  import NoteCard from "@app/components/NoteCard.svelte"
  import CalendarEventActions from "@app/components/CalendarEventActions.svelte"
  import CommentActions from "@app/components/CommentActions.svelte"
  import CalendarEventHeader from "@app/components/CalendarEventHeader.svelte"
  import CalendarEventMeta from "@app/components/CalendarEventMeta.svelte"
  import CalendarEventDate from "@app/components/CalendarEventDate.svelte"
  import EventReply from "@app/components/EventReply.svelte"
  import {network, reader} from "@app/core"
  import {deriveEvent, deriveEvents} from "@app/repository"
  import {makeFeedContext} from "@app/feeds"
  import {decodeRelay} from "@app/relays"

  const {relay, address} = $page.params as MakeNonOptional<typeof $page.params>
  const url = decodeRelay(relay)
  const context = makeFeedContext({relays: [url]})
  const event = deriveEvent(address, [url])
  const timeEvent = derived(event, $event => ($event ? reader(TimeEvent)($event) : undefined))
  const filters = $derived($event ? getCommentFiltersForRoot([$event]) : [])
  const replies = $derived(deriveEvents(filters))

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
    <h1 class="text-xl">{$timeEvent?.title() ?? ""}</h1>
  {/snippet}
</SpaceBar>

<PageContent class="flex flex-col gap-2 p-2 sm:gap-4 sm:p-4">
  {#if $event}
    <div class="card flex flex-col gap-3 z-feature">
      <div class="flex items-start gap-4">
        <CalendarEventDate event={$event} />
        <div class="flex min-w-0 grow flex-col gap-1">
          <CalendarEventHeader event={$event} />
          <CalendarEventMeta event={$event} {url} />
          <div class="flex py-2 opacity-50">
            <div class="h-px grow opacity-25" style="background-color: var(--line)"></div>
          </div>
          <Content showEntire event={$event} {url} />
        </div>
      </div>
      <div class="flex w-full flex-col justify-end sm:flex-row">
        <CalendarEventActions showRoom {url} event={$event} {context} />
      </div>
    </div>
    {#if !showAll && $replies.length > 4}
      <div class="flex justify-center">
        <Button class="button button-link" onclick={expand}>
          <Icon icon={SortVertical} />
          Show all {$replies.length} replies
        </Button>
      </div>
    {/if}
    {#each sortBy(e => e.created_at, $replies).slice(0, showAll ? undefined : 4) as reply (reply.id)}
      <NoteCard event={reply} {url} class="card z-feature w-full">
        <div class="flex flex-col gap-3 ml-12">
          <NoteContent showEntire event={reply} {url} />
          <CommentActions event={reply} {url} {context} />
        </div>
      </NoteCard>
    {/each}
    {#if showReply}
      <EventReply {url} event={$event} onClose={closeReply} onSubmit={closeReply} />
    {:else}
      <div class="flex justify-end px-2 pb-2">
        <Button class="button button-primary" onclick={openReply}>
          <Icon icon={Reply} />
          Leave comment
        </Button>
      </div>
    {/if}
  {:else}
    <div class="flex justify-center py-20">
      {#await sleep(5000)}
        <Spinner loading>Loading event...</Spinner>
      {:then}
        <p>Failed to load event.</p>
      {/await}
    </div>
  {/if}
</PageContent>
