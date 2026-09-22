<script lang="ts">
  import {onDestroy} from "svelte"
  import {page} from "$app/state"
  import {sleep, spec} from "@welshman/lib"
  import type {TrustedEvent} from "@welshman/util"
  import {deriveEventsAsc} from "@welshman/store"
  import {getCommentFiltersForRoot} from "@welshman/util"
  import Reply from "@assets/icons/reply-2.svg?dataurl"
  import AltArrowDown from "@assets/icons/alt-arrow-down.svg?dataurl"
  import {fade, fly} from "@lib/transition"
  import Icon from "@lib/components/Icon.svelte"
  import PageContent from "@lib/components/PageContent.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import Button from "@lib/components/Button.svelte"
  import ThreadPost from "@app/components/ThreadPost.svelte"
  import ThreadSummaryBar from "@app/components/ThreadSummaryBar.svelte"
  import EventReply from "@app/components/EventReply.svelte"
  import {deriveEvent, deriveEventsById} from "@app/repository"
  import {network} from "@app/core"
  import {makeFeedContext} from "@app/feeds"
  import {getChecked} from "@app/notifications"
  import {decodeRelay} from "@app/relays"
  import {getPermalinkTarget, scrollToEvent} from "@app/routes"
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

  const scrollToTop = () => element?.scrollTo({top: 0, behavior: "smooth"})

  const scrollToBottom = () => element?.scrollTo({top: element.scrollHeight, behavior: "smooth"})

  const permalink = getPermalinkTarget(page.url)

  // Visiting the thread clears its badge 300ms later, so the cutoff is read on the way in.
  const unreadAfter = getChecked(page.url.pathname)

  const oldestUnread = $derived(
    unreadAfter ? $replies.find(reply => reply.created_at > unreadAfter) : undefined,
  )

  let released = $state(false)

  // Replies stream in newest first, so a target's position is only right once they've all arrived.
  const target = $derived(released ? undefined : (permalink ?? oldestUnread?.id))

  let revealed = $state(REPLY_BATCH_SIZE)

  const targetIndex = $derived(target ? $replies.findIndex(spec({id: target})) : -1)

  // A thread reads from its newest end, and a target reaches back as far as it has to on its own.
  const visibleCount = $derived(
    targetIndex < 0 ? revealed : Math.max(revealed, $replies.length - targetIndex),
  )

  const visibleReplies = $derived($replies.slice(Math.max(0, $replies.length - visibleCount)))

  const hiddenCount = $derived($replies.length - visibleReplies.length)

  // Reaching back by hand hands control back to the reader.
  const showEarlier = () => {
    const nextCount = visibleCount + REPLY_BATCH_SIZE

    released = true
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
  let element: Element | undefined = $state()
  let panel: HTMLElement | undefined = $state()
  let root: HTMLElement | undefined = $state()
  let unreadDivider: HTMLElement | undefined = $state()
  let scrolledPastRoot = $state(false)
  let scrolledUp = $state(false)

  $effect(() => {
    if (target && (target === $event?.id || targetIndex >= 0)) {
      setTimeout(() => {
        if (permalink) {
          scrollToEvent(permalink)
        } else {
          unreadDivider?.scrollIntoView({behavior: "smooth", block: "center"})
        }
      }, 100)
    }
  })

  $effect(() => {
    const container = element
    const rootPost = root

    if (container && rootPost) {
      const onScroll = () => {
        scrolledPastRoot = container.scrollTop > rootPost.offsetHeight
        scrolledUp = container.scrollHeight - container.scrollTop - container.clientHeight > 500
      }

      container.addEventListener("scroll", onScroll, {passive: true})
      onScroll()

      return () => container.removeEventListener("scroll", onScroll)
    }
  })

  // A reader who's caught up lands at the bottom. Replies arrive after the page does and the
  // images in them later still, so the bottom moves until the thread has finished settling.
  $effect(() => {
    const container = element
    const content = panel

    if (container && content && unreadAfter && !target && !released) {
      const observer = new ResizeObserver(() => {
        container.scrollTo({top: container.scrollHeight, behavior: "smooth"})
      })

      observer.observe(content)

      return () => observer.disconnect()
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

<div class="relative flex min-h-0 flex-1 flex-col">
  <PageContent bind:element noPad class="flex flex-col">
    {#if $event}
      <div bind:this={panel} class="bg-surface border-y" style="border-color: var(--line)">
        <div bind:this={root}>
          <ThreadPost
            {url}
            {context}
            event={$event}
            threadPubkey={$event.pubkey}
            replyCount={$replies.length}
            onReply={openReply} />
        </div>
        {#if hiddenCount > 0}
          <div class="flex justify-center py-4">
            <Button class="button button-neutral button-sm" onclick={showEarlier}>
              Show earlier replies ({hiddenCount})
            </Button>
          </div>
        {/if}
        {#each visibleReplies as reply (reply.id)}
          {#if reply.id === oldestUnread?.id}
            <div bind:this={unreadDivider} class="flex items-center gap-2 px-4 py-2 text-xs">
              <div class="h-px grow bg-primary"></div>
              <p class="rounded-full bg-primary px-2 py-1" style="color: var(--primary-content)">
                New replies
              </p>
              <div class="h-px grow bg-primary"></div>
            </div>
          {/if}
          <ThreadPost
            {url}
            {context}
            event={reply}
            threadPubkey={$event.pubkey}
            onReply={openReply} />
        {/each}
      </div>
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
  {#if $event && scrolledPastRoot}
    <div transition:fly={{y: -20, duration: 200}} class="absolute inset-x-0 top-0 z-nav">
      <ThreadSummaryBar {url} event={$event} onClick={scrollToTop} />
    </div>
  {/if}
  {#if scrolledUp && !showReply}
    <div transition:fade class="absolute right-4 bottom-20 z-nav mb-sai md:bottom-4 md:mb-0">
      <Button
        aria-label="Scroll to newest"
        class="button button-neutral button-circle shadow-xl"
        onclick={scrollToBottom}>
        <Icon icon={AltArrowDown} />
      </Button>
    </div>
  {/if}
</div>
