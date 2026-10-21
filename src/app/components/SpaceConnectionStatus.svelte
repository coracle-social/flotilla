<script lang="ts">
  import {
    formatTimestamp,
    formatTimestampAsDate,
    formatTimestampRelative,
    sortBy,
  } from "@welshman/lib"
  import {displayRelayUrl} from "@welshman/util"
  import {AuthStatus, SocketStatus} from "@welshman/net"
  import Button from "@lib/components/Button.svelte"
  import Link from "@lib/components/Link.svelte"
  import Modal from "@lib/components/Modal.svelte"
  import ModalBody from "@lib/components/ModalBody.svelte"
  import ModalFooter from "@lib/components/ModalFooter.svelte"
  import StatusIndicator from "@lib/components/StatusIndicator.svelte"
  import ProfileLink from "@app/components/ProfileLink.svelte"
  import RelayIcon from "@app/components/RelayIcon.svelte"
  import SocketStatusIndicator from "@app/components/SocketStatusIndicator.svelte"
  import {relays, relayStats} from "@app/core/plugins"
  import {RelayAccessStatus, deriveRelayAccess, deriveSocket} from "@app/core/relays"
  import {relaysPendingTrust} from "@app/core/ingest"
  import {userSettingsValues} from "@app/core/settings"
  import {signerHealth} from "@app/core/signer"
  import * as pages from "@app/navigation/pages"

  type Props = {
    url: string
  }

  const {url}: Props = $props()

  const relay = $relays.one(url)
  const access = deriveRelayAccess(url)
  const socket = deriveSocket(url)
  const stats = $relayStats.one(url)
  const recentErrors = $derived(sortBy(t => -t, $stats?.recent_errors ?? []))

  const back = () => history.back()
</script>

