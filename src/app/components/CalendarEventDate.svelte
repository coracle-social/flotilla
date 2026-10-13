<script lang="ts">
  import {LOCALE, secondsToDate} from "@welshman/lib"
  import type {TrustedEvent} from "@welshman/util"
  import {TimeEvent} from "@welshman/domain"
  import {reader} from "@app/core/domain"

  type Props = {
    event: TrustedEvent
  }

  const {event}: Props = $props()

  const timeEvent = $derived(reader(TimeEvent)(event))

  const start = $derived(timeEvent.start())
</script>

{#if start}
  {@const startDate = secondsToDate(start)}
  <div
    class="hidden h-32 w-32 min-w-32 flex-col items-center justify-center gap-1 rounded-2xl bg-surface-more p-2 sm:flex">
    <strong>{Intl.DateTimeFormat(LOCALE, {month: "short"}).format(startDate)}</strong>
    <span class="text-4xl">{Intl.DateTimeFormat(LOCALE, {day: "numeric"}).format(startDate)}</span>
    <span class="text-xs opacity-75"
      >{Intl.DateTimeFormat(LOCALE, {weekday: "long"}).format(startDate)}</span>
  </div>
{/if}
