<script lang="ts">
  import {formatTimestamp} from "@welshman/lib"
  import Feed from "@assets/icons/feed.svg?dataurl"
  import Link from "@lib/components/Link.svelte"
  import HomeSection from "@app/components/HomeSection.svelte"
  import RelayIcon from "@app/components/RelayIcon.svelte"
  import RelayName from "@app/components/RelayName.svelte"
  import {displayContentCount} from "@app/content"
  import {inboxSpaceContent} from "@app/inbox"
  import {makeSpacePath} from "@app/routes"
</script>

{#if $inboxSpaceContent.length > 0}
  <HomeSection title="Activity" icon={Feed}>
    <div
      class="scroll-container flex items-stretch gap-3 overflow-x-auto border-t border-line bg-surface-less p-4">
      {#each $inboxSpaceContent as { url, timestamp, countsByKind } (url)}
        <Link
          href={makeSpacePath(url)}
          class="card card-sm card-interactive flex w-56 shrink-0 flex-col gap-2">
          <div class="flex min-w-0 items-center gap-2">
            <RelayIcon {url} size={8} class="shrink-0" />
            <strong class="min-w-0 flex-1 truncate"><RelayName {url} /></strong>
          </div>
          <div class="flex flex-col text-sm opacity-75">
            {#each [...countsByKind] as [kind, count] (kind)}
              <span>{displayContentCount(kind, count)}</span>
            {/each}
          </div>
          <span class="mt-auto text-xs opacity-50">{formatTimestamp(timestamp)}</span>
        </Link>
      {/each}
    </div>
  </HomeSection>
{/if}
