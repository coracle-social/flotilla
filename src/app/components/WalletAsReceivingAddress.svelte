<script lang="ts">
  import Button from "@lib/components/Button.svelte"
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import ModalFooter from "@lib/components/ModalFooter.svelte"
  import {updateProfile} from "@app/core/commands"
  import {clearModals} from "@app/util/modal"
  import {profilesByPubkey, pubkey, session} from "@welshman/app"
  import {makeProfile, type NWCInfo} from "@welshman/util"

  const updateProfileWithLightningAddress = async () => {
    const profile = $profilesByPubkey.get($pubkey || "") || makeProfile()
    const lud16 = ($session?.wallet?.info as NWCInfo).lud16
    await updateProfile({profile: {...profile, lud16}})
  }

  const confirm = async () => {
    await updateProfileWithLightningAddress()
    clearModals()
  }

  const cancel = () => {
    clearModals()
  }
</script>

<div class="column gap-4">
  <ModalHeader>
    {#snippet title()}
      <div class="flex items-center">Set as Receiving Address?</div>
    {/snippet}
    {#snippet info()}
      Are you sure you want to use your connected wallet for receiving payments?
    {/snippet}
  </ModalHeader>

  <ModalFooter>
    <Button class="btn btn-neutral" onclick={cancel}>No, skip this</Button>
    <Button class="btn btn-primary" onclick={confirm}>Yes, set as receiving address</Button>
  </ModalFooter>
</div>
