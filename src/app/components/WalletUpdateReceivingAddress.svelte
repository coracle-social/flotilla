<script lang="ts">
  import {getWalletAddress} from "@welshman/util"
  import {session, waitForThunkError, userProfile} from "@welshman/app"
  import {errorMessage} from "@lib/util"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import ModalTitle from "@lib/components/ModalTitle.svelte"
  import ModalSubtitle from "@lib/components/ModalSubtitle.svelte"
  import ModalFooter from "@lib/components/ModalFooter.svelte"
  import Modal from "@lib/components/Modal.svelte"
  import ModalBody from "@lib/components/ModalBody.svelte"
  import Wallet from "@assets/icons/wallet.svg?dataurl"
  import CheckCircle from "@assets/icons/check-circle.svg?dataurl"
  import {updateProfile} from "@app/core/commands"
  import {pushToast} from "@app/util/toast"

  const back = () => history.back()

  let address = $state($userProfile?.lud16 || "")
  let loading = $state(false)

  const walletLud16 = $derived($session?.wallet ? getWalletAddress($session.wallet) : undefined)

  const useWalletAddress = () => {
    if (walletLud16) {
      address = walletLud16
    }
  }

  const save = async () => {
    loading = true

    try {
      const error = await waitForThunkError(
        updateProfile({
          profile: {
            ...$userProfile,
            lud06: undefined,
            lud16: address.trim() || undefined,
          },
        }),
      )

      if (error) {
        pushToast({theme: "error", message: `Failed to update profile: ${errorMessage(error)}`})
      } else {
        back()
      }
    } catch (error) {
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

    <div class="column gap-4">
      <div class="column gap-2">
        <span> Lightning Address </span>
        <input
          type="text"
          placeholder="user@domain.com"
          bind:value={address}
          class="input input-bordered flex w-full"
          disabled={loading} />
        <p class="text-xs opacity-75">
          You can enter one manually or use your connected wallet's address (if available). Leave
          empty to remove your lightning address
        </p>
      </div>

      {#if walletLud16 && walletLud16 !== address}
        <div class="card bg-base-200 p-4">
          <div class="flex items-center justify-between gap-3">
            <div class="column gap-1">
              <div class="flex items-center gap-2">
                <Icon icon={Wallet} size={4} />
                <span class="text-sm font-medium">Wallet Address</span>
              </div>
              <p class="text-xs opacity-75">{walletLud16}</p>
            </div>
            <Button class="btn btn-outline btn-sm" onclick={useWalletAddress} disabled={loading}>
              Use This
            </Button>
          </div>
        </div>
      {/if}
    </div>
  </ModalBody>
  <ModalFooter>
    <Button class="btn btn-neutral" onclick={back} disabled={loading}>Cancel</Button>
    <Button class="btn btn-primary" onclick={save} disabled={loading}>
      {#if loading}
        <span class="loading loading-spinner loading-sm"></span>
      {:else}
        <Icon icon={CheckCircle} />
      {/if}
      Save Changes
    </Button>
  </ModalFooter>
</Modal>
