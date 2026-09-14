<script lang="ts">
  import cx from "classnames"
  import type {Readable} from "svelte/store"
  import {LOCALE, chunk} from "@welshman/lib"
  import type {TrustedEvent} from "@welshman/util"
  import Button from "@lib/components/Button.svelte"
  import CalendarDay from "@app/components/CalendarDay.svelte"
  import CalendarEventChip from "@app/components/CalendarEventChip.svelte"
  import type {FeedContext} from "@app/feeds"
  import {
    formatDay,
    formatWeekday,
    getMonthDays,
    getSingleDayEvents,
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

  // A cell only has room for a few events, so the rest of the day lives in a modal. The feed's
  // own store is passed through rather than a pre-filtered list, since a modal's props are
  // frozen at push time and wouldn't pick up an event created from inside it.
  const showDay = (day: Date) =>
    pushModal(CalendarDay, {
      url,
      date: day,
      events,
      context,
    })

  const weeks = $derived(chunk(7, getMonthDays(date)))
  const weekBars = $derived(weeks.map(week => layoutMultiDayBars(week, eventsByDay)))

  // Shared across every row so the grid stays a uniform height, not just tallest-in-its-own-week
  const laneCount = $derived(
    weekBars.reduce(
      (max, bars) =>
        Math.max(
          max,
          bars.reduce((m, bar) => Math.max(m, bar.lane + 1), 0),
        ),
      0,
    ),
  )
</script>

<div class="overflow-hidden rounded-2xl border border-solid border-line bg-surface">
  <div class="grid grid-cols-7 bg-surface-more">
    {#each weeks[0] as day (day.getTime())}
      <div class="p-2 text-center text-xs uppercase opacity-75">{formatWeekday(day)}</div>
    {/each}
  </div>
  {#each weeks as week, weekIndex (week[0].getTime())}
    {@const bars = weekBars[weekIndex]}
    <div
      class="grid min-h-24 grid-cols-7 gap-y-1 border-t border-solid border-line pb-1"
      style="grid-template-rows: auto {laneCount > 0 ? `repeat(${laneCount}, 1.5rem)` : ''} 1fr;">
      {#each week as day, col (day.getTime())}
        <Button
          class={cx(
            "mx-1 mt-1 self-start justify-self-start rounded-full px-1.5 text-xs transition-colors",
            {
              "bg-primary text-primary-content": isToday(day),
              "hover:bg-surface-more": !isToday(day),
              "opacity-40": day.getMonth() !== date.getMonth(),
            },
          )}
          style="grid-column: {col + 1}; grid-row: 1;"
          aria-label={formatDay(day)}
          onclick={() => showDay(day)}>
          {Intl.DateTimeFormat(LOCALE, {day: "numeric"}).format(day)}
        </Button>
      {/each}
      {#each bars as bar (bar.event.id)}
        <div
          class={cx("flex min-w-0 items-stretch", {
            "pl-1": !bar.continuesBefore,
            "pr-1": !bar.continuesAfter,
          })}
          style="grid-column: {bar.startCol + 1} / {bar.startCol +
            1 +
            bar.span}; grid-row: {bar.lane + 2};">
          <CalendarEventChip
            {url}
            event={bar.event}
            day={week[bar.startCol]}
            continuesAfter={bar.continuesAfter}
            class="w-full" />
        </div>
      {/each}
      {#each week as day, col (day.getTime())}
        {@const dayEvents = getSingleDayEvents(eventsByDay.get(makeDayKey(day)) ?? [])}
        <div
          class={cx("flex min-w-0 flex-col gap-1 px-1", {
            "opacity-40": day.getMonth() !== date.getMonth(),
          })}
          style="grid-column: {col + 1}; grid-row: {laneCount + 2} / -1;">
          {#each dayEvents.slice(0, 3) as event (event.id)}
            <CalendarEventChip {url} {event} {day} />
          {/each}
          {#if dayEvents.length > 3}
            <Button
              class="px-1.5 text-left text-xs opacity-75 hover:opacity-100"
              onclick={() => showDay(day)}>
              +{dayEvents.length - 3} more
            </Button>
          {/if}
        </div>
      {/each}
    </div>
  {/each}
</div>
