<script lang="ts">
  import {readable} from "svelte/store"
  import {onMount, onDestroy} from "svelte"
  import {page} from "$app/stores"
  import type {Readable} from "svelte/store"
  import type {MakeNonOptional} from "@welshman/lib"
  import {now, int, formatTimestampAsDate, ago, MINUTE} from "@welshman/lib"
  import type {TrustedEvent, EventContent} from "@welshman/util"
  import {
    makeEvent,
    makeRoomMeta,
    MESSAGE,
    ROOM_ADD_MEMBER,
    ROOM_REMOVE_MEMBER,
  } from "@welshman/util"
  import {pubkey, publishThunk, waitForThunkError, joinRoom, leaveRoom} from "@welshman/app"
  import {slide, fade, fly} from "@lib/transition"
  import InfoCircle from "@assets/icons/info-circle.svg?dataurl"
  import ClockCircle from "@assets/icons/clock-circle.svg?dataurl"
  import Login2 from "@assets/icons/login-3.svg?dataurl"
  import AltArrowDown from "@assets/icons/alt-arrow-down.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import PageBar from "@lib/components/PageBar.svelte"
  import PageContent from "@lib/components/PageContent.svelte"
  import Divider from "@lib/components/Divider.svelte"
  import ThunkToast from "@app/components/ThunkToast.svelte"
  import SpaceMenuButton from "@app/components/SpaceMenuButton.svelte"
  import RoomName from "@app/components/RoomName.svelte"
  import RoomImage from "@app/components/RoomImage.svelte"
  import RoomDetail from "@app/components/RoomDetail.svelte"
  import RoomItem from "@app/components/RoomItem.svelte"
  import RoomItemAddMember from "@src/app/components/RoomItemAddMember.svelte"
  import RoomItemRemoveMember from "@src/app/components/RoomItemRemoveMember.svelte"
  import RoomCompose from "@app/components/RoomCompose.svelte"
  import RoomComposeEdit from "@src/app/components/RoomComposeEdit.svelte"
  import RoomComposeParent from "@app/components/RoomComposeParent.svelte"
  import {
    decodeRelay,
    deriveUserRoomMembershipStatus,
    deriveRoom,
    MembershipStatus,
    PROTECTED,
    MESSAGE_KINDS,
    userSettingsValues,
  } from "@app/core/state"
  import {checked} from "@app/util/notifications"
  import {canEnforceNip70, prependParent, publishDelete} from "@app/core/commands"
  import {makeFeed} from "@app/core/requests"
  import {popKey} from "@lib/implicit"
  import {pushToast} from "@app/util/toast"
  import {pushModal} from "@app/util/modal"

  const {h, relay} = $page.params as MakeNonOptional<typeof $page.params>
  const mounted = now()
  const lastChecked = $checked[$page.url.pathname]
  const url = decodeRelay(relay)
  const room = deriveRoom(url, h)
  const shouldProtect = canEnforceNip70(url)
  const membershipStatus = deriveUserRoomMembershipStatus(url, h)

  const showRoomDetail = () => pushModal(RoomDetail, {url, h})

  const join = async () => {
    joining = true

    try {
      const message = await waitForThunkError(joinRoom(url, makeRoomMeta({h})))

      if (message && !message.startsWith("duplicate:")) {
        return pushToast({theme: "error", message})
      }

      // Restart the feed now that we're a member
      start()
    } finally {
      joining = false
    }
  }

  const leave = async () => {
    leaving = true
    try {
      const message = await waitForThunkError(leaveRoom(url, makeRoomMeta({h})))

      if (message && !message.startsWith("duplicate:")) {
        pushToast({theme: "error", message})
      }
    } finally {
      leaving = false
    }
  }

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

  const clearEventToEdit = () => {
    eventToEdit = undefined
  }

  const onSubmit = async ({content, tags}: EventContent) => {
    tags.push(["h", h])

    if (await shouldProtect) {
      tags.push(PROTECTED)
    }

    let template: EventContent & {created_at?: number} = {content, tags}

    if (eventToEdit) {
      // Delete previous message, to be republished with same timestamp
      template.created_at = eventToEdit.created_at
      publishDelete({
        relays: [url],
        event: $state.snapshot(eventToEdit),
        protect: await shouldProtect,
      })
    }

    if (share) {
      template = prependParent(share, template)
    }

    if (parent) {
      template = prependParent(parent, template)
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

    clearParent()
    clearShare()
    clearEventToEdit()
  }

  const onScroll = () => {
    showScrollButton = Math.abs(element?.scrollTop || 0) > 1500

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
  }

  const scrollToNewMessages = () =>
    document.getElementById("new-messages")?.scrollIntoView({behavior: "smooth", block: "center"})

  const scrollToBottom = () => element?.scrollTo({top: 0, behavior: "smooth"})

  let joining = $state(false)
  let leaving = $state(false)
  let loadingEvents = $state(true)
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
          showPubkey:
            previousPubkey !== event.pubkey ||
            event.created_at - previousCreatedAt > int(3, MINUTE) ||
            [ROOM_ADD_MEMBER, ROOM_REMOVE_MEMBER].includes(previousKind!),
        })

        previousDate = date
        previousKind = event.kind
        previousPubkey = event.pubkey
        previousCreatedAt = event.created_at
        seen.add(event.id)
      }
    }

    elements.reverse()

    setTimeout(onScroll, 100)

    return elements
  })

  const start = () => {
    cleanup?.()

    const feed = makeFeed({
      url,
      element: element!,
      filters: [{kinds: [...MESSAGE_KINDS, ROOM_ADD_MEMBER, ROOM_REMOVE_MEMBER], "#h": [h]}],
      onExhausted: () => {
        loadingEvents = false
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
    const observer = new ResizeObserver(() => {
      if (dynamicPadding && chatCompose) {
        dynamicPadding!.style.minHeight = `${chatCompose!.offsetHeight}px`
      }
    })

    observer.observe(chatCompose!)
    observer.observe(dynamicPadding!)
    start()

    return () => {
      observer.unobserve(chatCompose!)
      observer.unobserve(dynamicPadding!)
    }
  })

  onDestroy(() => {
    cleanup?.()
  })
</script>

<PageBar>
  {#snippet icon()}
    <RoomImage {url} {h} />
  {/snippet}
  {#snippet title()}
    <RoomName {url} {h} />
  {/snippet}
  {#snippet action()}
    <div class="row-2">
      <Button
        class="btn btn-neutral btn-sm tooltip tooltip-left"
        data-tip="Room information"
        onclick={showRoomDetail}>
        <Icon size={4} icon={InfoCircle} />
      </Button>
      <SpaceMenuButton {url} />
    </div>
  {/snippet}
</PageBar>

<PageContent bind:element onscroll={onScroll} class="flex flex-col-reverse pt-4">
  <div bind:this={dynamicPadding}></div>
  {#if $room.isPrivate && $membershipStatus !== MembershipStatus.Granted}
    <div class="py-20">
      <div class="card2 col-8 m-auto max-w-md items-center text-center">
        <p class="opacity-75">You aren't currently a member of this room.</p>
        {#if !$room.isClosed}
          {#if $membershipStatus === MembershipStatus.Pending}
            <Button class="btn btn-neutral btn-sm" disabled={leaving} onclick={leave}>
              <Icon icon={ClockCircle} />
              Access Pending
            </Button>
          {:else}
            <Button class="btn btn-neutral btn-sm" disabled={joining} onclick={join}>
              {#if joining}
                <span class="loading loading-spinner loading-sm"></span>
              {:else}
                <Icon icon={Login2} />
              {/if}
              Join Room
            </Button>
          {/if}
        {/if}
      </div>
    </div>
  {:else}
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
        {#if event.kind === ROOM_ADD_MEMBER}
          <RoomItemAddMember {url} {event} />
        {:else if event.kind === ROOM_REMOVE_MEMBER}
          <RoomItemRemoveMember {url} {event} />
        {:else}
          <div in:slide class:-mt-1={!showPubkey}>
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
      {#if loadingEvents}
        <Spinner loading={loadingEvents}>Looking for messages...</Spinner>
      {:else}
        <Spinner>End of message history</Spinner>
      {/if}
    </p>
  {/if}
</PageContent>

<div class="chat__compose bg-base-200" bind:this={chatCompose}>
  {#if $room.isPrivate && $membershipStatus !== MembershipStatus.Granted}
    <!-- pass -->
  {:else if $room.isRestricted && $membershipStatus !== MembershipStatus.Granted}
    <div class="bg-alt card m-4 flex flex-row items-center justify-between px-4 py-3">
      <p class="opacity-75">Only members are allowed to post to this room.</p>
      {#if !$room.isClosed}
        {#if $membershipStatus === MembershipStatus.Pending}
          <Button class="btn btn-neutral btn-sm" disabled={leaving} onclick={leave}>
            <Icon icon={ClockCircle} />
            Access Pending
          </Button>
        {:else}
          <Button class="btn btn-neutral btn-sm" disabled={joining} onclick={join}>
            {#if joining}
              <span class="loading loading-spinner loading-sm"></span>
            {:else}
              <Icon icon={Login2} />
            {/if}
            Ask to Join
          </Button>
        {/if}
      {/if}
    </div>
  {:else}
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
        {h}
        {onSubmit}
        {onEscape}
        {onEditPrevious}
        content={eventToEdit?.content}
        bind:this={compose} />
    {/key}
  {/if}
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
