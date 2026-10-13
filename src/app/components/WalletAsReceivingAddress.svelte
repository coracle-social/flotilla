<script lang="ts">
  import {getWalletAddress} from "@welshman/util"
  import {Profiles} from "@welshman/app"
  import {errorMessage} from "@lib/util"
  import Button from "@lib/components/Button.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import Modal from "@lib/components/Modal.svelte"
  import ModalBody from "@lib/components/ModalBody.svelte"
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import ModalTitle from "@lib/components/ModalTitle.svelte"
  import ModalFooter from "@lib/components/ModalFooter.svelte"
  import {deriveUserItem} from "@app/core/app"
  import {profiles} from "@app/core/plugins"
  import {wallet} from "@app/features/lightning"
  import {clearModals} from "@app/ui/modal"
  import {pushToast} from "@app/ui/toast"

  const userProfile = deriveUserItem(Profiles)

  const lud16 = getWalletAddress(wallet.get()!)

  const confirm = async () => {
    loading = true

    try {
      const command = await $profiles.update(writer => writer.update({lud06: undefined, lud16}))
      const error = await command.publish().getError()

      if (error) {
        pushToast({theme: "error", message: `Failed to update profile: ${errorMessage(error)}`})
      } else {
        clearModals()
      }
    } catch (e) {
      console.error(e)
      pushToast({theme: "error", message: "Failed to update profile."})
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
    {#if $userProfile?.lnurl()}
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
    <Button class="button button-neutral" onclick={cancel} disabled={loading}>No, skip this</Button>
    <Button class="button button-primary" onclick={confirm} disabled={loading}>
      <Spinner {loading}>Yes, set as receiving address</Spinner>
    </Button>
  </ModalFooter>
</Modal>
