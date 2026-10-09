<script lang="ts">
  import {onDestroy, onMount} from "svelte"
  import type {ComponentProps} from "svelte"
  import {readable} from "svelte/store"
  import type {Readable} from "svelte/store"
  import {page} from "$app/stores"
  import {debounce} from "throttle-debounce"
  import cx from "classnames"
  import {now, spec} from "@welshman/lib"
  import type {Maybe} from "@welshman/lib"
  import type {TrustedEvent} from "@welshman/util"
  import {MESSAGE, RELAY_ADD_MEMBER, ROOM_ADD_MEMBER} from "@welshman/util"
  import AltArrowDown from "@assets/icons/alt-arrow-down.svg?dataurl"
  import {fade, fly} from "@lib/transition"
  import {documentActive} from "@lib/html"
  import Button from "@lib/components/Button.svelte"
  import Divider from "@lib/components/Divider.svelte"
  import Icon from "@lib/components/Icon.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import VirtualList from "@lib/components/VirtualList.svelte"
  import type {VirtualListController} from "@lib/components/VirtualList.svelte"
  import {navigate} from "@app/modal"
  import RoomItem from "@app/components/RoomItem.svelte"
  import RoomItemAddMember from "@app/components/RoomItemAddMember.svelte"
  import RoomMembershipButton from "@app/components/RoomMembershipButton.svelte"
  import {user} from "@app/core"
  import {groupRoomMessages} from "@app/rooms"
  import {isFeedLoading, makeFeed, makeFeedContext, makeScrollLoader} from "@app/feeds"
  import {pageLoading} from "@app/loading"
  import {checked} from "@app/notifications"
  import {getPermalinkTarget, highlightedEvent} from "@app/routes"

  type Props = Pick<ComponentProps<typeof RoomItem>, "url" | "replyTo" | "canEdit" | "onEdit"> & {
    h?: string
    locked?: boolean
    events?: Readable<TrustedEvent[]>
  }

  let {url, h, locked, replyTo, canEdit, onEdit, events = $bindable(readable([]))}: Props = $props()

  const context = makeFeedContext({relays: [url]})

  onDestroy(context.cleanup)

  const addMemberKind = h ? ROOM_ADD_MEMBER : RELAY_ADD_MEMBER
  const at = $derived(parseInt($page.url.searchParams.get("at") ?? "") || undefined)
  const target = $derived(getPermalinkTarget($page.url))

  export const restart = () => start(at ?? now())

  const getElementKey = (element: {id: string}) => element.id

  // In screen terms rather than scroll terms, so the reversed layout doesn't come into it.
  const topOf = (target: HTMLElement) =>
    target.getBoundingClientRect().top - element!.getBoundingClientRect().top

  // Messages arriving at the origin push the pinned row away, and the browser does not compensate.
  const keepPinned = (caughtUp: boolean) => {
    const target = pinned && element?.querySelector(`[data-event="${pinned.id}"]`)

    if (target instanceof HTMLElement && pinned) {
      const origin = Math.abs(element!.scrollTop)

      // A pin clamped at the origin belongs at the live end once the forward walk catches up.
      if (pinned.clamped && caughtUp && topOf(target) > origin) {
        release()

        // Only a scroll event clears the flag, so claiming one that never fires discards the next.
        if (origin >= 1) {
          isProgrammaticScroll = true
          element!.scrollTo({top: 0})
        }
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

  // A row deep in history renders on the next flush after it is asked for, so the lookup waits for it.
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
          highlightedEvent.set(id)
        }

        if (pin) {
          // A scroll that ended at the origin is one the browser clamped there.
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

    if (at && !released && !pinned) {
      // The pointer only helps once that message has arrived, so the anchor still carries the jump.
      const pointedAt = target ? $events.find(spec({id: target})) : undefined
      const targetEvent = pointedAt ?? $events.find(event => event.created_at >= at)

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

  // Asking for the divider takes the scroll position over, so a permalink's pin lets go of it.
  const scrollToNewMessages = () => {
    release()
    scrollToRow("new-messages", {behavior: "smooth"})
  }

  // Dropping the anchor remounts the transcript on the present, which puts the reader at the live end.
  const scrollToBottom = () => {
    if (at) {
      navigate($page.url.pathname, {replaceState: true})
    } else {
      element?.scrollTo({top: 0, behavior: "smooth"})
    }
  }

  // A tab can be `visible` but unfocused, so `document.hidden` alone doesn't say the room is watched.
  const onActiveChange = (active: boolean) => {
    if (!active) {
      lastVisibleAt = now()
    } else if ($events.some(e => e.pubkey !== $user.pubkey && e.created_at > lastVisibleAt)) {
      newMessagesAfter = lastVisibleAt
      newMessagesBefore = now()
      newMessagesSeen = false
    }
  }

  let jumpSettled = $state(false)
  let released = false
  let pinned: Maybe<{id: string; top: number; clamped: boolean}>
  let isProgrammaticScroll = $state(false)
  let isUserScrolling = $state(false)
  let virtualList: Maybe<VirtualListController> = $state()
  let older: Maybe<ReturnType<typeof makeScrollLoader>> = $state()
  let newer: Maybe<ReturnType<typeof makeScrollLoader>> = $state()
  let element: HTMLElement | undefined = $state()
  let lastVisibleAt = now()
  let newMessagesAfter = $state($checked[$page.url.pathname])
  let newMessagesBefore = $state(now())
  let newMessagesSeen = false
  let showFixedNewMessages = $state(false)
  let scrolledUp = $state(false)
  let cleanup: () => void

  // A link into history renders the newest messages first and only then scrolls.
  const awaitingJump = $derived(Boolean(at) && !jumpSettled)

  const reachedStartOfHistory = $derived($older?.status === "exhausted")

  // A private room nobody has joined draws a join card rather than a transcript, so it waits on nothing.
  const awaitingContent = $derived(!(h && locked) && (awaitingJump || $events.length === 0))

  $effect(() => {
    pageLoading.set(awaitingContent && (isFeedLoading($older) || isFeedLoading($newer)))

    return () => pageLoading.set(false)
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

  // The window only stops short of the present after jumping into history.
  const windowStopsShort = $derived(Boolean(at) && $newer?.status !== "exhausted")

  // While the window stops short, the bottom of the container isn't the bottom of the conversation.
  const showScrollButton = $derived(scrolledUp || windowStopsShort)

  $effect(() => {
    if (elements.length > 0 && !isUserScrolling) {
      requestAnimationFrame(manageScrollPosition)
    }
  })

  // The forward walk can reach the present after the last message does, so the effect watches both.
  $effect(() => {
    const caughtUp = !windowStopsShort

    if (elements.length > 0) {
      const frame = requestAnimationFrame(() => keepPinned(caughtUp))

      return () => cancelAnimationFrame(frame)
    }
  })

  // Declaring these as handlers would claim the transcript is a control.
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

    const feed = makeFeed({
      relays: [url],
      at: anchor,
      filters: [
        h ? {kinds: [MESSAGE, addMemberKind], "#h": [h]} : {kinds: [MESSAGE, addMemberKind]},
      ],
      onEvent: context.add,
    })

    // The container is reversed, so scrolling away from the origin reaches older messages.
    older = makeScrollLoader(element!, feed.loadOlder)
    newer = makeScrollLoader(element!, feed.loadNewer, {reverse: true})

    events = feed.events
    cleanup = () => {
      older?.stop()
      newer?.stop()
      feed.cleanup()
    }
  }

  onMount(() => {
    // Defer rendering until navigation finishes
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(restart)
    })

    const unsubscribeActive = documentActive.subscribe(onActiveChange)

    return () => {
      cleanup?.()
      unsubscribeActive()
      cancelAnimationFrame(frame)
    }
  })
</script>

<div class="relative flex min-h-0 flex-1 flex-col">
  <div
    bind:this={element}
    onscroll={onScroll}
    class={cx("room__content scroll-container transition-opacity", {
      "opacity-0": awaitingJump,
    })}>
    {#if h && locked}
      <div class="py-20">
        <div class="card flex flex-col gap-8 m-auto max-w-md items-center text-center">
          <p class="opacity-75">You aren't currently a member of this room.</p>
          <RoomMembershipButton {url} {h} label="Join Room" onJoin={restart} />
        </div>
      </div>
    {:else}
      <VirtualList
        items={elements}
        getKey={getElementKey}
        container={element}
        threshold={older?.runway}
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
              {canEdit}
              {onEdit}
              event={item.value}
              showPubkey={item.showPubkey} />
          {/if}
        {/snippet}
      </VirtualList>
      <p class="flex h-10 items-center justify-center py-20">
        {#if reachedStartOfHistory}
          End of message history
        {:else}
          <Spinner loading>Looking for messages...</Spinner>
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
