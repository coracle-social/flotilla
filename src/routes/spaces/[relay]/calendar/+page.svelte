<script lang="ts">
  import {onDestroy, onMount} from "svelte"
  import {dateToSeconds} from "@welshman/lib"
  import CalendarMinimalistic from "@assets/icons/calendar-minimalistic.svg?dataurl"
  import AltArrowLeft from "@assets/icons/alt-arrow-left.svg?dataurl"
  import AltArrowRight from "@assets/icons/alt-arrow-right.svg?dataurl"
  import Add from "@assets/icons/add.svg?dataurl"
  import {fade} from "@lib/transition"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import SegmentedButtons from "@lib/components/SegmentedButtons.svelte"
  import type {SegmentedOption} from "@lib/components/SegmentedButtons.svelte"
  import PageContent from "@lib/components/PageContent.svelte"
  import {followScroll} from "@lib/pager"
  import SpaceBar from "@app/components/SpaceBar.svelte"
  import CalendarAgenda from "@app/components/CalendarAgenda.svelte"
  import CalendarMonth from "@app/components/CalendarMonth.svelte"
  import CalendarWeek from "@app/components/CalendarWeek.svelte"
  import CalendarEventCreate from "@app/components/CalendarEventCreate.svelte"
  import {makeCalendarFeed} from "@app/features/feeds"
  import type {CalendarView} from "@app/features/spaces/calendar"
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
  } from "@app/features/spaces/calendar"
  import {getModal, pushModal} from "@app/navigation/dialogs"
  import * as pages from "@app/navigation/pages"
  import type {PageProps} from "./$types"

  const {params}: PageProps = $props()

  const {url} = pages.calendar.decode(params)
  const feed = makeCalendarFeed({url})
  const {events} = feed
  const olderStatus = feed.older.status

  const makeEvent = () => pushModal(CalendarEventCreate, {url})

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

  let element: HTMLElement | undefined = $state()
  let cursor = $state(new Date())
  let rangeLoading = $state(false)
  let latestRange = 0
  let width = $state(0)

  // A digest fills in across many windows, so a spinner keyed on a request in flight would blink.
  const loading = $derived($olderStatus !== "exhausted")

  onDestroy(() => {
    feed.stop()
  })

  // Month renders poorly in a narrow column, so that gets week — without touching the preference
  const isNarrow = $derived(width > 0 && width < 768)
  const view = $derived(isNarrow && $calendarView === "month" ? "week" : $calendarView)

  const viewOptions: SegmentedOption<CalendarView>[] = $derived(
    isNarrow
      ? [
          {value: "agenda", label: "Agenda"},
          {value: "week", label: "Week"},
        ]
      : [
          {value: "agenda", label: "Agenda"},
          {value: "week", label: "Week"},
          {value: "month", label: "Month"},
        ],
  )

  const isCurrentRange = $derived(view === "month" ? isCurrentMonth(cursor) : isCurrentWeek(cursor))

  const rangeLabel = $derived(view === "month" ? formatMonth(cursor) : formatWeekRange(cursor))

  const visibleDays = $derived(view === "month" ? getMonthDays(cursor) : getWeekDays(cursor))

  // Grouped once here so both the grid and the feed's range query agree on what is on screen
  const eventsByDay = $derived(groupEventsByDay($events))

  // The month and week grids show a fixed range instead of scrolling into one, so ask for it directly
  $effect(() => {
    if (view !== "agenda") {
      const days = visibleDays
      const range = ++latestRange

      rangeLoading = true

      feed
        .load(dateToSeconds(days[0]), dateToSeconds(addDays(days[days.length - 1], 1)))
        .catch(error => console.error(error))
        .finally(() => {
          // Paging faster than the relay answers would otherwise clear a newer range's spinner
          if (range === latestRange) {
            rangeLoading = false
          }
        })
    }
  })

  onMount(() => {
    // The calendar runs in both directions from today, so both ends fetch as they are reached
    const stopOlder = followScroll(element!, feed.older, {reverse: true})
    const stopNewer = followScroll(element!, feed.newer)

    return () => {
      stopOlder()
      stopNewer()
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
    <SegmentedButtons
      joined
      size={isNarrow ? "xs" : "sm"}
      options={viewOptions}
      bind:value={() => view, calendarView.set} />
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
      <CalendarAgenda {url} events={$events} {element} {loading} />
    {:else if view === "week"}
      <CalendarWeek {url} {events} {eventsByDay} date={cursor} />
    {:else}
      <CalendarMonth {url} {events} {eventsByDay} date={cursor} />
    {/if}
  </div>
</PageContent>
