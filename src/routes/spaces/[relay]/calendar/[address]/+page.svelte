<script lang="ts">
  import {onMount} from "svelte"
  import {page} from "$app/stores"
  import {sortBy, sleep} from "@welshman/lib"
  import type {MakeNonOptional} from "@welshman/lib"
  import {COMMENT, getTagValue} from "@welshman/util"
  import {request} from "@welshman/net"
  import {repository} from "@welshman/app"
  import {deriveEventsById, deriveEventsAsc} from "@welshman/store"
  import AltArrowLeft from "@assets/icons/alt-arrow-left.svg?dataurl"
  import SortVertical from "@assets/icons/sort-vertical.svg?dataurl"
  import Reply from "@assets/icons/reply-2.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import PageBar from "@lib/components/PageBar.svelte"
  import PageContent from "@lib/components/PageContent.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import Button from "@lib/components/Button.svelte"
  import Content from "@app/components/Content.svelte"
  import NoteContent from "@app/components/NoteContent.svelte"
  import NoteCard from "@app/components/NoteCard.svelte"
  import SpaceMenuButton from "@app/components/SpaceMenuButton.svelte"
  import CalendarEventActions from "@app/components/CalendarEventActions.svelte"
  import CalendarEventHeader from "@app/components/CalendarEventHeader.svelte"
  import CalendarEventMeta from "@app/components/CalendarEventMeta.svelte"
  import CalendarEventDate from "@app/components/CalendarEventDate.svelte"
  import EventReply from "@app/components/EventReply.svelte"
  import {deriveEvent, decodeRelay} from "@app/core/state"

  const {relay, address} = $page.params as MakeNonOptional<typeof $page.params>
  const url = decodeRelay(relay)
  const event = deriveEvent(address, [url])
  const filters = [{kinds: [COMMENT], "#A": [address]}]
  const replies = deriveEventsAsc(deriveEventsById({filters, repository}))

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

  let showAll = $state(false)
  let showReply = $state(false)

  onMount(() => {
    const controller = new AbortController()

    request({relays: [url], filters, signal: controller.signal})

    return () => {
      controller.abort()
    }
  })
</script>

<PageBar>
  {#snippet icon()}
    <div>
      <Button class="btn btn-neutral btn-sm flex-nowrap whitespace-nowrap" onclick={back}>
        <Icon icon={AltArrowLeft} />
        <span class="hidden sm:inline">Go back</span>
      </Button>
    </div>
  {/snippet}
  {#snippet title()}
    <h1 class="text-xl">{getTagValue("title", $event?.tags || []) || ""}</h1>
  {/snippet}
  {#snippet action()}
    <SpaceMenuButton {url} />
  {/snippet}
</PageBar>

<PageContent class="flex flex-col gap-3 p-2 pt-4">
  {#if $event}
    <div class="card2 bg-alt col-3 z-feature">
      <div class="flex items-start gap-4">
        <CalendarEventDate event={$event} />
        <div class="flex min-w-0 flex-grow flex-col gap-1">
          <CalendarEventHeader event={$event} />
          <CalendarEventMeta event={$event} {url} />
          <div class="flex py-2 opacity-50">
            <div class="h-px flex-grow bg-base-content opacity-25"></div>
          </div>
          <Content showEntire event={$event} {url} />
        </div>
      </div>
      <div class="flex w-full flex-col justify-end sm:flex-row">
        <CalendarEventActions showRoom {url} event={$event} />
      </div>
    </div>
    {#if !showAll && $replies.length > 4}
      <div class="flex justify-center">
        <Button class="btn btn-link" onclick={expand}>
          <Icon icon={SortVertical} />
          Show all {$replies.length} replies
        </Button>
      </div>
    {/if}
    {#each sortBy(e => e.created_at, $replies).slice(0, showAll ? undefined : 4) as reply (reply.id)}
      <NoteCard event={reply} {url} class="card2 bg-alt z-feature w-full">
        <div class="col-3 ml-12">
          <NoteContent showEntire event={reply} {url} />
          <CalendarEventActions event={reply} {url} />
        </div>
      </NoteCard>
    {/each}
    {#if showReply}
      <EventReply {url} event={$event} onClose={closeReply} onSubmit={closeReply} />
    {:else}
      <div class="flex justify-end px-2 pb-2">
        <Button class="btn btn-primary" onclick={openReply}>
          <Icon icon={Reply} />
          Leave comment
        </Button>
      </div>
    {/if}
  {:else}
    {#await sleep(5000)}
      <Spinner loading>Loading comments...</Spinner>
    {:then}
      <p>Failed to load comments.</p>
    {/await}
  {/if}
</PageContent>
