<script lang="ts">
  import {makeProfile} from "@welshman/util"
  import {getWalletAddress} from "@welshman/util"
  import {userProfile, waitForThunkError, session} from "@welshman/app"
  import {errorMessage} from "@lib/util"
  import Button from "@lib/components/Button.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import Modal from "@lib/components/Modal.svelte"
  import ModalBody from "@lib/components/ModalBody.svelte"
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import ModalTitle from "@lib/components/ModalTitle.svelte"
  import ModalFooter from "@lib/components/ModalFooter.svelte"
  import {updateProfile} from "@app/core/commands"
  import {clearModals} from "@app/util/modal"
  import {pushToast} from "@app/util/toast"

  const lud16 = getWalletAddress($session!.wallet!)

  const confirm = async () => {
    const profile = $userProfile || makeProfile()

    loading = true

    try {
      const error = await waitForThunkError(updateProfile({profile: {...profile, lud16}}))

      if (error) {
        pushToast({theme: "error", message: `Failed to update profile: ${errorMessage(error)}`})
      } else {
        clearModals()
      }
    } finally {
      loading = false
    }
  }

  const cancel = () => {
    clearModals()
  }

  let loading = $state(false)
</script>

<Modal>
  <ModalBody>
    <ModalHeader>
      <ModalTitle>Set as Receiving Address?</ModalTitle>
    </ModalHeader>
    {#if $userProfile?.lud16}
      <p>
        Your current receiving address is different from the one provided by your connected wallet.
      </p>
      <p>
        Would you like to update your receiving address to <span class="text-primary">{lud16}</span
        >?
      </p>
    {:else}
      <p>
        You don't currently have a receiving address set, which means other people can't send you
        lightning payments.
      </p>
      <p>Would you like to use the one associated with your connected wallet?</p>
    {/if}
  </ModalBody>
  <ModalFooter>
    <Button class="btn btn-neutral" onclick={cancel} disabled={loading}>No, skip this</Button>
    <Button class="btn btn-primary" onclick={confirm} disabled={loading}>
      <Spinner {loading}>Yes, set as receiving address</Spinner>
    </Button>
  </ModalFooter>
</Modal>