{#snippet stat(value: number, label: string)}
  <div class="flex flex-col rounded-xl bg-surface-more p-3">
    <span class="text-lg font-bold">{value.toLocaleString()}</span>
    <span class="text-xs text-content-muted">{label}</span>
  </div>
{/snippet}

<Modal label="Connection status">
  <ModalBody>
    <div class="flex min-w-0 items-center gap-3">
      <RelayIcon {url} size={10} class="shrink-0" />
      <div class="flex min-w-0 flex-col">
        <strong class="text-2xl">Connection Status</strong>
        <span class="truncate text-primary">{displayRelayUrl(url)}</span>
      </div>
    </div>
    <div class="card card-sm flex flex-col gap-2">
      <SocketStatusIndicator {url} />
      <p class="text-sm text-content-muted">
        {#if $access.status === RelayAccessStatus.Connecting}
          Opening a connection to this space.
        {:else if $access.status === RelayAccessStatus.Disconnected}
          Not connected right now. The app reconnects when it needs this space.
        {:else if $access.status === RelayAccessStatus.Unreachable}
          This space couldn't be reached. It may be down, or your network may be blocking it.
        {:else if $access.status === RelayAccessStatus.Authenticating}
          Signing in to this space.
        {:else if $access.status === RelayAccessStatus.AwaitingSignature}
          Waiting for your signer to approve signing in.
        {:else if $access.status === RelayAccessStatus.SignerFailed}
          Your signer couldn't sign you in.
          <Link class="link" href={pages.settingsProfile.path()}>Check your signer</Link>
        {:else if $access.status === RelayAccessStatus.Denied}
          This space is refusing your requests. It said: {$access.reason}
        {:else if $access.status === RelayAccessStatus.Untrusted}
          This space sends events without signatures, which are held until you choose to trust it.
        {:else}
          Connected and working normally.
        {/if}
      </p>
    </div>
    <div class="card card-sm flex flex-col gap-3">
      <strong class="text-lg">Connection</strong>
      <dl class="detail-list">
        <dt>Socket</dt>
        <dd>
          {#if $socket.status === SocketStatus.Open}
            <StatusIndicator class="bg-success">Open</StatusIndicator>
          {:else if $socket.status === SocketStatus.Opening}
            <StatusIndicator class="bg-warning">Opening</StatusIndicator>
          {:else if $socket.status === SocketStatus.Closing}
            <StatusIndicator class="bg-warning">Closing</StatusIndicator>
          {:else if $socket.status === SocketStatus.Closed}
            <StatusIndicator class="bg-gray-500">Closed</StatusIndicator>
          {:else}
            <StatusIndicator class="bg-error">Error</StatusIndicator>
          {/if}
        </dd>
        <dt>Authentication</dt>
        <dd>
          {#if $socket.auth.status === AuthStatus.Ok}
            <StatusIndicator class="bg-success">Authenticated</StatusIndicator>
          {:else if $socket.auth.status === AuthStatus.Requested}
            <StatusIndicator class="bg-warning">Requested</StatusIndicator>
          {:else if $socket.auth.status === AuthStatus.PendingSignature}
            <StatusIndicator class="bg-warning">Waiting for your signer</StatusIndicator>
          {:else if $socket.auth.status === AuthStatus.DeniedSignature}
            <StatusIndicator class="bg-error">Signer declined</StatusIndicator>
          {:else if $socket.auth.status === AuthStatus.PendingResponse}
            <StatusIndicator class="bg-warning">Waiting for the space</StatusIndicator>
          {:else if $socket.auth.status === AuthStatus.Forbidden}
            <StatusIndicator class="bg-error">Refused</StatusIndicator>
          {:else}
            <StatusIndicator class="bg-gray-500">Not requested</StatusIndicator>
          {/if}
        </dd>
        <dt>Signatures</dt>
        <dd>
          {#if $relaysPendingTrust.includes(url)}
            <StatusIndicator class="bg-warning">Unsigned events held</StatusIndicator>
          {:else if $userSettingsValues.trusted_relays.includes(url)}
            <StatusIndicator class="bg-gray-500">Trusted without checking</StatusIndicator>
          {:else}
            <StatusIndicator class="bg-success">Checked</StatusIndicator>
          {/if}
        </dd>
        <dt>Signer</dt>
        <dd>
          {#if $signerHealth.disconnected}
            <Link class="link" href={pages.settingsProfile.path()}>
              <StatusIndicator class="bg-error">Not responding</StatusIndicator>
            </Link>
          {:else if $signerHealth.failing}
            <Link class="link" href={pages.settingsProfile.path()}>
              <StatusIndicator class="bg-warning">Failing</StatusIndicator>
            </Link>
          {:else if $signerHealth.slow}
            <StatusIndicator class="bg-warning">Slow</StatusIndicator>
          {:else}
            <StatusIndicator class="bg-success">OK</StatusIndicator>
          {/if}
        </dd>
      </dl>
    </div>
    {#if $relay}
      {@const {pubkey, contact, software, version, limitation} = $relay}
      <div class="card card-sm flex flex-col gap-3">
        <strong class="text-lg">Space</strong>
        <dl class="detail-list">
          {#if pubkey}
            <dt>Administrator</dt>
            <dd><ProfileLink {pubkey} {url} /></dd>
          {/if}
          {#if contact}
            <dt>Contact</dt>
            <dd><span class="truncate">{contact}</span></dd>
          {/if}
          {#if software}
            <dt>Software</dt>
            <dd><span class="truncate">{software}</span></dd>
          {/if}
          {#if version}
            <dt>Version</dt>
            <dd>{version}</dd>
          {/if}
        </dl>
        {#if limitation?.auth_required || limitation?.payment_required || limitation?.min_pow_difficulty}
          <div class="flex flex-wrap gap-1">
            {#if limitation.auth_required}
              <span class="badge badge-warning">Auth Required</span>
            {/if}
            {#if limitation.payment_required}
              <span class="badge badge-warning">Payment Required</span>
            {/if}
            {#if limitation.min_pow_difficulty}
              <span class="badge badge-warning">Min PoW: {limitation.min_pow_difficulty}</span>
            {/if}
          </div>
        {/if}
      </div>
    {/if}
    {#if $stats}
      <div class="card card-sm flex flex-col gap-3">
        <strong class="text-lg">Activity</strong>
        <div class="grid grid-cols-3 gap-2">
          {@render stat($stats.open_count, "Connections")}
          {@render stat($stats.request_count, "Requests")}
          {@render stat($stats.event_count, "Events received")}
          {@render stat($stats.publish_success_count, "Published")}
          {@render stat($stats.publish_failure_count, "Rejected")}
          {@render stat($stats.notice_count, "Notices")}
        </div>
        <dl class="detail-list">
          <dt>First seen</dt>
          <dd>{formatTimestampAsDate($stats.first_seen)}</dd>
          <dt>Last connected</dt>
          <dd>{$stats.last_open ? formatTimestampRelative($stats.last_open) : "Never"}</dd>
          <dt>Last disconnected</dt>
          <dd>{$stats.last_close ? formatTimestampRelative($stats.last_close) : "Never"}</dd>
          <dt>Recent errors</dt>
          <dd>
            {#if recentErrors.length > 0}
              <StatusIndicator class="bg-error">{recentErrors.length}</StatusIndicator>
            {:else}
              <StatusIndicator class="bg-success">None</StatusIndicator>
            {/if}
          </dd>
        </dl>
        {#if recentErrors.length > 0}
          <ul class="flex flex-col gap-1 text-sm">
            {#each recentErrors as timestamp (timestamp)}
              <li class="flex justify-between gap-2">
                <span>{formatTimestamp(timestamp)}</span>
                <span class="text-content-muted">{formatTimestampRelative(timestamp)}</span>
              </li>
            {/each}
          </ul>
        {/if}
      </div>
    {/if}
  </ModalBody>
  <ModalFooter>
    <Button class="button button-primary grow" onclick={back}>Done</Button>
  </ModalFooter>
</Modal>
