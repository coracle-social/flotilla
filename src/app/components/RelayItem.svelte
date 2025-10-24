<script lang="ts">
  import Server from "@assets/icons/server.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Link from "@lib/components/Link.svelte"
  import {displayUrl} from "@welshman/lib"
  import {displayRelayUrl} from "@welshman/util"
  import {deriveRelay, deriveRelayStats} from "@welshman/app"

  const {url, children} = $props()

  const relay = deriveRelay(url)
  const relayStats = deriveRelayStats(url)
  const connections = $derived($relayStats?.open_count || 0)
</script>

<div class="card2 card2-sm bg-alt column gap-2">
  <div class="flex items-center justify-between gap-4">
    <div class="ellipsize flex items-center gap-2">
      <Icon icon={Server} />
      <p class="ellipsize">{displayRelayUrl(url)}</p>
    </div>
    {@render children?.()}
  </div>
  {#if $relay?.description}
    <p class="ellipsize">{$relay.description}</p>
  {/if}
  <span class="flex items-center gap-1 whitespace-nowrap text-sm">
    {#if $relay?.contact}
      <Link external class="ellipsize underline" href={$relay.contact}
        >{displayUrl($relay.contact)}</Link>
      &bull;
    {/if}
    {#if Array.isArray($relay?.supported_nips)}
      <span
        class="tooltip cursor-pointer underline"
        data-tip="NIPs supported: {$relay.supported_nips.join(', ')}">
        {$relay.supported_nips.length} NIPs
      </span>
      &bull;
    {/if}
    Connected {connections}
    {connections === 1 ? "time" : "times"}
  </span>
</div>
