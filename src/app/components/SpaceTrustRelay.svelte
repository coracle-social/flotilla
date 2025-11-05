<script lang="ts">
  import {goto} from "$app/navigation"
  import {remove} from "@welshman/lib"
  import {displayRelayUrl} from "@welshman/util"
  import {preventDefault} from "@lib/html"
  import CloseCircle from "@assets/icons/close-circle.svg?dataurl"
  import CheckCircle from "@assets/icons/check-circle.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import Button from "@lib/components/Button.svelte"
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import InfoSignatures from "@app/components/InfoSignatures.svelte"
  import {relaysPendingTrust} from "@app/core/state"
  import {removeSpaceMembership, addTrustedRelay, removeTrustedRelay} from "@app/core/commands"
  import {pushModal} from "@app/util/modal"

  type Props = {
    url: string
  }

  const {url}: Props = $props()

  const showInfoSignatures = () => pushModal(InfoSignatures)

  const untrustSpace = async () => {
    loading = true

    try {
      await removeSpaceMembership(url)
      await removeTrustedRelay(url)
      goto("/home")
    } finally {
      loading = false
    }
  }

  const trustSpace = async () => {
    loading = true

    try {
      await addTrustedRelay(url)

      relaysPendingTrust.update($r => remove(url, $r))
    } finally {
      loading = false
    }
  }

  let loading = $state(false)
</script>

<form class="column gap-4" onsubmit={preventDefault(trustSpace)}>
  <ModalHeader>
    {#snippet title()}
      Do you trust this space?
    {/snippet}
    {#snippet info()}
      <div>
        Only join <span class="text-primary">{displayRelayUrl(url)}</span> if you trust the adminstrator
      </div>
    {/snippet}
  </ModalHeader>
  <div class="m-auto flex flex-col gap-4">
    <p>
      This space has opted not to publish <Button class="link" onclick={showInfoSignatures}
        >digital signatures</Button
      >, which means that they have the ability to forge messages from other users.
    </p>
    <p>
      If you trust this space's admin, you can continue. Otherwise, it may be safer not to join this
      space.
    </p>
  </div>
  <div class="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-between">
    <Button class="btn btn-neutral" onclick={untrustSpace} disabled={loading}>
      {#if !loading}
        <Icon icon={CloseCircle} />
      {/if}
      <Spinner {loading}>I don't trust this space</Spinner>
    </Button>
    <Button type="submit" class="btn btn-primary" disabled={loading}>
      {#if !loading}
        <Icon icon={CheckCircle} />
      {/if}
      <Spinner {loading}>I trust this space, continue</Spinner>
    </Button>
  </div>
</form>
