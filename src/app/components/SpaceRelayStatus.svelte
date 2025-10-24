<script lang="ts">
  import {deriveRelay} from "@welshman/app"
  import Server from "@assets/icons/server.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import ProfileLink from "@app/components/ProfileLink.svelte"
  import SocketStatusIndicator from "@app/components/SocketStatusIndicator.svelte"

  interface Props {
    url: string
  }

  const {url}: Props = $props()

  const relay = deriveRelay(url)
</script>

<div class="card2 bg-alt flex flex-col gap-4">
  <div class="flex items-center justify-between">
    <h3 class="flex items-center gap-2 text-lg font-semibold">
      <Icon icon={Server} />
      Relay Details
    </h3>
    <SocketStatusIndicator {url} />
  </div>
  {#if $relay}
    {@const {pubkey, software, version, supported_nips, limitation} = $relay}
    <div class="flex flex-wrap gap-1">
      {#if pubkey}
        <div class="badge badge-neutral">
          <span class="ellipsize">Administrator: <ProfileLink unstyled {pubkey} /></span>
        </div>
      {/if}
      {#if $relay?.contact}
        <div class="badge badge-neutral">
          <span class="ellipsize">Contact: {$relay.contact}</span>
        </div>
      {/if}
      {#if software}
        <div class="badge badge-neutral">
          <span class="ellipsize">Software: {software}</span>
        </div>
      {/if}
      {#if version}
        <div class="badge badge-neutral">
          <span class="ellipsize">Version: {version}</span>
        </div>
      {/if}
      {#if Array.isArray(supported_nips)}
        <p class="badge badge-neutral">
          <span class="ellipsize">Supported NIPs: {supported_nips.join(", ")}</span>
        </p>
      {/if}
      {#if limitation?.auth_required}
        <p class="badge badge-warning">
          <span class="ellipsize">Auth Required</span>
        </p>
      {/if}
      {#if limitation?.payment_required}
        <p class="badge badge-warning">
          <span class="ellipsize">Payment Required</span>
        </p>
      {/if}
      {#if limitation?.min_pow_difficulty}
        <p class="badge badge-warning">
          <span class="ellipsize">Min PoW: {limitation?.min_pow_difficulty}</span>
        </p>
      {/if}
    </div>
  {/if}
</div>
