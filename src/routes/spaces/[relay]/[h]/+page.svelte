<script lang="ts">
  import {onMount, onDestroy, tick} from "svelte"
  import {readable} from "svelte/store"
  import cx from "classnames"
  import {goto} from "$app/navigation"
  import {page} from "$app/stores"
  import type {Readable} from "svelte/store"
  import {
    pubkey,
    publishThunk,
    waitForThunkError,
    joinRoom,
    leaveRoom,
    createSearch,
  } from "@welshman/app"
  import {now, int, formatTimestampAsDate, ago, MINUTE, sleep} from "@welshman/lib"
  import type {MakeNonOptional} from "@welshman/lib"
  import type {TrustedEvent, EventContent} from "@welshman/util"
  import {
    getTagValue,
    makeEvent,
    makeRoomMeta,
    MESSAGE,
    ROOM_ADD_MEMBER,
    ROOM_REMOVE_MEMBER,
  } from "@welshman/util"
  import {load} from "@welshman/net"
  import AltArrowDown from "@assets/icons/alt-arrow-down.svg?dataurl"
  import CloseCircle from "@assets/icons/close-circle.svg?dataurl"
  import ClockCircle from "@assets/icons/clock-circle.svg?dataurl"
  import InfoCircle from "@assets/icons/info-circle.svg?dataurl"
  import Login2 from "@assets/icons/login-3.svg?dataurl"
  import Magnifier from "@assets/icons/magnifier.svg?dataurl"
  import {scrollToEvent} from "@lib/html"
  import {slide, fade, fly} from "@lib/transition"
  import Button from "@lib/components/Button.svelte"
  import Divider from "@lib/components/Divider.svelte"
  import Icon from "@lib/components/Icon.svelte"
  import PageBar from "@lib/components/PageBar.svelte"
  import PageContent from "@lib/components/PageContent.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import RoomCompose from "@app/components/RoomCompose.svelte"
  import RoomComposeParent from "@app/components/RoomComposeParent.svelte"
  import RoomImage from "@app/components/RoomImage.svelte"
  import RoomDetail from "@app/components/RoomDetail.svelte"
  import RoomItem from "@app/components/RoomItem.svelte"
  import RoomName from "@app/components/RoomName.svelte"
  import SpaceMenuButton from "@app/components/SpaceMenuButton.svelte"
  import ThunkToast from "@app/components/ThunkToast.svelte"
  import RoomItemAddMember from "@src/app/components/RoomItemAddMember.svelte"
  import RoomComposeEdit from "@src/app/components/RoomComposeEdit.svelte"
  import RoomItemRemoveMember from "@src/app/components/RoomItemRemoveMember.svelte"
  import {canEnforceNip70, prependParent, publishDelete} from "@app/core/commands"
  import {
    decodeRelay,
    deriveEventsForUrl,
    displayRoom,
    deriveRoom,
    deriveUserRoomMembershipStatus,
    MESSAGE_KINDS,
    MembershipStatus,
    PROTECTED,
    userSettingsValues,
  } from "@app/core/state"
  import {makeFeed} from "@app/core/requests"
  import {popKey, setKey} from "@lib/implicit"
  import {checked} from "@app/util/notifications"
  import {pushModal} from "@app/util/modal"
  import {makeRoomPath} from "@app/util/routes"
  import {pushToast} from "@app/util/toast"

  const {h, relay} = $page.params as MakeNonOptional<typeof $page.params>
  const mounted = now()
  const lastChecked = $checked[$page.url.pathname]
  const url = decodeRelay(relay)
  const room = deriveRoom(url, h)
  const shouldProtect = canEnforceNip70(url)
  const membershipStatus = deriveUserRoomMembershipStatus(url, h)
  const spaceMessages = deriveEventsForUrl(url, [{kinds: [MESSAGE]}])
  const pendingSearchEvent = popKey<TrustedEvent | undefined>("room_search_event")

  const ageSections = [
    {key: "day", label: "Last 24 Hours"},
    {key: "week", label: "Last 7 Days"},
    {key: "older", label: "Older"},
  ] as const

  type AgeSectionKey = (typeof ageSections)[number]["key"]

  type RoomSearchResult = {
    id: string
    h: string
    roomName: string
    event: TrustedEvent
    searchText: string
  }

  type RoomSearchResultItem = RoomSearchResult & {
    ageLabel: string
    ageSection: AgeSectionKey
    dateLabel: string
    preview: string
  }

  const showRoomDetail = () => pushModal(RoomDetail, {url, h})

  const showRoomSearch = () => {
    showRoomSearchResults = true
  }

  const closeRoomSearch = () => {
    showRoomSearchResults = false
  }

  const clearRoomSearch = () => {
    roomSearchTerm = ""
    showRoomSearchResults = false
  }

  const onRoomSearchInput = () => {
    showRoomSearchResults = Boolean(roomSearchTerm.trim())
  }

  const normalizeSearchText = (value: string) =>
    value
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .replace(/\s+/g, " ")
      .trim()

  const matchesAllTerms = (query: string, value: string) => {
    const terms = normalizeSearchText(query).split(" ").filter(Boolean)
    const normalizedValue = normalizeSearchText(value)

    return terms.every(term => normalizedValue.includes(term))
  }

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
    try {
      tags.push(["h", h])

      if (await shouldProtect) {
        tags.push(PROTECTED)
      }

      let template: EventContent & {created_at?: number} = {content, tags}

      if (eventToEdit) {
        // Don't do anything if message hasn't changed
        if (eventToEdit.content === content) {
          return
        }

        // Delete previous message, to be republished with same timestamp
        template.created_at = eventToEdit.created_at
        publishDelete({
          relays: [url],
          event: $state.snapshot(eventToEdit),
          protect: await shouldProtect,
        })
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
  let revealInFeed = (_id: string, _event?: TrustedEvent) => false
  let compose: RoomCompose | undefined = $state()
  let eventToEdit: TrustedEvent | undefined = $state()
  let roomSearchTerm = $state("")
  let showRoomSearchResults = $state(false)
  let jumpInFlight = $state(false)
  let lastJumpId: string | undefined = $state()

  const trimmedRoomSearchTerm = $derived(roomSearchTerm.trim())

  const roomSearchResults = $derived.by(() => {
    if (!trimmedRoomSearchTerm) {
      return [] as RoomSearchResult[]
    }

    const search = createSearch(
      $spaceMessages.map(event => {
        const eventH = getTagValue("h", event.tags) || "chat"
        const roomName = eventH === "chat" ? "Space Chat" : displayRoom(url, eventH)

        return {
          id: event.id,
          h: eventH,
          roomName,
          event,
          searchText: `${roomName} ${event.content}`.trim(),
        } as RoomSearchResult
      }),
      {
        getValue: result => result.id,
        fuseOptions: {keys: ["searchText", "roomName"]},
      },
    )

    return (search.searchOptions(trimmedRoomSearchTerm) as RoomSearchResult[]).filter(result =>
      matchesAllTerms(trimmedRoomSearchTerm, result.searchText),
    )
  })

  const spaceMessageById = $derived(
    new Map($spaceMessages.map(event => [event.id, event] as const)),
  )

  const groupedRoomSearchResults = $derived.by(() => {
    const groupedByRoom = new Map<
      string,
      {
        h: string
        roomName: string
        sections: Record<AgeSectionKey, RoomSearchResultItem[]>
      }
    >()

    for (const result of roomSearchResults) {
      let roomGroup = groupedByRoom.get(result.h)

      if (!roomGroup) {
        roomGroup = {
          h: result.h,
          roomName: result.roomName,
          sections: {day: [], week: [], older: []},
        }
      }

      const preview = result.event.content.trim() || "(No text content)"
      const ageSection = getAgeSection(result.event.created_at)

      roomGroup.sections[ageSection].push({
        ...result,
        ageSection,
        ageLabel: getAgeLabel(result.event.created_at),
        dateLabel: formatTimestampAsDate(result.event.created_at),
        preview,
      })

      groupedByRoom.set(result.h, roomGroup)
    }

    return Array.from(groupedByRoom.values())
      .sort((a, b) => {
        if (a.h === h) return -1
        if (b.h === h) return 1
        return a.roomName.localeCompare(b.roomName)
      })
      .map(group => ({
        ...group,
        visibleSections: ageSections
          .map(section => ({
            ...section,
            items: group.sections[section.key].sort(
              (a, b) => b.event.created_at - a.event.created_at,
            ),
          }))
          .filter(section => section.items.length > 0),
      }))
  })

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
    revealInFeed = feed.reveal
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

  const getAgeSection = (createdAt: number): AgeSectionKey => {
    const age = now() - createdAt

    if (age <= 24 * 60 * 60) {
      return "day"
    }

    if (age <= 7 * 24 * 60 * 60) {
      return "week"
    }

    return "older"
  }

  const getAgeLabel = (createdAt: number) => {
    const age = now() - createdAt

    if (age < 60) {
      return "Just now"
    }

    if (age < 60 * 60) {
      return `${Math.floor(age / 60)}m ago`
    }

    if (age < 24 * 60 * 60) {
      return `${Math.floor(age / (60 * 60))}h ago`
    }

    return `${Math.floor(age / (24 * 60 * 60))}d ago`
  }

  const revealMessageById = async (id: string, targetEvent?: TrustedEvent) => {
    const tryScroll = async () => {
      for (let i = 0; i < 4; i++) {
        if (await scrollToEvent(id, 0)) {
          return true
        }

        await tick()
        await sleep(120)
      }

      return false
    }

    let revealed = false
    let inserted = revealInFeed(id, targetEvent)

    if (inserted) {
      await tick()
    }

    revealed = await tryScroll()

    if (!revealed) {
      await load({relays: [url], filters: [{ids: [id]}]})
      inserted = revealInFeed(id, targetEvent)

      if (inserted) {
        await tick()
      }

      revealed = await tryScroll()
    }

    for (let i = 0; i < 18 && !revealed; i++) {
      await sleep(250)
      inserted = revealInFeed(id, targetEvent)

      if (inserted) {
        await tick()
      }

      revealed = await tryScroll()
    }

    return revealed
  }

  const stabilizeJumpScroll = async (id: string) => {
    const maybeCenter = (behavior: "auto" | "smooth") => {
      const element = document.querySelector(`[data-event="${id}"]`)

      if (!element) {
        return
      }

      const {top, bottom} = element.getBoundingClientRect()
      const viewport = window.innerHeight
      const inViewBand = top >= viewport * 0.2 && bottom <= viewport * 0.8

      if (!inViewBand) {
        element.scrollIntoView({behavior, block: "center"})
      }
    }

    await sleep(220)
    maybeCenter("smooth")
    await sleep(320)
    maybeCenter("auto")
  }

  const openRoomSearchResult = async (eventId: string, targetH: string) => {
    const targetPath = makeRoomPath(url, targetH)
    const targetEvent = spaceMessageById.get(eventId)

    if (targetEvent) {
      setKey("room_search_event", targetEvent)
    }

    if ($page.url.pathname === targetPath) {
      await handleJump(eventId)
      return
    }

    await goto(`${targetPath}?jump=${encodeURIComponent(eventId)}`, {
      noScroll: true,
      keepFocus: true,
    })
  }

  const clearJumpParam = () => {
    const next = new URL($page.url)
    next.searchParams.delete("jump")
    window.history.replaceState(
      window.history.state,
      "",
      `${next.pathname}${next.search}${next.hash}`,
    )
  }

  const handleJump = async (jumpId: string) => {
    if (jumpInFlight && lastJumpId === jumpId) {
      return
    }

    jumpInFlight = true
    lastJumpId = jumpId

    const targetEvent = pendingSearchEvent?.id === jumpId ? pendingSearchEvent : undefined
    const revealed = await revealMessageById(jumpId, targetEvent)

    if (!revealed) {
      pushToast({theme: "error", message: "Could not load this older message yet."})
    } else {
      await stabilizeJumpScroll(jumpId)
    }

    clearJumpParam()
    jumpInFlight = false
  }

  const onRoomSearchResultClick = (event: MouseEvent) => {
    closeRoomSearch()

    const eventId = (event.currentTarget as HTMLElement).dataset.eventId
    const targetH = (event.currentTarget as HTMLElement).dataset.roomH || h

    if (!eventId) {
      return
    }

    void openRoomSearchResult(eventId, targetH)
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

  $effect(() => {
    const jumpId = $page.url.searchParams.get("jump")

    if (!jumpId) {
      return
    }

    setTimeout(() => {
      void handleJump(jumpId)
    }, 400)
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
    <div class="row-2">
      <RoomName {url} {h} />
      <Button
        class="btn btn-neutral btn-xs tooltip tooltip-bottom"
        data-tip="Room information"
        onclick={showRoomDetail}>
        <Icon size={4} icon={InfoCircle} />
      </Button>
    </div>
  {/snippet}
  {#snippet action()}
    <div class="row-2 w-[10.5rem] min-w-0 shrink-0 sm:w-[14rem] md:w-auto">
      <label class="input input-sm input-bordered flex min-w-0 w-full items-center gap-2 md:w-64">
        <Icon size={4} icon={Magnifier} />
        <input
          bind:value={roomSearchTerm}
          class="min-w-0 grow"
          type="text"
          placeholder="Search space messages..."
          onfocus={showRoomSearch}
          oninput={onRoomSearchInput} />
      </label>
      <div class="shrink-0">
        <SpaceMenuButton {url} />
      </div>
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

{#if showRoomSearchResults}
  <div>
    <button
      class="fixed inset-0 z-feature"
      aria-label="Close search results"
      onclick={closeRoomSearch}></button>
    <div class="cw fixed top-[calc(var(--sait)+3rem)] z-popover p-2">
      <div
        transition:fly={{y: -40, duration: 150}}
        class="mx-auto flex w-[42rem] max-w-full flex-col overflow-hidden rounded-box border border-base-content/15 bg-base-100 shadow-xl md:ml-auto md:mr-0">
        <div class="row-2 border-b border-base-100 p-3">
          <strong>Search Results</strong>
          <div class="grow"></div>
          <Button class="btn btn-ghost btn-sm" onclick={clearRoomSearch}>Clear</Button>
          <Button class="btn btn-ghost btn-sm" onclick={closeRoomSearch}>
            <Icon size={4} icon={CloseCircle} />
          </Button>
        </div>
        <div class="max-h-[65vh] overflow-y-auto bg-base-100 p-4">
          {#if !trimmedRoomSearchTerm}
            <p class="text-sm opacity-70">Search for messages across all rooms in this space.</p>
          {:else if groupedRoomSearchResults.length === 0}
            <p class="text-sm opacity-70">No results found.</p>
          {:else}
            <div class="col-3">
              {#each groupedRoomSearchResults as roomGroup (roomGroup.h)}
                <section class="col-2">
                  <h4 class={cx("text-sm font-semibold", roomGroup.h === h && "text-primary")}>
                    {roomGroup.roomName}
                  </h4>
                  {#each roomGroup.visibleSections as section (section.key)}
                    <div class="col-2">
                      <p class="text-xs uppercase tracking-wide opacity-60">{section.label}</p>
                      <div class="col-2">
                        {#each section.items as result (result.id)}
                          <div class="p-1">
                            <button
                              data-event-id={result.id}
                              data-room-h={result.h}
                              class={cx(
                                "col-2 w-full rounded-box bg-base-300 p-4 text-left transition-colors hover:bg-base-200",
                                result.h === h && "border border-primary/40",
                              )}
                              onclick={onRoomSearchResultClick}>
                              <p class="line-clamp-2 text-sm">{result.preview}</p>
                              <div class="row-2 text-xs opacity-70">
                                <span>{result.ageLabel}</span>
                                <span>{result.dateLabel}</span>
                              </div>
                            </button>
                          </div>
                        {/each}
                      </div>
                    </div>
                  {/each}
                </section>
              {/each}
            </div>
          {/if}
        </div>
      </div>
    </div>
  </div>
{/if}

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
