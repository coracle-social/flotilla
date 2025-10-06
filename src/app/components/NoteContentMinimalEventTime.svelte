<script lang="ts">
  import type {ComponentProps} from "svelte"
  import {
    fromPairs,
    formatTimestamp,
    formatTimestampAsDate,
    formatTimestampAsTime,
  } from "@welshman/lib"
  import ClockCircle from "@assets/icons/clock-circle.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import ContentMinimal from "@app/components/ContentMinimal.svelte"

  const props: ComponentProps<typeof ContentMinimal> = $props()
  const meta = $derived(fromPairs(props.event.tags) as Record<string, string>)
  const start = $derived(parseInt(meta.start))
  const end = $derived(parseInt(meta.end))
</script>

<div class="flex flex-col">
  <div class="flex flex-grow flex-wrap justify-between gap-2">
    <p class="text-sm">{meta.title || meta.name}</p>
    {#if !isNaN(start) && !isNaN(end)}
      {@const startDateDisplay = formatTimestampAsDate(start)}
      {@const endDateDisplay = formatTimestampAsDate(end)}
      {@const isSingleDay = startDateDisplay === endDateDisplay}
      <div class="flex items-center gap-2">
        <Icon icon={ClockCircle} size={4} />
        <span class="hidden sm:block">{formatTimestampAsDate(start)}</span>
        {formatTimestampAsTime(start)} — {isSingleDay
          ? formatTimestampAsTime(end)
          : formatTimestamp(end)}
      </div>
    {/if}
  </div>
  <ContentMinimal {...props} />
</div>
