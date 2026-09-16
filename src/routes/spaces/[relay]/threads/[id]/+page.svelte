<script lang="ts">
  import {onDestroy} from "svelte"
  import * as nip19 from "nostr-tools/nip19"
  import {call, sleep, spec, tryCatch} from "@welshman/lib"
  import type {TrustedEvent} from "@welshman/util"
  import {deriveEventsAsc} from "@welshman/store"
  import {getCommentFiltersForRoot, tagValue, tagSpec} from "@welshman/util"
  import Reply from "@assets/icons/reply-2.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import PageContent from "@lib/components/PageContent.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import Button from "@lib/components/Button.svelte"
  import Link from "@lib/components/Link.svelte"
  import SpaceBar from "@app/components/SpaceBar.svelte"
  import ThreadPost from "@app/components/ThreadPost.svelte"
  import EventReply from "@app/components/EventReply.svelte"
  import RoomName from "@app/components/RoomName.svelte"
  import {deriveEvent, deriveEventsById} from "@app/repository"
  import {network} from "@app/core"
  import {makeFeedContext} from "@app/feeds"
  import {decodeRelay} from "@app/relays"
  import {makeSpacePath, scrollToEvent} from "@app/routes"
  import type {PageProps} from "./$types"

  const REPLY_BATCH_SIZE = 20

  const {params}: PageProps = $props()

  const {relay, id} = params
  const url = decodeRelay(relay)
  const event = deriveEvent(id, [url])
  // Rows register themselves with `related`, so the whole page's reactions load in one batch
  const context = makeFeedContext({relays: [url]})
  const filters = $derived($event ? getCommentFiltersForRoot([$event]) : [])
  const replies = $derived(deriveEventsAsc(deriveEventsById(filters)))

  const back = () => history.back()

  const replyCount = $derived($replies.length)
  const h = $derived(tagValue(tagSpec("h"), $event?.tags || []))

  // A permalink's target. Replies stream in newest first, so the post it names is usually here
  // long before the ones above it — its position is only right once the thread has finished
  // arriving, so this is kept and re-read rather than acted on the first time it shows up.
  let target: string | undefined = $state(
    call(() => {
      const hash = window.location.hash.replace(/^#/, "")

      if (hash.startsWith("nevent1")) {
        const decoded = tryCatch(() => nip19.decode(hash))

        if (decoded?.type === "nevent") {
          return decoded.data.id
        }
      }
    }),
  )

  let revealed = $state(REPLY_BATCH_SIZE)

  const targetIndex = $derived(target ? $replies.findIndex(spec({id: target})) : -1)

  // A thread reads from its newest end, and the reader pulls earlier replies in from there. A
  // permalink reaches back as far as it has to on its own.
  const visibleCount = $derived(
    targetIndex < 0 ? revealed : Math.max(revealed, $replies.length - targetIndex),
  )

  const visibleReplies = $derived($replies.slice(Math.max(0, $replies.length - visibleCount)))

  const hiddenCount = $derived($replies.length - visibleReplies.length)

  // Reaching back by hand hands control back to the reader.
  const showEarlier = () => {
    const nextCount = visibleCount + REPLY_BATCH_SIZE

    target = undefined
    revealed = nextCount
  }

  const openReply = (post: TrustedEvent) => {
    replyTo = post
    showReply = true
  }

  const closeReply = () => {
    showReply = false
    replyTo = undefined
  }

  const openThreadReply = () => {
    if ($event) {
      openReply($event)
    }
  }

  const clearReplyParent = () => {
    if ($event) {
      replyTo = $event
    }
  }

  onDestroy(context.cleanup)

  let showReply = $state(false)
  let replyTo: TrustedEvent | undefined = $state()

  $effect(() => {
    if (target && (target === $event?.id || targetIndex >= 0)) {
      setTimeout(() => scrollToEvent(target!), 100)
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

<SpaceBar {back} class="!h-auto min-h-20 py-3">
  {#snippet title()}
    <div class="flex min-w-0 flex-col gap-0.5">
      <h1 class="truncate min-w-0 font-bold sm:text-xl">
        {tagValue(tagSpec("title"), $event?.tags || []) || ""}
      </h1>
      <p class="text-xs opacity-75">
        {replyCount}
        {replyCount === 1 ? "reply" : "replies"}
        {#if h}
          · <Link href={makeSpacePath(url, h)} class="link">#<RoomName {url} {h} /></Link>
        {/if}
      </p>
    </div>
  {/snippet}
</SpaceBar>

<PageContent noPad class="flex flex-col">
  {#if $event}
    <div class="bg-surface border-y" style="border-color: var(--line)">
      <ThreadPost {url} {context} event={$event} threadPubkey={$event.pubkey} onReply={openReply} />
    </div>
    {#if hiddenCount > 0}
      <div class="flex justify-center py-4">
        <Button class="button button-neutral button-sm" onclick={showEarlier}>
          Show earlier replies ({hiddenCount})
        </Button>
      </div>
    {/if}
    {#if visibleReplies.length > 0}
      <div class="bg-surface border-y" style="border-color: var(--line)">
        {#each visibleReplies as reply (reply.id)}
          <ThreadPost
            {url}
            {context}
            event={reply}
            threadPubkey={$event.pubkey}
            onReply={openReply} />
        {/each}
      </div>
    {/if}
    {#if showReply && replyTo && $event}
      <EventReply
        {url}
        event={$event}
        parent={replyTo.id === $event.id ? undefined : replyTo}
        onClose={closeReply}
        onClearParent={clearReplyParent}
        onSubmit={closeReply} />
    {:else}
      <div class="flex justify-end p-4">
        <Button class="button button-primary" onclick={openThreadReply}>
          <Icon icon={Reply} />
          Reply to thread
        </Button>
      </div>
    {/if}
  {:else}
    <div class="flex justify-center py-20">
      {#await sleep(5000)}
        <Spinner loading>Loading thread...</Spinner>
      {:then}
        <p>Failed to load thread.</p>
      {/await}
    </div>
  {/if}
</PageContent>
