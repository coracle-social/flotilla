<script lang="ts">
  import {onMount, tick} from "svelte"
  import {page} from "$app/stores"
  import {goto} from "$app/navigation"
  import type {Readable} from "svelte/store"
  import {readable} from "svelte/store"
  import {now, int, formatTimestampAsDate, MINUTE, ago} from "@welshman/lib"
  import type {TrustedEvent, EventContent} from "@welshman/util"
  import {makeEvent, MESSAGE, RELAY_ADD_MEMBER, RELAY_REMOVE_MEMBER} from "@welshman/util"
  import {pubkey, publishThunk} from "@welshman/app"
  import {fade, fly} from "@lib/transition"
  import ChatRound from "@assets/icons/chat-round.svg?dataurl"
  import AltArrowDown from "@assets/icons/alt-arrow-down.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import PageBar from "@lib/components/PageBar.svelte"
  import PageContent from "@lib/components/PageContent.svelte"
  import Divider from "@lib/components/Divider.svelte"
  import ThunkToast from "@app/components/ThunkToast.svelte"
  import SpaceSearch from "@app/components/SpaceSearch.svelte"
  import SpaceMenuButton from "@app/components/SpaceMenuButton.svelte"
  import RoomItem from "@app/components/RoomItem.svelte"
  import RoomItemAddMember from "@src/app/components/RoomItemAddMember.svelte"
  import RoomItemRemoveMember from "@src/app/components/RoomItemRemoveMember.svelte"
  import RoomCompose from "@app/components/RoomCompose.svelte"
  import RoomComposeEdit from "@src/app/components/RoomComposeEdit.svelte"
  import RoomComposeParent from "@app/components/RoomComposeParent.svelte"
  import {userSettingsValues, decodeRelay, PROTECTED, MESSAGE_KINDS} from "@app/core/state"
  import {prependParent, canEnforceNip70, publishDelete} from "@app/core/commands"
  import {checked} from "@app/util/notifications"
  import {pushToast} from "@app/util/toast"
  import {makeFeed} from "@app/core/requests"
  import {popKey} from "@lib/implicit"

  const mounted = now()
  const lastChecked = $checked[$page.url.pathname]
  const url = decodeRelay($page.params.relay!)
  const shouldProtect = canEnforceNip70(url)
  const at = $derived(parseInt($page.url.searchParams.get("at")!))

  const replyTo = (event: TrustedEvent) => {
    parent = event
    compose?.focus()
  }

  const clearParent = () => {
    parent = undefined
  }

  const clearEventToEdit = () => {
    eventToEdit = undefined
  }

  const clearShare = () => {
    share = undefined
  }

  const onSubmit = async ({content, tags}: EventContent) => {
    try {
      let template: EventContent & {created_at?: number} = {content, tags}

      if (eventToEdit) {
        // Don't do anything if message hasn't changed
        if (eventToEdit.content === content) {
          return
        }

        // Delete previous message, to be republished with same timestamp
        template.created_at = eventToEdit.created_at
        publishDelete({relays: [url], event: eventToEdit, protect: await shouldProtect})
      }

      if (await shouldProtect) {
        tags.push(PROTECTED)
      }

      if (share) {
        template = prependParent(share, template, url)
      }

      if (parent) {
        template = prependParent(parent, template, url)
      }

      const thunk = publishThunk({
        relays: [url],
        event: makeEvent(MESSAGE, template),
        delay: $userSettingsValues.send_delay,
      })

      if ($userSettingsValues.send_delay) {
        pushToast({
          timeout: 30_000,
          children: {
            component: ThunkToast,
            props: {thunk},
          },
        })
      }
    } finally {
      clearParent()
      clearShare()
      clearEventToEdit()
    }
  }

  const manageScrollPosition = () => {
    showScrollButton = !isNaN(at) || Math.abs(element?.scrollTop || 0) > 1500

    const newMessages = document.getElementById("new-messages")

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

    if (!userHasScrolled && !isNaN(at)) {
      const targetEvent = $events.find(event => event.created_at >= at)

      if (targetEvent) {
        const target = element?.querySelector(`[data-event="${targetEvent.id}"]`)

        if (target instanceof HTMLElement) {
          isProgrammaticScroll = true
          target.scrollIntoView({block: "center"})
        }
      }
    }
  }

  const onScroll = () => {
    if (!isProgrammaticScroll) {
      userHasScrolled = true
      manageScrollPosition()
    }

    isProgrammaticScroll = false
  }

  const scrollToNewMessages = () =>
    document.getElementById("new-messages")?.scrollIntoView({behavior: "smooth", block: "center"})

  const scrollToBottom = () => {
    if (!isNaN(at)) {
      goto($page.url.pathname, {replaceState: true})
    } else {
      element?.scrollTo({top: 0, behavior: "smooth"})
    }
  }

  let loadingBackward = $state(true)
  let loadingForward = $state(true)
  let userHasScrolled = $state(false)
  let isProgrammaticScroll = $state(false)
  let share = $state(popKey<TrustedEvent | undefined>("share"))
  let parent: TrustedEvent | undefined = $state()
  let element: HTMLElement | undefined = $state()
  let chatCompose: HTMLElement | undefined = $state()
  let dynamicPadding: HTMLElement | undefined = $state()
  let newMessagesSeen = false
  let showFixedNewMessages = $state(false)
  let showScrollButton = $state(false)
  let cleanup: () => void
  let events: Readable<TrustedEvent[]> = $state(readable([]))
  let compose: RoomCompose | undefined = $state()
  let eventToEdit: TrustedEvent | undefined = $state()

  const elements = $derived.by(() => {
    const elements = []
    const seen = new Set()

    let previousDate
    let previousKind
    let previousPubkey
    let previousCreatedAt = 0
    let newMessagesSeen = false

    if (events) {
      const lastUserEvent = $events.find(e => e.pubkey === $pubkey)

      // Adjust last checked to account for messages that came from a different device
      const adjustedLastChecked =
        lastChecked && lastUserEvent ? Math.max(lastUserEvent.created_at, lastChecked) : lastChecked

      for (const event of $events) {
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
          showPubkey:
            previousPubkey !== event.pubkey ||
            event.created_at - previousCreatedAt > int(3, MINUTE) ||
            [RELAY_ADD_MEMBER, RELAY_REMOVE_MEMBER].includes(previousKind!),
        })

        previousDate = date
        previousKind = event.kind
        previousPubkey = event.pubkey
        previousCreatedAt = event.created_at
        seen.add(event.id)
      }
    }

    elements.reverse()

    tick().then(manageScrollPosition)

    return elements
  })

  const start = () => {
    cleanup?.()

    const feed = makeFeed({
      url,
      at: at || now(),
      element: element!,
      filters: [{kinds: [...MESSAGE_KINDS, RELAY_ADD_MEMBER, RELAY_REMOVE_MEMBER]}],
      onBackwardExhausted: () => {
        loadingBackward = false
      },
      onForwardExhausted: () => {
        loadingForward = false
      },
    })

    events = feed.events
    cleanup = feed.cleanup
  }

  const onEscape = () => {
    clearParent()
    clearShare()
    eventToEdit = undefined
  }

  const canEditEvent = (event: TrustedEvent) =>
    event.pubkey === $pubkey && event.created_at >= ago(5, MINUTE)

  const onEditEvent = (event: TrustedEvent) => {
    clearParent()
    clearShare()
    eventToEdit = event
  }

  const onEditPrevious = () => {
    const prev = $events.find(e => e.pubkey === $pubkey)

    if (prev && canEditEvent(prev)) {
      onEditEvent(prev)
    }
  }

  onMount(() => {
    const controller = new AbortController()

    const observer = new ResizeObserver(() => {
      if (dynamicPadding && chatCompose) {
        dynamicPadding!.style.minHeight = `${chatCompose!.offsetHeight}px`
      }
    })

    observer.observe(chatCompose!)
    observer.observe(dynamicPadding!)
    start()

    return () => {
      cleanup()
      controller.abort()
      observer.unobserve(chatCompose!)
      observer.unobserve(dynamicPadding!)
    }
  })
