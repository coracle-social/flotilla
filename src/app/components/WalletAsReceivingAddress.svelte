<script lang="ts">
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import ModalFooter from "@lib/components/ModalFooter.svelte"
  import Wallet from "@assets/icons/wallet.svg?dataurl"
  import CheckCircle from "@assets/icons/check-circle.svg?dataurl"
  import CloseCircle from "@assets/icons/close-circle.svg?dataurl"
  import {type Profile} from "@welshman/util"
  import {updateProfile} from "@app/core/commands"

  interface Props {
    profile: Profile
    newLightningAddress: string
  }

  const {profile, newLightningAddress}: Props = $props()

  const updateProfileWithLightningAddress = async (lightningAddress: string) => {
    await updateProfile({profile: {...profile, lud16: lightningAddress}})
  }

  const back = () => history.back()

  const confirm = async () => {
    await updateProfileWithLightningAddress(newLightningAddress)
    back()
  }

  const cancel = () => {
    back()
  }

  const infoMessage =
    "Do you want to update your profile with this wallet's lightning address for receiving payments?"
</script>

<div class="column gap-4">
  <ModalHeader>
    {#snippet title()}
      <div class="flex items-center gap-2">
        <Icon icon={Wallet} />
        Set as Receiving Address?
      </div>
    {/snippet}
    {#snippet info()}
      {infoMessage}
    {/snippet}
  </ModalHeader>

  {#if profile.lud16 || profile.lud06}
    <div class="flex items-start gap-3">
      <Icon icon={CloseCircle} class="mt-1 text-warning" />
      <div class="column gap-2">
        <p class="font-semibold">Please note:</p>
        <ul class="list-inside list-disc space-y-1 text-sm opacity-75">
          <li>This will overwrite your existing receiving address</li>
        </ul>
      </div>
    </div>
  {/if}

  <ModalFooter>
    <Button class="btn btn-neutral" onclick={cancel}>No, Skip This</Button>
    <Button class="btn btn-primary" onclick={confirm}>
      <Icon icon={CheckCircle} />
      Yes, Set as Receiving Address
    </Button>
  </ModalFooter>
</div>
