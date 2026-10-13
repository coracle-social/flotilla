<script lang="ts">
  import {CLASSIFIED, EVENT_TIME, LONG_FORM, PINBOARD, POLL, THREAD, ZAP_GOAL} from "@welshman/util"
  import Link from "@lib/components/Link.svelte"
  import RelayIcon from "@app/components/RelayIcon.svelte"
  import RelayName from "@app/components/RelayName.svelte"
  import {displayInboxTimestamp} from "@app/ui/notifications"
  import type {SpaceContent} from "@app/ui/notifications"
  import {makeSpacePath} from "@app/ui/routes"

  const {spaces}: {spaces: SpaceContent[]} = $props()

  const displayCount = ([kind, count]: [number, number]) => {
    switch (kind) {
      case ZAP_GOAL:
        return `${count} ${count === 1 ? "goal" : "goals"}`
      case EVENT_TIME:
        return `${count} ${count === 1 ? "event" : "events"}`
      case THREAD:
        return `${count} ${count === 1 ? "thread" : "threads"}`
      case CLASSIFIED:
        return `${count} ${count === 1 ? "classified" : "classifieds"}`
      case POLL:
        return `${count} ${count === 1 ? "poll" : "polls"}`
      case PINBOARD:
        return `${count} ${count === 1 ? "pinboard" : "pinboards"}`
      case LONG_FORM:
        return `${count} ${count === 1 ? "article" : "articles"}`
      default:
        return `${count} ${count === 1 ? "item" : "items"}`
    }
  }
</script>

<div class="flex flex-col divide-y divide-line border-t border-line bg-surface-less">
  {#each spaces as { url, timestamp, countsByKind } (url)}
    <Link
      href={makeSpacePath(url)}
      class="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface">
      <RelayIcon {url} size={9} class="shrink-0" />
      <div class="flex min-w-0 flex-1 flex-col gap-0.5">
        <div class="flex min-w-0 items-center gap-2 text-sm">
          <strong class="min-w-0 flex-1 truncate"><RelayName {url} /></strong>
          <span class="shrink-0 text-xs opacity-50">{displayInboxTimestamp(timestamp)}</span>
        </div>
        <div class="truncate text-sm opacity-75">
          {[...countsByKind].map(displayCount).join(", ")}
        </div>
      </div>
    </Link>
  {/each}
</div>
