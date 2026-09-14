<script lang="ts">
  import cx from "classnames"
  import {formatTimestampAsTime} from "@welshman/lib"
  import type {TrustedEvent} from "@welshman/util"
  import {getAddress} from "@welshman/util"
  import Link from "@lib/components/Link.svelte"
  import {getEventStart, getEventTitle, startsOnDay} from "@app/calendar"
  import {makeCalendarPath} from "@app/routes"

  type Props = {
    url: string
    event: TrustedEvent
    day?: Date
    continuesAfter?: boolean
    class?: string
  }

  const {url, event, day, continuesAfter = false, class: className}: Props = $props()

  const start = getEventStart(event)

  // Showing the start time on a day the event merely runs through would misdate it
  const continuesBefore = day ? !startsOnDay(event, day) : false
</script>

<Link
  href={makeCalendarPath(url, getAddress(event))}
  class={cx(
    "flex h-6 min-w-0 items-center gap-x-1 bg-primary/10 px-1.5 text-xs text-primary transition-colors hover:bg-primary hover:text-primary-content",
    // Only round the corners that are the event's real start/end, not a clipped row edge
    continuesBefore ? "rounded-l-none" : "rounded-l-lg",
    continuesAfter ? "rounded-r-none" : "rounded-r-lg",
    className,
  )}>
  {#if continuesBefore}
    <span class="shrink-0 opacity-75" title="Continues from an earlier day">→</span>
  {:else if start}
    <span class="shrink-0 opacity-75">{formatTimestampAsTime(start)}</span>
  {/if}
  <span class="min-w-0 truncate">{getEventTitle(event)}</span>
  {#if continuesAfter}
    <span class="ml-auto shrink-0 opacity-75" title="Continues to a later day">→</span>
  {/if}
</Link>
