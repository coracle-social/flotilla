<script lang="ts">
  import StatusIndicator from "@lib/components/StatusIndicator.svelte"
  import {RelayAccessStatus, deriveRelayAccess} from "@app/core/relays"

  type Props = {
    url: string
  }

  const {url}: Props = $props()
  const access = deriveRelayAccess(url)
</script>

{#if $access.status === RelayAccessStatus.Connecting}
  <StatusIndicator class="bg-warning">Connecting</StatusIndicator>
{:else if $access.status === RelayAccessStatus.Disconnected}
  <StatusIndicator class="bg-gray-500">Not Connected</StatusIndicator>
{:else if $access.status === RelayAccessStatus.Unreachable}
  <StatusIndicator class="bg-error">Failed to Connect</StatusIndicator>
{:else if $access.status === RelayAccessStatus.Authenticating}
  <StatusIndicator class="bg-warning">Authenticating</StatusIndicator>
{:else if $access.status === RelayAccessStatus.AwaitingSignature}
  <StatusIndicator class="bg-warning">Waiting for Signer</StatusIndicator>
{:else if $access.status === RelayAccessStatus.SignerFailed}
  <StatusIndicator class="bg-error">Signer Failed</StatusIndicator>
{:else if $access.status === RelayAccessStatus.Denied}
  <StatusIndicator class="bg-error">Access Denied</StatusIndicator>
{:else if $access.status === RelayAccessStatus.Untrusted}
  <StatusIndicator class="bg-warning">Untrusted</StatusIndicator>
{:else}
  <StatusIndicator class="bg-success">Connected</StatusIndicator>
{/if}
