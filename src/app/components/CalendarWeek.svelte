<script lang="ts">
  import cx from "classnames"
  import type {Readable} from "svelte/store"
  import {LOCALE} from "@welshman/lib"
  import type {TrustedEvent} from "@welshman/util"
  import Button from "@lib/components/Button.svelte"
  import CalendarDay from "@app/components/CalendarDay.svelte"
  import CalendarEventChip from "@app/components/CalendarEventChip.svelte"
  import type {FeedContext} from "@app/feeds"
  import {
    formatDay,
    formatWeekday,
    getSingleDayEvents,
    getWeekDays,
    isToday,
    layoutMultiDayBars,
    makeDayKey,
  } from "@app/calendar"
  import {pushModal} from "@app/modal"

  type Props = {
    url: string
    events: Readable<TrustedEvent[]>
    eventsByDay: Map<string, TrustedEvent[]>
    date: Date
    context: FeedContext
  }

  const {url, events, eventsByDay, date, context}: Props = $props()

  // The feed's own store is passed through rather than a pre-filtered list, since a modal's
  // props are frozen at push time and wouldn't pick up an event created from inside it.
  const showDay = (day: Date) =>
    pushModal(CalendarDay, {
      url,
      date: day,
      events,
      context,
    })

  const days = $derived(getWeekDays(date))
  const bars = $derived(layoutMultiDayBars(days, eventsByDay))
  const laneCount = $derived(bars.reduce((max, bar) => Math.max(max, bar.lane + 1), 0))
  const lanes = $derived(Array.from({length: laneCount}, (_, i) => i))

  const dayHeaderClass = (day: Date) =>
    cx("rounded-full px-1.5 text-sm", {"bg-primary text-primary-content": isToday(day)})
</script>

<!-- Sized to the space this component has, not the viewport, so it stacks by content width -->
<div class="@container overflow-hidden rounded-2xl border border-solid border-line">
  <div class="flex flex-col gap-px bg-line @3xl:hidden">
    {#each days as day (day.getTime())}
      {@const dayEvents = eventsByDay.get(makeDayKey(day)) ?? []}
      <div
        class={cx("flex min-h-16 flex-col gap-1 bg-surface p-2", {
          "border border-solid border-primary": isToday(day),
        })}>
        <Button
          class="flex items-baseline gap-2 self-start rounded-lg px-1 transition-colors hover:bg-surface-more"
          aria-label={formatDay(day)}
          onclick={() => showDay(day)}>
          <span class="text-xs uppercase opacity-75">{formatWeekday(day)}</span>
          <span class={dayHeaderClass(day)}>
            {Intl.DateTimeFormat(LOCALE, {day: "numeric"}).format(day)}
          </span>
        </Button>
        {#each dayEvents as event (event.id)}
          <CalendarEventChip {url} {event} {day} />
        {:else}
          <span class="px-1 text-xs opacity-40">—</span>
        {/each}
      </div>
    {/each}
  </div>
  <div
    class="hidden grid-cols-7 gap-x-px bg-line @3xl:grid"
    style="grid-template-rows: auto {laneCount > 0 ? `repeat(${laneCount}, 1.75rem)` : ''} 1fr;">
    <!-- The header and multi-day-bar rows don't otherwise paint a background of their own, so the
         gap-x-px/bg-line hairline trick that separates the day columns below would instead leak
         through as a wide band behind them -->
    {#each days as day, col (day.getTime())}
      <div class="bg-surface" style="grid-column: {col + 1}; grid-row: 1;"></div>
    {/each}
    {#each lanes as lane (lane)}
      {#each days as day, col (day.getTime())}
        <div class="bg-surface" style="grid-column: {col + 1}; grid-row: {lane + 2};"></div>
      {/each}
    {/each}
    {#each days as day, col (day.getTime())}
      <Button
        class="mx-1 mt-1 flex items-baseline gap-2 self-start justify-self-start rounded-lg px-1 transition-colors hover:bg-surface-more"
        style="grid-column: {col + 1}; grid-row: 1;"
        aria-label={formatDay(day)}
        onclick={() => showDay(day)}>
        <span class="text-xs uppercase opacity-75">{formatWeekday(day)}</span>
        <span class={dayHeaderClass(day)}>
          {Intl.DateTimeFormat(LOCALE, {day: "numeric"}).format(day)}
        </span>
      </Button>
    {/each}
    {#each bars as bar (bar.event.id)}
      <div
        class={cx("flex min-w-0 items-center py-0.5", {
          "pl-1": !bar.continuesBefore,
          "pr-1": !bar.continuesAfter,
        })}
        style="grid-column: {bar.startCol + 1} / {bar.startCol +
          1 +
          bar.span}; grid-row: {bar.lane + 2};">
        <CalendarEventChip
          {url}
          event={bar.event}
          day={days[bar.startCol]}
          continuesAfter={bar.continuesAfter}
          class="w-full" />
      </div>
    {/each}
    {#each days as day, col (day.getTime())}
      {@const dayEvents = getSingleDayEvents(eventsByDay.get(makeDayKey(day)) ?? [])}
      <div
        class={cx("flex min-h-96 flex-col gap-1 bg-surface px-1 pt-1 pb-2", {
          "border border-solid border-primary": isToday(day),
        })}
        style="grid-column: {col + 1}; grid-row: {laneCount + 2} / -1;">
        {#each dayEvents as event (event.id)}
          <CalendarEventChip {url} {event} {day} />
        {:else}
          <span class="px-1 text-xs opacity-40">—</span>
        {/each}
      </div>
    {/each}
  </div>
</div>
