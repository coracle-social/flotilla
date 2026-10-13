<script lang="ts">
  import {getWalletAddress} from "@welshman/util"
  import {errorMessage} from "@lib/util"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import ModalTitle from "@lib/components/ModalTitle.svelte"
  import ModalSubtitle from "@lib/components/ModalSubtitle.svelte"
  import ModalFooter from "@lib/components/ModalFooter.svelte"
  import Modal from "@lib/components/Modal.svelte"
  import ModalBody from "@lib/components/ModalBody.svelte"
  import Wallet from "@assets/icons/wallet.svg?dataurl"
  import CheckCircle from "@assets/icons/check-circle.svg?dataurl"
  import {pushToast} from "@app/ui/toast"
  import {user} from "@app/core/app"
  import {profiles} from "@app/core/plugins"
  import {wallet} from "@app/features/lightning"

  const back = () => history.back()

  const walletLud16 = $derived($wallet ? getWalletAddress($wallet) : undefined)

  let address = $state($profiles.get($user.pubkey)?.lnurl() || "")
  let loading = $state(false)

  const useWalletAddress = () => {
    if (walletLud16) {
      address = walletLud16
    }
  }

  const save = async () => {
    loading = true

    try {
      const command = await $profiles.update(writer =>
        writer.update({lud06: undefined, lud16: address.trim() || undefined}),
      )

      const error = await command.publish().getError()

      if (error) {
        pushToast({theme: "error", message: `Failed to update profile: ${errorMessage(error)}`})
      } else {
        back()
      }
    } catch (error) {
      console.error(error)
      pushToast({theme: "error", message: "Failed to update profile"})
    } finally {
      loading = false
    }
  }
</script>

<Modal>
  <ModalBody>
    <ModalHeader>
      <ModalTitle>Update Lightning Address</ModalTitle>
      <ModalSubtitle>Update your lightning address for receiving payments.</ModalSubtitle>
    </ModalHeader>

    <div class="flex flex-col gap-4">
      <div class="flex flex-col gap-2">
        <span> Lightning Address </span>
        <input
          type="text"
          placeholder="user@domain.com"
          bind:value={address}
          class="input flex w-full"
          disabled={loading} />
        <p class="text-xs opacity-75">
          You can enter one manually or use your connected wallet's address (if available). Leave
          empty to remove your lightning address
        </p>
      </div>

      {#if walletLud16 && walletLud16 !== address}
        <div class="card card-sm bg-surface p-4">
          <div class="flex items-center justify-between gap-3">
            <div class="flex flex-col gap-1">
              <div class="flex items-center gap-2">
                <Icon icon={Wallet} size={4} />
                <span class="text-sm font-medium">Wallet Address</span>
              </div>
              <p class="text-xs opacity-75">{walletLud16}</p>
            </div>
            <Button
              class="button button-outline button-sm"
              onclick={useWalletAddress}
              disabled={loading}>
              Use This
            </Button>
          </div>
        </div>
      {/if}
    </div>
  </ModalBody>
  <ModalFooter>
    <Button class="button button-neutral" onclick={back} disabled={loading}>Cancel</Button>
    <Button class="button button-primary" onclick={save} disabled={loading}>
      {#if loading}
        <Spinner size="sm" />
      {:else}
        <Icon icon={CheckCircle} />
      {/if}
      Save Changes
    </Button>
  </ModalFooter>
</Modal>
