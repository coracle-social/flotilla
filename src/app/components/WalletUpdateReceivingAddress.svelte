<script lang="ts">
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import ModalFooter from "@lib/components/ModalFooter.svelte"
  import Wallet from "@assets/icons/wallet.svg?dataurl"
  import CheckCircle from "@assets/icons/check-circle.svg?dataurl"
  import CloseCircle from "@assets/icons/close-circle.svg?dataurl"
  import {type Profile} from "@welshman/util"
  import {type Session} from "@welshman/app"
  import {updateProfile} from "@app/core/commands"
  import {pushToast} from "../util/toast"

  interface Props {
    profile: Profile
    session: Session | null
  }

  const back = () => history.back()

  const {profile, session}: Props = $props()

  let lightningAddress = $state(profile.lud16 || "")
  let isLoading = $state(false)
  let validationError = $state("")

  const walletLud16 = $derived(
    session?.wallet?.info && "lud16" in session.wallet.info ? session.wallet.info.lud16 : undefined,
  )

  const validateLightningAddress = (address: string): boolean => {
    if (!address.trim()) {
      validationError = ""
      return true
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(address)) {
      validationError = "Please enter a valid lightning address (e.g., user@domain.com)"
      return false
    }

    validationError = ""
    return true
  }

  const useWalletAddress = () => {
    if (walletLud16) {
      lightningAddress = walletLud16
      validateLightningAddress(walletLud16)
    }
  }

  const updateProfileWithLightningAddress = async (address: string) => {
    isLoading = true
    try {
      await updateProfile({
        profile: {
          ...profile,
          lud06: undefined,
          lud16: address.trim() || undefined,
        },
      })
      back()
    } catch (error) {
      pushToast({theme: "error", message: "Failed to update profile"})
    } finally {
      isLoading = false
    }
  }

  const handleSave = async () => {
    if (!validateLightningAddress(lightningAddress)) {
      pushToast({theme: "error", message: "Invalid lightning address"})
      return
    }
    await updateProfileWithLightningAddress(lightningAddress)
  }
</script>

<div class="column gap-4">
  <ModalHeader>
    {#snippet title()}
      Update Lightning Address
    {/snippet}
    {#snippet info()}
      Update your lightning address for receiving payments.
    {/snippet}
  </ModalHeader>

  <div class="column gap-4">
    <div class="column gap-2">
      <span> Lightning Address </span>
      <input
        type="text"
        placeholder="user@domain.com"
        bind:value={lightningAddress}
        class="input input-bordered flex w-full"
        disabled={isLoading} />
      {#if validationError}
        <p class="text-xs text-error">{validationError}</p>
      {/if}
      <p class="text-xs opacity-75">
        You can enter one manually or use your connected wallet's address (if available). Leave
        empty to remove your lightning address
      </p>
    </div>

    {#if walletLud16 && walletLud16 !== lightningAddress}
      <div class="card bg-base-200 p-4">
        <div class="flex items-center justify-between gap-3">
          <div class="column gap-1">
            <div class="flex items-center gap-2">
              <Icon icon={Wallet} size={4} />
              <span class="text-sm font-medium">Wallet Address</span>
            </div>
            <p class="text-xs opacity-75">{walletLud16}</p>
          </div>
          <Button class="btn btn-outline btn-sm" onclick={useWalletAddress} disabled={isLoading}>
            Use This
          </Button>
        </div>
      </div>
    {/if}

    {#if profile.lud16 && profile.lud16 !== lightningAddress}
      <div class="flex items-start gap-3">
        <Icon icon={CloseCircle} class="mt-1 text-warning" />
        <span class="text-sm font-medium"
          >This will update your current receiving address: {profile.lud16}</span>
      </div>
    {/if}
  </div>

  <ModalFooter>
    <Button class="btn btn-neutral" onclick={back} disabled={isLoading}>Cancel</Button>
    <Button class="btn btn-primary" onclick={handleSave} disabled={isLoading || !!validationError}>
      {#if isLoading}
        <span class="loading loading-spinner loading-sm"></span>
      {:else}
        <Icon icon={CheckCircle} />
      {/if}
      Save Changes
    </Button>
  </ModalFooter>
</div>
