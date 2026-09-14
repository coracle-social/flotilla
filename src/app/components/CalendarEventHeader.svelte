<script lang="ts">
  import {formatTimestamp, formatTimestampAsDate, formatTimestampAsTime} from "@welshman/lib"
  import type {TrustedEvent} from "@welshman/util"
  import {TimeEvent} from "@welshman/domain"
  import ClockCircle from "@assets/icons/clock-circle.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import {reader} from "@app/core"
  import {getEventTitle} from "@app/calendar"

  type Props = {
    event: TrustedEvent
  }

  const {event}: Props = $props()

  const timeEvent = $derived(reader(TimeEvent)(event))

  const title = $derived(getEventTitle(event))
  const start = $derived(timeEvent.start())
  const end = $derived(timeEvent.end())
</script>

<div class="flex flex-col justify-between gap-1">
  <p class="text-lg">{title}</p>
  {#if start && end}
    {@const isSingleDay = formatTimestampAsDate(start) === formatTimestampAsDate(end)}
    <div class="flex flex-wrap gap-2 text-xs">
      <div class="flex items-center gap-2">
        <Icon icon={ClockCircle} size={4} />
        {formatTimestampAsDate(start)}
      </div>
      {formatTimestampAsTime(start)} — {isSingleDay
        ? formatTimestampAsTime(end)
        : formatTimestamp(end)}
    </div>
  {/if}
</div>
