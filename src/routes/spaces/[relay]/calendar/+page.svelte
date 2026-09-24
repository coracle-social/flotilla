<script lang="ts">
  import {onDestroy, onMount} from "svelte"
  import cx from "classnames"
  import type {Readable} from "svelte/store"
  import {readable} from "svelte/store"
  import type {Maybe} from "@welshman/lib"
  import type {TrustedEvent} from "@welshman/util"
  import {EVENT_TIME} from "@welshman/util"
  import CalendarMinimalistic from "@assets/icons/calendar-minimalistic.svg?dataurl"
  import AltArrowLeft from "@assets/icons/alt-arrow-left.svg?dataurl"
  import AltArrowRight from "@assets/icons/alt-arrow-right.svg?dataurl"
  import Add from "@assets/icons/add.svg?dataurl"
  import {fade} from "@lib/transition"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import PageContent from "@lib/components/PageContent.svelte"
  import SpaceBar from "@app/components/SpaceBar.svelte"
  import CalendarAgenda from "@app/components/CalendarAgenda.svelte"
  import CalendarMonth from "@app/components/CalendarMonth.svelte"
  import CalendarWeek from "@app/components/CalendarWeek.svelte"
  import CalendarEventCreate from "@app/components/CalendarEventCreate.svelte"
  import type {CalendarView} from "@app/calendar"
  import {
    addDays,
    addMonths,
    calendarView,
    formatMonth,
    formatWeekRange,
    getMonthDays,
    getWeekDays,
    groupEventsByDay,
    isCurrentMonth,
    isCurrentWeek,
  } from "@app/calendar"
  import {getModal, pushModal} from "@app/modal"
  import {decodeRelay} from "@app/relays"
  import {makeCommentFilter} from "@app/content"
  import {makeCalendarFeed, makeFeedContext, makeScrollLoader} from "@app/feeds"
  import type {PageProps} from "./$types"

  const {params}: PageProps = $props()

  const url = decodeRelay(params.relay)
  const context = makeFeedContext({relays: [url]})

  const makeEvent = () => pushModal(CalendarEventCreate, {url})

  const showView = (target: CalendarView) => () => calendarView.set(target)

  const showToday = () => {
    cursor = new Date()
  }

  const showPrevious = () => {
    cursor = view === "month" ? addMonths(cursor, -1) : addDays(cursor, -7)
  }

  const showNext = () => {
    cursor = view === "month" ? addMonths(cursor, 1) : addDays(cursor, 7)
  }

  // Paging a month at a time is a lot of clicking, so mirror what other calendars bind
  const onKeyDown = (event: KeyboardEvent) => {
    const target = event.target as HTMLElement | null

    if (view === "agenda" || getModal() || event.metaKey || event.ctrlKey || event.altKey) {
      return
    }

    if (
      target?.isContentEditable ||
      ["INPUT", "TEXTAREA", "SELECT"].includes(target?.tagName ?? "")
    ) {
      return
    }

    if (event.key === "ArrowLeft") {
      showPrevious()
    }
    if (event.key === "ArrowRight") {
      showNext()
    }
    if (event.key === "t") {
      showToday()
    }
  }

  const viewClass = (target: CalendarView) =>
    cx(
      "button join-item",
      isNarrow ? "button-xs" : "button-sm",
      view === target ? "button-primary" : "button-neutral",
    )

  let element: HTMLElement | undefined = $state()
  onDestroy(context.cleanup)

  let older: Maybe<ReturnType<typeof makeScrollLoader>> = $state()
  let newer: Maybe<ReturnType<typeof makeScrollLoader>> = $state()

  // A digest fills in across many spans, so a spinner keyed on a request in flight would blink.
  const loading = $derived(!$older || $older.status !== "exhausted")
  let events: Readable<TrustedEvent[]> = $state(readable([]))
  let feed: ReturnType<typeof makeCalendarFeed> | undefined = $state()
  let cursor = $state(new Date())
  let rangeLoading = $state(false)
  let latestRange = 0
  let width = $state(0)

  // Month renders poorly in a narrow column, so that gets week — without touching the preference
  const isNarrow = $derived(width > 0 && width < 768)
  const view = $derived(isNarrow && $calendarView === "month" ? "week" : $calendarView)

  const isCurrentRange = $derived(view === "month" ? isCurrentMonth(cursor) : isCurrentWeek(cursor))

  const rangeLabel = $derived(view === "month" ? formatMonth(cursor) : formatWeekRange(cursor))

  const visibleDays = $derived(view === "month" ? getMonthDays(cursor) : getWeekDays(cursor))

  // Grouped once here so both the grid and the feed's range query agree on what is on screen
  const eventsByDay = $derived(groupEventsByDay($events))

  // The month and week grids show a fixed range instead of scrolling into one, so ask for it directly
  $effect(() => {
    if (feed && view !== "agenda") {
      const days = visibleDays
      const range = ++latestRange

      rangeLoading = true

      feed
        .load(days[0].getTime() / 1000, addDays(days[days.length - 1], 1).getTime() / 1000)
        .finally(() => {
          // Paging faster than the relay answers would otherwise clear a newer range's spinner
          if (range === latestRange) {
            rangeLoading = false
          }
        })
    }
  })

  onMount(() => {
    feed = makeCalendarFeed({
      relays: [url],
      onEvent: context.add,
      filters: [{kinds: [EVENT_TIME]}, makeCommentFilter([EVENT_TIME])],
    })

    events = feed.events

    // The calendar runs in both directions from today, so both ends fetch as they are reached
    older = makeScrollLoader(element!, feed.loadOlder, {reverse: true})
    newer = makeScrollLoader(element!, feed.loadNewer)

    return () => {
      older?.stop()
      newer?.stop()
      feed?.cleanup()
    }
  })
