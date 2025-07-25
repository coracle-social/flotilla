<script lang="ts">
  import {readable} from "svelte/store"
  import {onMount, onDestroy} from "svelte"
  import {page} from "$app/stores"
  import type {Readable} from "svelte/store"
  import {now, formatTimestampAsDate} from "@welshman/lib"
  import type {TrustedEvent, EventContent} from "@welshman/util"
  import {makeEvent, MESSAGE, DELETE} from "@welshman/util"
  import {pubkey, publishThunk} from "@welshman/app"
  import {slide, fade, fly} from "@lib/transition"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import PageBar from "@lib/components/PageBar.svelte"
  import PageContent from "@lib/components/PageContent.svelte"
  import Divider from "@lib/components/Divider.svelte"
  import MenuSpaceButton from "@app/components/MenuSpaceButton.svelte"
  import ChannelMessage from "@app/components/ChannelMessage.svelte"
  import ChannelCompose from "@app/components/ChannelCompose.svelte"
  import ChannelComposeParent from "@app/components/ChannelComposeParent.svelte"
  import {userSettingValues, decodeRelay, getEventsForUrl} from "@app/state"
  import {setChecked, checked} from "@app/notifications"
  import {prependParent} from "@app/commands"
  import {PROTECTED, REACTION_KINDS} from "@app/state"
  import {makeFeed} from "@app/requests"
  import {popKey} from "@app/implicit"

  const mounted = now()
  const lastChecked = $checked[$page.url.pathname]
  const url = decodeRelay($page.params.relay)
  const filter = {kinds: [MESSAGE]}

  const replyTo = (event: TrustedEvent) => {
    parent = event
    compose?.focus()
  }

  const clearParent = () => {
    parent = undefined
  }

  const clearShare = () => {
    share = undefined
  }

  const onSubmit = ({content, tags}: EventContent) => {
    tags.push(PROTECTED)

    let template = {content, tags}

    if (share) {
      template = prependParent(share, template)
    }

    if (parent) {
      template = prependParent(parent, template)
    }

    publishThunk({
      relays: [url],
      event: makeEvent(MESSAGE, template),
      delay: $userSettingValues.send_delay,
    })

    clearParent()
    clearShare()
  }

  const onScroll = () => {
    showScrollButton = Math.abs(element?.scrollTop || 0) > 1500

    if (!newMessages || newMessagesSeen) {
      showFixedNewMessages = false
    } else {
      const {y} = newMessages.getBoundingClientRect()

      if (y > 300) {
        newMessagesSeen = true
      } else {
        showFixedNewMessages = y < 0
      }
    }
  }

  const scrollToNewMessages = () =>
    newMessages?.scrollIntoView({behavior: "smooth", block: "center"})

  const scrollToBottom = () => element?.scrollTo({top: 0, behavior: "smooth"})

  let loadingEvents = $state(true)
  let share = $state(popKey<TrustedEvent | undefined>("share"))
  let parent: TrustedEvent | undefined = $state()
  let element: HTMLElement | undefined = $state()
  let newMessages: HTMLElement | undefined = $state()
  let chatCompose: HTMLElement | undefined = $state()
  let dynamicPadding: HTMLElement | undefined = $state()
  let newMessagesSeen = false
  let showFixedNewMessages = $state(false)
  let showScrollButton = $state(false)
  let cleanup: () => void
  let events: Readable<TrustedEvent[]> = $state(readable([]))
  let compose: ChannelCompose | undefined = $state()

  const elements = $derived.by(() => {
    const elements = []
    const seen = new Set()

    let previousDate
    let previousPubkey
    let newMessagesSeen = false

    if (events) {
      const lastUserEvent = $events.find(e => e.pubkey === $pubkey)

      // Adjust last checked to account for messages that came from a different device
      const adjustedLastChecked =
        lastChecked && lastUserEvent ? Math.max(lastUserEvent.created_at, lastChecked) : lastChecked

      for (const event of $events.toReversed()) {
        if (seen.has(event.id)) {
          continue
        }

        const date = formatTimestampAsDate(event.created_at)

        if (
          !newMessagesSeen &&
          adjustedLastChecked &&
          event.pubkey !== $pubkey &&
          event.created_at > adjustedLastChecked &&
          event.created_at < mounted
        ) {
          elements.push({type: "new-messages", id: "new-messages"})
          newMessagesSeen = true
        }

        if (date !== previousDate) {
          elements.push({type: "date", value: date, id: date, showPubkey: false})
        }

        elements.push({
          id: event.id,
          type: "note",
          value: event,
          showPubkey: date !== previousDate || previousPubkey !== event.pubkey,
        })

        previousDate = date
        previousPubkey = event.pubkey
        seen.add(event.id)
      }
    }

    elements.reverse()

    setTimeout(onScroll, 100)

    return elements
  })

  onMount(() => {
    const controller = new AbortController()

    const observer = new ResizeObserver(() => {
      if (dynamicPadding && chatCompose) {
        dynamicPadding!.style.minHeight = `${chatCompose!.offsetHeight}px`
      }
    })

    observer.observe(chatCompose!)
    observer.observe(dynamicPadding!)

    const feed = makeFeed({
      element: element!,
      relays: [url],
      feedFilters: [filter],
      subscriptionFilters: [{kinds: [DELETE, MESSAGE, ...REACTION_KINDS], since: now()}],
      initialEvents: getEventsForUrl(url, [{...filter, limit: 20}]),
      onExhausted: () => {
        loadingEvents = false
      },
    })

    events = feed.events
    cleanup = feed.cleanup

    return () => {
      controller.abort()
      observer.unobserve(chatCompose!)
      observer.unobserve(dynamicPadding!)
    }
  })

  onDestroy(() => {
    cleanup()

    // Sveltekit calls onDestroy at the beginning of the page load for some reason
    setTimeout(() => {
      setChecked($page.url.pathname)
    }, 800)
  })
