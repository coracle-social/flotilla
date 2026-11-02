<script lang="ts">
  import Link from "@lib/components/Link.svelte"
  import RelayIcon from "@app/components/RelayIcon.svelte"
  import RelayName from "@app/components/RelayName.svelte"
  import {relays} from "@app/core/plugins"
  import {makeSpaceEntryPath} from "@app/navigation/history"

  type Props = {
    url: string
  }

  const {url}: Props = $props()

  const relay = $relays.one(url)
</script>

<Link
  href={makeSpaceEntryPath(url)}
  class="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-less">
  <RelayIcon {url} size={8} class="shrink-0" />
  <div class="min-w-0">
    <RelayName {url} class="block truncate text-sm font-medium" />
    {#if $relay?.description}
      <p class="truncate text-xs opacity-75">{$relay.description}</p>
    {/if}
  </div>
</Link>