</script>

<svelte:window onkeydown={onKeyDown} />

<SpaceBar>
  {#snippet leading()}
    <Icon icon={CalendarMinimalistic} />
  {/snippet}
  {#snippet title()}
    <strong>Calendar</strong>
  {/snippet}
  {#snippet action()}
    <div class="join">
      <Button
        class={viewClass("agenda")}
        aria-pressed={view === "agenda"}
        onclick={showView("agenda")}>
        Agenda
      </Button>
      <Button class={viewClass("week")} aria-pressed={view === "week"} onclick={showView("week")}>
        Week
      </Button>
      {#if !isNarrow}
        <Button
          class={viewClass("month")}
          aria-pressed={view === "month"}
          onclick={showView("month")}>
          Month
        </Button>
      {/if}
    </div>
    <Button class="button button-primary button-sm" onclick={makeEvent}>
      <Icon icon={Add} />
      Create
    </Button>
  {/snippet}
</SpaceBar>

<PageContent bind:element class="flex flex-col gap-2 p-2 sm:px-4">
  <div bind:clientWidth={width} class="flex flex-col gap-2">
    {#if view !== "agenda"}
      <div class="flex flex-wrap items-center gap-1 pt-2">
        <Button
          class="button button-neutral button-xs"
          aria-label="Show the previous {view}"
          onclick={showPrevious}>
          <Icon icon={AltArrowLeft} size={4} />
        </Button>
        <span class="w-48 text-center font-bold">{rangeLabel}</span>
        <Button
          class="button button-neutral button-xs"
          aria-label="Show the next {view}"
          onclick={showNext}>
          <Icon icon={AltArrowRight} size={4} />
        </Button>
        <Button
          class="button button-neutral button-xs"
          disabled={isCurrentRange}
          onclick={showToday}>
          Today
        </Button>
        <!-- Fixed width so its appearance doesn't nudge the buttons beside it -->
        <span class="flex w-4 items-center justify-center">
          {#if rangeLoading}
            <span class="spinner spinner-xs" transition:fade={{duration: 150}}></span>
          {/if}
        </span>
      </div>
    {/if}
    {#if view === "agenda"}
      <CalendarAgenda {url} events={$events} {element} {loading} {context} />
    {:else if view === "week"}
      <CalendarWeek {url} {events} {eventsByDay} date={cursor} {context} />
    {:else}
      <CalendarMonth {url} {events} {eventsByDay} date={cursor} {context} />
    {/if}
  </div>
</PageContent>
