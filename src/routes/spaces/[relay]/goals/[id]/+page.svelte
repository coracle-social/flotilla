<script lang="ts">
  import {onMount} from "svelte"
  import {page} from "$app/stores"
  import {sleep} from "@welshman/lib"
  import type {MakeNonOptional} from "@welshman/lib"
  import {COMMENT, getTagValue} from "@welshman/util"
  import {repository} from "@welshman/app"
  import {request} from "@welshman/net"
  import {deriveEventsById, deriveEventsDesc} from "@welshman/store"
  import AltArrowLeft from "@assets/icons/alt-arrow-left.svg?dataurl"
  import SortVertical from "@assets/icons/sort-vertical.svg?dataurl"
  import Reply from "@assets/icons/reply-2.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import PageBar from "@lib/components/PageBar.svelte"
  import PageContent from "@lib/components/PageContent.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import Button from "@lib/components/Button.svelte"
  import Content from "@app/components/Content.svelte"
  import NoteCard from "@app/components/NoteCard.svelte"
  import SpaceMenuButton from "@app/components/SpaceMenuButton.svelte"
  import GoalSummary from "@app/components/GoalSummary.svelte"
  import GoalActions from "@app/components/GoalActions.svelte"
  import CommentActions from "@app/components/CommentActions.svelte"
  import EventReply from "@app/components/EventReply.svelte"
  import {deriveEvent, decodeRelay} from "@app/core/state"
  import {setChecked} from "@app/util/notifications"

  const {relay, id} = $page.params as MakeNonOptional<typeof $page.params>
  const url = decodeRelay(relay)
  const event = deriveEvent(id, [url])
  const filters = [{kinds: [COMMENT], "#E": [id]}]
  const replies = deriveEventsDesc(deriveEventsById({repository, filters}))
  const summary = getTagValue("summary", $event?.tags || [])

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
      setChecked($page.url.pathname)
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
    <h1 class="text-xl">{$event?.content}</h1>
  {/snippet}
  {#snippet action()}
    <div>
      <SpaceMenuButton {url} />
    </div>
  {/snippet}
</PageBar>

<PageContent class="flex flex-col p-2 pt-4">
  {#if $event}
    <div class="flex flex-col gap-3">
      <NoteCard event={$event} {url} class="card2 bg-alt z-feature w-full">
        <div class="col-3 ml-12">
          <Content showEntire event={{...$event, content: summary}} {url} />
          <GoalSummary event={$event} {url} />
          <GoalActions showRoom event={$event} {url} />
        </div>
      </NoteCard>
      {#if !showAll && $replies.length > 4}
        <div class="flex justify-center">
          <Button class="btn btn-link" onclick={expand}>
            <Icon icon={SortVertical} />
            Show all {$replies.length} replies
          </Button>
        </div>
      {/if}
      {#each $replies.slice(0, showAll ? undefined : 4) as reply (reply.id)}
        <NoteCard event={reply} {url} class="card2 bg-alt z-feature w-full">
          <div class="col-3 ml-12">
            <Content showEntire event={reply} {url} />
            <CommentActions event={reply} {url} />
          </div>
        </NoteCard>
      {/each}
    </div>
    {#if showReply}
      <EventReply {url} event={$event} onClose={closeReply} onSubmit={closeReply} />
    {:else}
      <div class="flex justify-end p-2">
        <Button class="btn btn-primary" onclick={openReply}>
          <Icon icon={Reply} />
          Comment on this goal
        </Button>
      </div>
    {/if}
  {:else}
    {#await sleep(5000)}
      <Spinner loading>Loading funding goal...</Spinner>
    {:then}
      <p>Failed to load funding goal.</p>
    {/await}
  {/if}
</PageContent>
