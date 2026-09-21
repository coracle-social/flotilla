<script lang="ts">
  import {onDestroy, onMount, untrack} from "svelte"
  import {readable} from "svelte/store"
  import {page} from "$app/stores"
  import {navigate} from "@app/modal"
  import type {Readable} from "svelte/store"
  import {debounce} from "throttle-debounce"
  import cx from "classnames"
  import {now, ifLet, ago, MINUTE} from "@welshman/lib"
  import type {Maybe} from "@welshman/lib"
  import type {TrustedEvent, EventContent} from "@welshman/util"
  import {relay, stamp, MESSAGE, RELAY_ADD_MEMBER, ROOM_ADD_MEMBER} from "@welshman/util"
  import {Message} from "@welshman/domain"
  import {MembershipStatus} from "@welshman/app"
  import AltArrowDown from "@assets/icons/alt-arrow-down.svg?dataurl"
  import ClockCircle from "@assets/icons/clock-circle.svg?dataurl"
  import Login2 from "@assets/icons/login-3.svg?dataurl"
  import Close from "@assets/icons/close.svg?dataurl"
  import {fade, fly} from "@lib/transition"
  import {documentActive} from "@lib/html"
  import Button from "@lib/components/Button.svelte"
  import Divider from "@lib/components/Divider.svelte"
  import Icon from "@lib/components/Icon.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import VirtualList from "@lib/components/VirtualList.svelte"
  import type {VirtualListController} from "@lib/components/VirtualList.svelte"
  import RoomCompose from "@app/components/RoomCompose.svelte"
  import ComposeEdit from "@app/components/ComposeEdit.svelte"
  import ComposeParent from "@app/components/ComposeParent.svelte"
  import RoomItem from "@app/components/RoomItem.svelte"
  import RoomItemAddMember from "@app/components/RoomItemAddMember.svelte"
  import RoomPinnedMessages from "@app/components/RoomPinnedMessages.svelte"
  import ThunkToast from "@app/components/ThunkToast.svelte"
  import VideoCallContent from "@app/components/VideoCallContent.svelte"
  import CallControlBar from "@app/components/CallControlBar.svelte"
  import {deletes, relays, rooms, thunks, user, writer} from "@app/core"
  import {joinRoom, leaveRoom} from "@app/access"
  import {CallState, callTargetRoom, callState, VideoCallLayout, videoCallLayout} from "@app/call"
  import {
    RoomType,
    deriveUserRoomMembershipStatus,
    getRoomType,
    groupRoomMessages,
    prependParent,
  } from "@app/rooms"
  import {userSettingsValues} from "@app/settings"
  import {isFeedLoading, makeFeed, makeFeedContext, makeScrollLoader} from "@app/feeds"
  import {pageLoading} from "@app/loading"
  import {checked, deferredRoomPath, setChecked} from "@app/notifications"
  import {makeRoomPath} from "@app/routes"
  import {pendingShare, type Share} from "@app/share"
  import {pushToast} from "@app/toast"

  type Props = {
    url: string
    h?: string
  }

  const {url, h}: Props = $props()

  const context = makeFeedContext({relays: [url]})

  onDestroy(context.cleanup)

  const room = h ? $rooms.forRoom(url, h) : readable(undefined)
  const addMemberKind = h ? ROOM_ADD_MEMBER : RELAY_ADD_MEMBER
  const isVoiceRoom = $derived($room && getRoomType($room) === RoomType.Voice)

  const isCallTargetingThisRoom = $derived($callTargetRoom?.url === url && $callTargetRoom?.h === h)

  const voiceConnectedHere = $derived(
    isVoiceRoom && $callState === CallState.Connected && isCallTargetingThisRoom,
  )

  // During a call the chat is toggled from the call controls — it takes over the pane,
  // or sits beside the video once there's room for both. Reuses voiceConnectedHere
  // rather than re-deriving isVoiceRoom/callState so it can't stay true for a voice
  // room the call isn't targeting, which would hide that room's messages.
  const callChatOpen = $derived(voiceConnectedHere && $videoCallLayout === VideoCallLayout.Split)
  const callChatHidden = $derived(voiceConnectedHere && !callChatOpen)

  const roomPath = h ? makeRoomPath(url, h) : undefined

  const closeChat = () => videoCallLayout.set(VideoCallLayout.Video)

  $effect(() => {
    deferredRoomPath.set(callChatHidden ? roomPath : undefined)
    if (roomPath && callChatOpen) {
      setChecked(roomPath)
    }
  })

  onDestroy(() => deferredRoomPath.set(undefined))

  let wasConnectedHere = $state(false)

  $effect(() => {
    if (!voiceConnectedHere) {
      if ($callState !== CallState.Connected) {
        videoCallLayout.set(VideoCallLayout.Chat)
      }
      wasConnectedHere = false
      return
    }

    // Land on the call view as soon as the call starts here, whether or not anyone's
    // camera is on — chat is one tap away via the control bar's chat toggle.
    if (!wasConnectedHere) {
      videoCallLayout.set(VideoCallLayout.Video)
      wasConnectedHere = true
    }
  })

  const shouldProtect = $relays.hasNip(url, 70)
  const membershipStatus = h
    ? deriveUserRoomMembershipStatus(url, h)
    : readable(MembershipStatus.Granted)
  const at = $derived(parseInt($page.url.searchParams.get("at")!))
  const inviteCode = $derived($page.url.searchParams.get("code") || "")

  const join = async () => {
    if (h) {
      joining = true

      try {
        const message = await joinRoom(url, h, inviteCode)

        if (message) {
          pushToast({theme: "error", message})
        } else {
          // Restart the feed now that we're a member
          start(at || now())
        }
      } finally {
        joining = false
      }
    }
  }

  const leave = async () => {
    if (h) {
      leaving = true

      try {
        const message = await leaveRoom(url, h)

        if (message) {
          pushToast({theme: "error", message})
        } else {
          pushToast({message: "You have left the room."})
        }
      } finally {
        leaving = false
      }
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
    if (!content && !sharedEvent) {
      return
    }

    try {
      const protect = await shouldProtect

      if (eventToEdit) {
        // Don't do anything if message hasn't changed
        if (eventToEdit.content === content) {
          return
        }

        // Delete the previous message, to be republished below with the same timestamp
        const command = await $deletes.deleteEvent($state.snapshot(eventToEdit), w =>
          w.setProtected(protect),
        )

        command.publishToRelays([url])
      }

      // A share is a quote rather than a reply, so it goes in the content directly and
      // setParent prepends the reply's own reference ahead of it.
      if (sharedEvent) {
        ;({content, tags} = await prependParent(sharedEvent, {content, tags}, url))
      }

      const eventWriter = writer(Message)
        .setContent(content)
        .addTags(...tags)
        .setProtected(protect)

      if (h) {
        eventWriter.setRoom(url, h)
      } else {
        eventWriter.forceRoutes(relay(url))
      }

      if (parent) {
        eventWriter.setParent(parent)
      }

      const thunk = $thunks.publish({
        relays: [url],
        event: stamp(await eventWriter.renderTemplate(), eventToEdit?.created_at),
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

  const getElementKey = (element: {id: string}) => element.id

  // Where a row sits inside the scroll container, in screen terms rather than scroll terms, so
  // the reversed layout doesn't come into it
  const topOf = (target: HTMLElement) =>
    target.getBoundingClientRect().top - element!.getBoundingClientRect().top

  // Messages loading in below the pinned row are inserted at the scroll origin, which pushes
  // everything else away from it. The browser has no reason to compensate for that, so put the
  // row back where it was. scrollBy is in visual terms, so this reads the same way either way up.
  //
  // A row the scroll clamped at the origin is the exception: it is pinned to the live end of the
  // loaded window, and once the forward walk reaches the present that is the live end of the
  // conversation, where an arriving message belongs on screen. Settling there while the origin is
  // still within reach of the row leaves a jump deep into history — clamped the same way with
  // nothing newer loaded yet — where it landed.
  const keepPinned = (caughtUp: boolean) => {
    const target = pinned && element?.querySelector(`[data-event="${pinned.id}"]`)

    if (target instanceof HTMLElement && pinned) {
      const origin = Math.abs(element!.scrollTop)

      if (pinned.clamped && caughtUp && topOf(target) > origin) {
        release()
        isProgrammaticScroll = true
        element!.scrollTo({top: 0})
      } else {
        const drift = topOf(target) - pinned.top

        if (Math.abs(drift) >= 1) {
          isProgrammaticScroll = true
          element!.scrollBy({top: drift})
        }
      }
    }
  }

  // Any scroll event at all fires while content loads, so taking over has to be a real gesture
  const release = () => {
    released = true
    pinned = undefined
  }

  // The list renders from the newest message outward, so a row deep in history isn't on the page
  // until it's asked for — and asking renders it on the next flush, which the lookup has to wait
  // for. Messages carry the id as a data attribute; the new-messages divider as its element id.
  const scrollToRow = (
    id: string,
    {
      behavior = "auto",
      highlight = false,
      pin = false,
    }: {behavior?: ScrollBehavior; highlight?: boolean; pin?: boolean} = {},
  ) => {
    virtualList?.reveal(id)

    requestAnimationFrame(() => {
      const target = element?.querySelector(`[data-event="${id}"]`) ?? document.getElementById(id)

      if (target instanceof HTMLElement) {
        isProgrammaticScroll = true
        target.scrollIntoView({behavior, block: "center"})

        if (highlight) {
          target.classList.add("highlight-target")
        }

        if (pin) {
          // A scroll that ended at the origin is one the browser clamped there, so the offset
          // below is as close to centred as the row could get rather than where it was put.
          pinned = {id, top: topOf(target), clamped: Math.abs(element!.scrollTop) < 1}
        }
      }

      jumpSettled = true
    })
  }

  const manageScrollPosition = () => {
    scrolledUp = Math.abs(element?.scrollTop || 0) > 1500

    const newMessages = document.getElementById("new-messages")

    if (newMessagesSeen) {
      showFixedNewMessages = false
    } else if (newMessages) {
      const {y} = newMessages.getBoundingClientRect()

      if (y > 0 && y < 300) {
        newMessagesSeen = true
        showFixedNewMessages = false
      } else {
        showFixedNewMessages = y < 0
      }
    }

    if (!released && !pinned && !isNaN(at)) {
      const targetEvent = $events.find(event => event.created_at >= at)

      if (targetEvent) {
        scrollToRow(targetEvent.id, {highlight: true, pin: true})
      } else {
        // Nothing to jump to yet, so don't hold the room back waiting for it
        jumpSettled = true
      }
    }
  }

  const onScroll = () => {
    if (!isProgrammaticScroll) {
      isUserScrolling = true
      clearIsUserScrolling()
      manageScrollPosition()
    }

    isProgrammaticScroll = false
  }

  const scrollToNewMessages = () => scrollToRow("new-messages", {behavior: "smooth"})

  // While the window stops short, dropping the anchor only takes the button away: where the reader
  // lands is then whatever the list settles on as it re-windows and the forward walk catches up,
  // which is not reliably the live end. Anchoring a fresh feed on the present puts it there.
  const scrollToBottom = async () => {
    const anchored = !isNaN(at)

    if (anchored) {
      release()
      await navigate($page.url.pathname, {replaceState: true})
      start(now())
    }

    element?.scrollTo({top: 0, behavior: anchored ? "auto" : "smooth"})
  }

  // A tab can be `visible` but unfocused (user alt-tabbed to another app), so we
  // can't rely on document.hidden alone to know the room is actually being watched.
  const onActiveChange = (active: boolean) => {
    if (!active) {
      lastVisibleAt = now()
    } else if ($events.some(e => e.pubkey !== $user.pubkey && e.created_at > lastVisibleAt)) {
      newMessagesAfter = lastVisibleAt
      newMessagesBefore = now()
      newMessagesSeen = false
    }
  }

  let joining = $state(false)
  let leaving = $state(false)
  let jumpSettled = $state(false)
  let released = false
  let pinned: Maybe<{id: string; top: number; clamped: boolean}>
  let feedAnchor: Maybe<number>
  let isProgrammaticScroll = $state(false)
  let isUserScrolling = $state(false)
  let virtualList: Maybe<VirtualListController> = $state()
  let older: Maybe<ReturnType<typeof makeScrollLoader>> = $state()
  let newer: Maybe<ReturnType<typeof makeScrollLoader>> = $state()
  let share: Maybe<Share> = $state()
  let parent: TrustedEvent | undefined = $state()
  let element: HTMLElement | undefined = $state()
  let lastVisibleAt = now()
  let newMessagesAfter = $state($checked[$page.url.pathname])
  let newMessagesBefore = $state(now())
  let newMessagesSeen = false
  let showFixedNewMessages = $state(false)
  let scrolledUp = $state(false)
  let cleanup: () => void
  let events: Readable<TrustedEvent[]> = $state(readable([]))
  let compose: RoomCompose | undefined = $state()
  let eventToEdit: TrustedEvent | undefined = $state()

  // A link into history renders the newest messages first and only then scrolls, so the room is
  // held back for that frame rather than showing the wrong end of the conversation and jumping.
  const awaitingJump = $derived(!isNaN(at) && !jumpSettled)

  const reachedStartOfHistory = $derived($older?.status === "exhausted")

  // A room paged from an anchor walks in both directions at once, and neither walk is worth a
  // loader of its own in the transcript — the page bar carries one for the pair of them.
  $effect(() => {
    pageLoading.set(isFeedLoading($older) || isFeedLoading($newer))

    return () => pageLoading.set(false)
  })

  // Claim the share once we're on screen. Sharing into the room you're already looking at
  // doesn't re-create this component, so this can't be read once on mount.
  $effect(() => {
    if ($pendingShare) {
      share = $pendingShare
      pendingShare.set(undefined)
    }
  })

  const sharedEvent = $derived(share?.type === "event" ? share.value : undefined)

  const initialValues = $derived.by((): Share | undefined => {
    if (eventToEdit) {
      return {type: "text", value: eventToEdit.content}
    }

    if (share) {
      return share
    }
  })

  const clearIsUserScrolling = debounce(150, () => {
    isUserScrolling = false
  })

  const elements = $derived(
    groupRoomMessages({
      events: $events,
      pubkey: $user.pubkey,
      addMemberKind,
      unreadAfter: newMessagesAfter,
      unreadBefore: newMessagesBefore,
    }),
  )

  // The window only stops short of the present after jumping into history — anything published
  // from here on arrives through the repository rather than through a forward walk.
  const windowStopsShort = $derived(!isNaN(at) && $newer?.status !== "exhausted")

  // While the window stops short, the bottom of the container is not the bottom of the
  // conversation, so the button is the way back to the live end rather than a scroll — which is
  // why it clears `at` instead of scrolling. Once the two are the same place, scroll position is
  // the whole answer.
  const showScrollButton = $derived(scrolledUp || windowStopsShort)

  // A search result or a notification jumping into the room already on screen changes the url
  // without re-creating this component, so the feed built on the old anchor has to be rebuilt
  // on the new one. `at` is NaN when there is no anchor, and NaN never equals itself.
  $effect(() => {
    if (!isNaN(at) && feedAnchor && at !== feedAnchor) {
      released = false
      pinned = undefined
      jumpSettled = false

      untrack(() => start(at))
    }
  })

  $effect(() => {
    if (elements.length > 0 && !isUserScrolling) {
      requestAnimationFrame(manageScrollPosition)
    }
  })

  // Content can arrive mid-scroll too, so this runs whether or not the reader is moving. The
  // forward walk reaching the present is the other thing a pin watches for, and it can land after
  // the last message does, so it is read here where the effect sees it change.
  $effect(() => {
    const caughtUp = !windowStopsShort

    if (elements.length > 0) {
      const frame = requestAnimationFrame(() => keepPinned(caughtUp))

      return () => cancelAnimationFrame(frame)
    }
  })

  // Bound here rather than in the markup: these watch for the reader taking over, they don't make
  // the transcript a control, and declaring them as handlers would claim it is one.
  $effect(() => {
    if (element) {
      const target = element

      for (const type of ["wheel", "touchmove", "keydown"]) {
        target.addEventListener(type, release, {passive: true})
      }

      return () => {
        for (const type of ["wheel", "touchmove", "keydown"]) {
          target.removeEventListener(type, release)
        }
      }
    }
  })

  const start = (anchor: number) => {
    cleanup?.()

    feedAnchor = anchor

    const feed = makeFeed({
      relays: [url],
      at: anchor,
      filters: [
        h ? {kinds: [MESSAGE, addMemberKind], "#h": [h]} : {kinds: [MESSAGE, addMemberKind]},
      ],
      onEvent: context.add,
    })

    // The container is reversed, so scrolling away from its origin reaches older messages and
    // sitting at the origin is the newest end.
    older = makeScrollLoader(element!, feed.loadOlder)
    newer = makeScrollLoader(element!, feed.loadNewer, {reverse: true})

    events = feed.events
    cleanup = () => {
      older?.stop()
      newer?.stop()
      feed.cleanup()
    }
  }

  const onEscape = () => {
    clearParent()
    clearShare()
    eventToEdit = undefined
  }

  const canEditEvent = (event: TrustedEvent) =>
    event.pubkey === $user.pubkey && event.created_at >= ago(5, MINUTE)

  const onEditEvent = (event: TrustedEvent) => {
    clearParent()
    clearShare()
    eventToEdit = event
  }

  const onEditPrevious = () => ifLet($events.toReversed().find(canEditEvent), onEditEvent)

  onMount(() => {
    // Defer rendering until navigation finishes
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => start(at || now()))
    })

    const unsubscribeActive = documentActive.subscribe(onActiveChange)

    return () => {
      cleanup?.()
      unsubscribeActive()
      cancelAnimationFrame(frame)
    }
  })
</script>

{#snippet membershipButton(label: string)}
  {#if $membershipStatus === MembershipStatus.Pending}
    <Button class="button button-neutral button-sm" disabled={leaving} onclick={leave}>
      <Icon icon={ClockCircle} />
      Access Pending
    </Button>
  {:else}
    <Button class="button button-neutral button-sm" disabled={joining} onclick={join}>
      {#if joining}
        <Spinner size="sm" />
      {:else}
        <Icon icon={Login2} />
      {/if}
      {label}
    </Button>
  {/if}
{/snippet}

<div
  class={cx(
    "room flex min-h-0 min-w-0 flex-1 flex-col",
    voiceConnectedHere && "bg-surface xl:flex-row xl:overflow-hidden",
  )}>
  {#if h && voiceConnectedHere}
    <!-- The controls belong to the video, so they share its column and the chat panel
         runs the full height beside it. Below xl the open chat takes the pane over
         instead of sharing it, leaving this column to shrink to just the controls. -->
    <div
      class={cx(
        "flex min-h-0 min-w-0 flex-col max-xl:order-last",
        callChatOpen ? "xl:flex-1" : "flex-1",
      )}>
      <VideoCallContent {url} {h} class={cx(callChatOpen && "max-xl:hidden")} />
      <div class="hide-on-keyboard flex shrink-0 items-center justify-center pb-2">
        <CallControlBar {url} {h} />
      </div>
    </div>
  {/if}

  <!-- Closed at xl, the negative margin takes the panel out of the flex line without
       changing its width, parking it past the room's clipped right edge — so the
       transition slides it in at full size rather than squeezing its contents. It
       only drops out of the layout below xl, where it has nothing to share the pane
       with. inert (not just pointer-events) so a parked panel leaves the tab order. -->
  <div
    inert={callChatHidden}
    class={cx(
      "relative flex min-h-0 min-w-0 flex-1 flex-col",
      voiceConnectedHere &&
        "xl:w-96 xl:flex-none xl:border-l xl:border-line xl:transition-[margin-right] xl:duration-200",
      callChatHidden && "max-xl:hidden xl:-mr-96",
    )}>
    {#if callChatOpen}
      <Button
        aria-label="Close room chat"
        class="button button-neutral button-xs button-circle absolute right-2 top-2 z-popover"
        onclick={closeChat}>
        <Icon icon={Close} size={4} />
      </Button>
    {/if}

    {#if h}
      <RoomPinnedMessages {url} {h} />
    {/if}

    <div class="relative flex min-h-0 flex-1 flex-col">
      <div
        bind:this={element}
        onscroll={onScroll}
        class={cx("room__content scroll-container transition-opacity", {
          "opacity-0": awaitingJump,
        })}>
        {#if $room?.meta?.isPrivate() && $membershipStatus !== MembershipStatus.Granted}
          <div class="py-20">
            <div class="card flex flex-col gap-8 m-auto max-w-md items-center text-center">
              <p class="opacity-75">You aren't currently a member of this room.</p>
              {@render membershipButton("Join Room")}
            </div>
          </div>
        {:else}
          <VirtualList
            items={elements}
            getKey={getElementKey}
            container={element}
            bind:controller={virtualList}>
            {#snippet row(item)}
              {#if item.type === "new-messages"}
                <div
                  id={item.id}
                  class={cx("flex items-center py-2 text-xs transition-colors", {
                    "opacity-0": showFixedNewMessages,
                  })}>
                  <div class="h-px grow bg-primary text-primary-content"></div>
                  <p
                    class="rounded-full bg-primary text-primary-content px-2 py-1"
                    style="color: var(--primary-content)">
                    New Messages
                  </p>
                  <div class="h-px grow bg-primary text-primary-content"></div>
                </div>
              {:else if item.type === "date"}
                <Divider>{item.value}</Divider>
              {:else if item.value.kind === addMemberKind}
                <RoomItemAddMember {url} event={item.value} />
              {:else}
                <RoomItem
                  {url}
                  {replyTo}
                  {context}
                  event={item.value}
                  showPubkey={item.showPubkey}
                  canEdit={canEditEvent}
                  onEdit={onEditEvent} />
              {/if}
            {/snippet}
          </VirtualList>
          <p class="flex h-10 items-center justify-center py-20">
            {#if reachedStartOfHistory}
              End of message history
            {/if}
          </p>
        {/if}
        <div class="h-screen"></div>
      </div>

      {#if showScrollButton}
        <div in:fade class="absolute bottom-2 right-4 z-popover">
          <Button
            aria-label="Jump to newest"
            class="button button-neutral button-circle"
            onclick={scrollToBottom}>
            <Icon icon={AltArrowDown} />
          </Button>
        </div>
      {/if}

      {#if showFixedNewMessages}
        <div
          transition:fly={{duration: 200}}
          class="absolute inset-x-0 top-2 z-popover flex justify-center">
          <Button class="button button-primary button-xs button-pill" onclick={scrollToNewMessages}>
            New Messages
          </Button>
        </div>
      {/if}
    </div>

    <div class="room__compose flex items-center gap-1 px-2">
      <div class="room__compose-inner min-w-0 flex-1">
        {#if $room?.meta?.isPrivate() && $membershipStatus !== MembershipStatus.Granted}
          <!-- pass -->
        {:else if $room?.meta?.isRestricted() && $membershipStatus !== MembershipStatus.Granted}
          <div class="card m-4 flex flex-row items-center justify-between px-4 py-3">
            <p class="opacity-75">Only members are allowed to post to this room.</p>
            {@render membershipButton("Ask to Join")}
          </div>
        {:else}
          <div class="flex flex-col gap-px">
            {#if parent}
              <ComposeParent {url} event={parent} clear={clearParent} verb="Replying to" />
            {/if}
            {#if sharedEvent}
              <ComposeParent {url} event={sharedEvent} clear={clearShare} verb="Sharing" />
            {/if}
            {#if eventToEdit}
              <ComposeEdit clear={clearEventToEdit} />
            {/if}
          </div>
          {#key initialValues}
            <RoomCompose
              {url}
              {h}
              {onSubmit}
              {onEscape}
              {onEditPrevious}
              {initialValues}
              bind:this={compose} />
          {/key}
        {/if}
      </div>
      {#if h && isVoiceRoom && !voiceConnectedHere}
        <div class="hide-on-keyboard flex shrink-0 items-center justify-center py-2">
          <CallControlBar {url} {h} />
        </div>
      {/if}
    </div>
  </div>
</div>
