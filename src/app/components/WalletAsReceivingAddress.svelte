<script lang="ts">
  import {getWalletAddress} from "@welshman/util"
  import Button from "@lib/components/Button.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import ModalFooter from "@lib/components/ModalFooter.svelte"
  import {updateProfile} from "@app/core/commands"
  import {clearModals} from "@app/util/modal"
  import {userProfile, session} from "@welshman/app"
  import {makeProfile} from "@welshman/util"

  const lud16 = getWalletAddress($session!.wallet!)

  const confirm = async () => {
    const profile = $userProfile || makeProfile()

    loading = true

    try {
      await updateProfile({profile: {...profile, lud16}})

      clearModals()
    } finally {
      loading = false
    }
  }

  const cancel = () => {
    clearModals()
  }

  let loading = $state(false)
</script>

<div class="column gap-4">
  <ModalHeader>
    {#snippet title()}
      Set as Receiving Address?
    {/snippet}
  </ModalHeader>
  {#if $userProfile?.lud16}
    <p>
      Your current receiving address is different from the one provided by your connected wallet.
    </p>
    <p>
      Would you like to update your receiving address to <span class="text-primary">{lud16}</span>?
    </p>
  {:else}
    <p>
      You don't currently have a receiving address set, which means other people can't send you
      lightning payments.
    </p>
    <p>Would you like to use the one associated with your connected wallet?</p>
  {/if}
  <ModalFooter>
    <Button class="btn btn-neutral" onclick={cancel} disabled={loading}>No, skip this</Button>
    <Button class="btn btn-primary" onclick={confirm} disabled={loading}>
      <Spinner {loading}>Yes, set as receiving address</Spinner>
    </Button>
  </ModalFooter>
</div>
