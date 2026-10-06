<script lang="ts">
  import Link from "@lib/components/Link.svelte"
  import RelayIcon from "@app/components/RelayIcon.svelte"
  import RelayName from "@app/components/RelayName.svelte"
  import {displayContentCount} from "@app/content"
  import {displayInboxTimestamp} from "@app/notifications"
  import type {SpaceContent} from "@app/notifications"
  import {makeSpacePath} from "@app/routes"

  const {spaces}: {spaces: SpaceContent[]} = $props()
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
          {[...countsByKind].map(([kind, count]) => displayContentCount(kind, count)).join(", ")}
        </div>
      </div>
    </Link>
  {/each}
</div>