</script>

<PageBar>
  {#snippet icon()}
    <div class="center">
      <Icon icon={ChatRound} />
    </div>
  {/snippet}
  {#snippet title()}
    <strong>Chat</strong>
  {/snippet}
  {#snippet action()}
    <div class="row-2 items-center">
      <SpaceSearch {url} />
      <SpaceMenuButton {url} />
    </div>
  {/snippet}
</PageBar>

<PageContent bind:element onscroll={onScroll} class="flex flex-col-reverse pt-4">
  <div bind:this={dynamicPadding}></div>
  {#if loadingForward}
    <p class="py-20 flex justify-center">
      <Spinner loading={loadingForward}>Looking for messages...</Spinner>
    </p>
  {/if}
  {#each elements as { type, id, value, showPubkey } (id)}
    {#if type === "new-messages"}
      <div
        {id}
        class="flex items-center py-2 text-xs transition-colors"
        class:opacity-0={showFixedNewMessages}>
        <div class="h-px flex-grow bg-primary"></div>
        <p class="rounded-full bg-primary px-2 py-1 text-primary-content">New Messages</p>
        <div class="h-px flex-grow bg-primary"></div>
      </div>
    {:else if type === "date"}
      <Divider>{value}</Divider>
    {:else}
      {@const event = $state.snapshot(value as TrustedEvent)}
      {#if event.kind === RELAY_ADD_MEMBER}
        <RoomItemAddMember {url} {event} />
      {:else if event.kind === RELAY_REMOVE_MEMBER}
        <RoomItemRemoveMember {url} {event} />
      {:else}
        <div class:-mt-1={!showPubkey}>
          <RoomItem
            {url}
            {event}
            {replyTo}
            {showPubkey}
            canEdit={canEditEvent}
            onEdit={onEditEvent} />
        </div>
      {/if}
    {/if}
  {/each}
  <p class="flex h-10 items-center justify-center py-20">
    {#if loadingBackward}
      <Spinner loading={loadingBackward}>Looking for messages...</Spinner>
    {:else}
      <Spinner>End of message history</Spinner>
    {/if}
  </p>
</PageContent>

<div class="chat__compose bg-base-200" bind:this={chatCompose}>
  <div>
    {#if parent}
      <RoomComposeParent event={parent} clear={clearParent} verb="Replying to" />
    {/if}
    {#if share}
      <RoomComposeParent event={share} clear={clearShare} verb="Sharing" />
    {/if}
    {#if eventToEdit}
      <RoomComposeEdit clear={clearEventToEdit} />
    {/if}
  </div>
  {#key eventToEdit}
    <RoomCompose
      {url}
      {onSubmit}
      {onEscape}
      {onEditPrevious}
      content={eventToEdit?.content}
      bind:this={compose} />
  {/key}
</div>

{#if showScrollButton}
  <div in:fade class="chat__scroll-down">
    <Button class="btn btn-circle btn-neutral" onclick={scrollToBottom}>
      <Icon icon={AltArrowDown} />
    </Button>
  </div>
{/if}

{#if showFixedNewMessages}
  <div class="relative z-popover flex justify-center">
    <div transition:fly={{duration: 200}} class="fixed top-12">
      <Button class="btn btn-primary btn-xs rounded-full" onclick={scrollToNewMessages}>
        New Messages
      </Button>
    </div>
  </div>
{/if}
