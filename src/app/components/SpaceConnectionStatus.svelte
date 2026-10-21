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
  import FieldInline from "@lib/components/FieldInline.svelte"
  import Link from "@lib/components/Link.svelte"
  import Modal from "@lib/components/Modal.svelte"
  import ModalBody from "@lib/components/ModalBody.svelte"
  import ModalFooter from "@lib/components/ModalFooter.svelte"
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import ModalSubtitle from "@lib/components/ModalSubtitle.svelte"
  import ModalTitle from "@lib/components/ModalTitle.svelte"
  import StatusIndicator from "@lib/components/StatusIndicator.svelte"
  import SocketStatusIndicator from "@app/components/SocketStatusIndicator.svelte"
  import {relayStats} from "@app/core/plugins"
  import {RelayAccessStatus, deriveRelayAccess, deriveSocket} from "@app/core/relays"
  import {relaysPendingTrust} from "@app/core/ingest"
  import {userSettingsValues} from "@app/core/settings"
  import {signerHealth} from "@app/core/signer"
  import * as pages from "@app/navigation/pages"

  type Props = {
    url: string
  }

  const {url}: Props = $props()

  const access = deriveRelayAccess(url)
  const socket = deriveSocket(url)
  const stats = $relayStats.one(url)
  const recentErrors = $derived(sortBy(t => -t, $stats?.recent_errors ?? []))

  const back = () => history.back()
</script>

<Modal>
  <ModalBody>
    <ModalHeader>
      <ModalTitle>Connection Status</ModalTitle>
      <ModalSubtitle>
        To <span class="text-primary">{displayRelayUrl(url)}</span>
      </ModalSubtitle>
    </ModalHeader>
    <div class="card card-sm flex flex-col gap-3">
      <FieldInline>
        {#snippet label()}Status{/snippet}
        {#snippet input()}<SocketStatusIndicator {url} />{/snippet}
      </FieldInline>
      {#if $access.status === RelayAccessStatus.Denied}
        <p class="text-sm text-content-muted">The space said: {$access.reason}</p>
      {/if}
      <FieldInline>
        {#snippet label()}Connection{/snippet}
        {#snippet input()}
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
        {/snippet}
      </FieldInline>
      <FieldInline>
        {#snippet label()}Authentication{/snippet}
        {#snippet input()}
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
        {/snippet}
      </FieldInline>
      <FieldInline>
        {#snippet label()}Signatures{/snippet}
        {#snippet input()}
          {#if $relaysPendingTrust.includes(url)}
            <StatusIndicator class="bg-warning">Unsigned events held</StatusIndicator>
          {:else if $userSettingsValues.trusted_relays.includes(url)}
            <StatusIndicator class="bg-gray-500">Trusted without checking</StatusIndicator>
          {:else}
            <StatusIndicator class="bg-success">Checked</StatusIndicator>
          {/if}
        {/snippet}
      </FieldInline>
      <FieldInline>
        {#snippet label()}Signer{/snippet}
        {#snippet input()}
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
        {/snippet}
      </FieldInline>
    </div>
    {#if $stats}
      <div class="card card-sm flex flex-col gap-3">
        <FieldInline>
          {#snippet label()}Connected{/snippet}
          {#snippet input()}
            <span class="text-sm">
              {$stats.open_count}
              {$stats.open_count === 1 ? "time" : "times"} since {formatTimestampAsDate(
                $stats.first_seen,
              )}
            </span>
          {/snippet}
        </FieldInline>
        <FieldInline>
          {#snippet label()}Last connected{/snippet}
          {#snippet input()}
            <span class="text-sm">
              {$stats.last_open ? formatTimestampRelative($stats.last_open) : "Never"}
            </span>
          {/snippet}
        </FieldInline>
        <FieldInline>
          {#snippet label()}Last disconnected{/snippet}
          {#snippet input()}
            <span class="text-sm">
              {$stats.last_close ? formatTimestampRelative($stats.last_close) : "Never"}
            </span>
          {/snippet}
        </FieldInline>
        <FieldInline>
          {#snippet label()}Requests{/snippet}
          {#snippet input()}<span class="text-sm">{$stats.request_count}</span>{/snippet}
        </FieldInline>
        <FieldInline>
          {#snippet label()}Events received{/snippet}
          {#snippet input()}<span class="text-sm">{$stats.event_count}</span>{/snippet}
        </FieldInline>
        <FieldInline>
          {#snippet label()}Publishes{/snippet}
          {#snippet input()}
            <span class="text-sm">
              {$stats.publish_success_count} accepted, {$stats.publish_failure_count} rejected
            </span>
          {/snippet}
        </FieldInline>
        <FieldInline>
          {#snippet label()}Notices{/snippet}
          {#snippet input()}<span class="text-sm">{$stats.notice_count}</span>{/snippet}
        </FieldInline>
      </div>
      <div class="card card-sm flex flex-col gap-2">
        <strong>Recent connection errors</strong>
        {#each recentErrors as timestamp (timestamp)}
          <div class="flex justify-between gap-2 text-sm">
            <span>{formatTimestamp(timestamp)}</span>
            <span class="text-content-muted">{formatTimestampRelative(timestamp)}</span>
          </div>
        {:else}
          <p class="text-sm text-content-muted">None recorded.</p>
        {/each}
      </div>
    {/if}
  </ModalBody>
  <ModalFooter>
    <Button class="button button-primary grow" onclick={back}>Done</Button>
  </ModalFooter>
</Modal>
