<script lang="ts">
  import StatusIndicator from "@lib/components/StatusIndicator.svelte"
  import {RelayConnection, deriveSocketStatus} from "@app/relays"

  type Props = {
    url: string
  }

  const {url}: Props = $props()
  const status = deriveSocketStatus(url)
</script>

{#if $status === RelayConnection.Connecting}
  <StatusIndicator class="bg-warning">Connecting</StatusIndicator>
{:else if $status === RelayConnection.Disconnected}
  <StatusIndicator class="bg-gray-500">Not Connected</StatusIndicator>
{:else if $status === RelayConnection.ConnectFailed}
  <StatusIndicator class="bg-error">Failed to Connect</StatusIndicator>
{:else if $status === RelayConnection.Authenticating}
  <StatusIndicator class="bg-warning">Authenticating</StatusIndicator>
{:else if $status === RelayConnection.AuthFailed}
  <StatusIndicator class="bg-error">Failed to Authenticate</StatusIndicator>
{:else if $status === RelayConnection.AccessDenied}
  <StatusIndicator class="bg-error">Access Denied</StatusIndicator>
{:else}
  <StatusIndicator class="bg-success">Connected</StatusIndicator>
{/if}