</script>

<PageBar>
  {#snippet icon()}
    <div class="center">
      <Icon icon="chat-round" />
    </div>
  {/snippet}
  {#snippet title()}
    <strong>Chat</strong>
  {/snippet}
  {#snippet action()}
    <MenuSpaceButton {url} />
  {/snippet}
</PageBar>

<PageContent bind:element onscroll={onScroll} class="flex flex-col-reverse pt-4">
  <div bind:this={dynamicPadding}></div>
  {#each elements as { type, id, value, showPubkey } (id)}
    {#if type === "new-messages"}
      <div
        bind:this={newMessages}
        class="flex items-center py-2 text-xs transition-colors"
        class:opacity-0={showFixedNewMessages}>
        <div class="h-px flex-grow bg-primary"></div>
        <p class="rounded-full bg-primary px-2 py-1 text-primary-content">New Messages</p>
        <div class="h-px flex-grow bg-primary"></div>
      </div>
    {:else if type === "date"}
      <Divider>{value}</Divider>
    {:else}
      <div in:slide class:-mt-1={!showPubkey}>
        <ChannelMessage
          {url}
          {replyTo}
          event={$state.snapshot(value as TrustedEvent)}
          {showPubkey} />
      </div>
    {/if}
  {/each}
  <p class="flex h-10 items-center justify-center py-20">
    {#if loadingEvents}
      <Spinner loading={loadingEvents}>Looking for messages...</Spinner>
    {:else}
      <Spinner>End of message history</Spinner>
    {/if}
  </p>
</PageContent>

<div class="chat__compose bg-base-200" bind:this={chatCompose}>
  <div>
    {#if parent}
      <ChannelComposeParent event={parent} clear={clearParent} verb="Replying to" />
    {/if}
    {#if share}
      <ChannelComposeParent event={share} clear={clearShare} verb="Sharing" />
    {/if}
  </div>
  <ChannelCompose bind:this={compose} {onSubmit} {url} />
</div>

{#if showScrollButton}
  <div in:fade class="chat__scroll-down">
    <Button class="btn btn-circle btn-neutral" onclick={scrollToBottom}>
      <Icon icon="alt-arrow-down" />
    </Button>
  </div>
{/if}

{#if showFixedNewMessages}
  <div class="relative z-feature flex justify-center">
    <div transition:fly={{duration: 200}} class="fixed top-12">
      <Button class="btn btn-primary btn-xs rounded-full" onclick={scrollToNewMessages}>
        New Messages
      </Button>
    </div>
  </div>
{/if}
