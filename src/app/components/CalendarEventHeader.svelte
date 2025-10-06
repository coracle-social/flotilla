<script lang="ts">
  import {
    fromPairs,
    formatTimestamp,
    formatTimestampAsDate,
    formatTimestampAsTime,
  } from "@welshman/lib"
  import type {TrustedEvent} from "@welshman/util"
  import ClockCircle from "@assets/icons/clock-circle.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"

  type Props = {
    event: TrustedEvent
  }

  const {event}: Props = $props()
  const meta = $derived(fromPairs(event.tags) as Record<string, string>)
  const start = $derived(parseInt(meta.start))
  const end = $derived(parseInt(meta.end))
</script>

<div class="flex flex-grow flex-wrap justify-between gap-2">
  <p class="text-xl">{meta.title || meta.name}</p>
  {#if !isNaN(start) && !isNaN(end)}
    {@const startDateDisplay = formatTimestampAsDate(start)}
    {@const endDateDisplay = formatTimestampAsDate(end)}
    {@const isSingleDay = startDateDisplay === endDateDisplay}
    <div class="flex items-center gap-2 text-sm">
      <Icon icon={ClockCircle} size={4} />
      <span class="hidden sm:block">{formatTimestampAsDate(start)}</span>
      {formatTimestampAsTime(start)} — {isSingleDay
        ? formatTimestampAsTime(end)
        : formatTimestamp(end)}
    </div>
  {/if}
</div>
