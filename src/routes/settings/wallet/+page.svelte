<script lang="ts">
  import cx from "classnames"
  import {LOCALE, always, sleep} from "@welshman/lib"
  import {WalletType, displayRelayUrl, isNWCWallet, fromMsats} from "@welshman/util"
  import {session, pubkey, profilesByPubkey} from "@welshman/app"
  import DownloadMinimalistic from "@assets/icons/download-minimalistic.svg?dataurl"
  import UploadMinimalistic from "@assets/icons/upload-minimalistic.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import WalletPay from "@app/components/WalletPay.svelte"
  import WalletReceive from "@app/components/WalletReceive.svelte"
  import WalletConnect from "@app/components/WalletConnect.svelte"
  import WalletDisconnect from "@app/components/WalletDisconnect.svelte"
  import WalletUpdateReceivingAddress from "@app/components/WalletUpdateReceivingAddress.svelte"
  import {pushModal} from "@app/util/modal"
  import {getNwcClient, getWebLn} from "@app/core/commands"
  import Wallet2 from "@assets/icons/wallet.svg?dataurl"
  import CheckCircle from "@assets/icons/check-circle.svg?dataurl"
  import AddCircle from "@assets/icons/add-circle.svg?dataurl"
  import CloseCircle from "@assets/icons/close-circle.svg?dataurl"
  import InfoCircle from "@assets/icons/info-circle.svg?dataurl"

  const connect = () => pushModal(WalletConnect)

  const disconnect = () => pushModal(WalletDisconnect)

  const updateReceivingAddress = () => pushModal(WalletUpdateReceivingAddress)

  const profile = $derived($profilesByPubkey.get($pubkey || ""))
  const profileLightningAddress = $derived(profile?.lud16)
  const walletLud16 = $derived(
    $session?.wallet && isNWCWallet($session.wallet) ? $session.wallet.info.lud16 : undefined,
  )

  const pay = () => pushModal(WalletPay)

  const receive = () => {
    if ($session?.wallet) {
      pushModal(WalletReceive)
    } else {
      pushModal(WalletConnect)
    }
  }

  let walletStatus = $state<"checking" | "connected" | "unavailable">("checking")

  const isWalletAvailable = $derived(Boolean($session?.wallet) && walletStatus === "connected")
  const statusClass = $derived(
    cx("flex items-center gap-2 text-sm", {
      "text-success": walletStatus === "connected",
      "text-warning": walletStatus === "unavailable",
    }),
  )
  const connectionVerb = $derived(walletStatus === "connected" ? "Connected to" : "Configured for")

  const startWalletStatusCheck = async (wallet = $session?.wallet) => {
    walletStatus = "checking"

    if (wallet) {
      const promise =
        wallet.type === WalletType.NWC ? getNwcClient().getInfo() : getWebLn().getInfo()

      walletStatus = await Promise.race([
        promise.then(always("connected")).catch(always("unavailable")),
        sleep(5000).then(always("unavailable")),
      ])
    }
  }

  $effect(() => {
    startWalletStatusCheck($session?.wallet)
  })
</script>

<div class="content column gap-4">
  <div class="card2 bg-alt flex flex-col gap-6 shadow-md">
    <div class="flex items-center justify-between">
      <strong class="flex items-center gap-3">
        <Icon icon={Wallet2} />
        Wallet
      </strong>
      {#if $session?.wallet}
        <div class={statusClass}>
          {#if walletStatus === "checking"}
            <span class="loading loading-spinner loading-xs"></span>
            Checking
          {:else if walletStatus === "connected"}
            <Icon icon={CheckCircle} size={4} />
            Connected
          {:else}
            <Icon icon={InfoCircle} size={4} />
            Unavailable
          {/if}
        </div>
      {:else}
        <Button class="btn btn-primary btn-sm" onclick={connect}>
          <Icon icon={AddCircle} />
          Connect Wallet
        </Button>
      {/if}
    </div>
    <div class="col-4">
      {#if $session?.wallet}
        {#if $session.wallet.type === "webln"}
          {@const {node, version} = $session.wallet.info}
          <div class="flex flex-col justify-between gap-2 lg:flex-row">
            <p>
              {connectionVerb} <strong>{node?.alias || version || "unknown wallet"}</strong>
              via <strong>{$session.wallet.type}</strong>
            </p>
            <p class="flex gap-2 whitespace-nowrap">
              {#if walletStatus === "connected"}
                Balance:
                {#await getWebLn()
                  ?.enable()
                  .then(() => getWebLn().getBalance())}
                  <span class="loading loading-spinner loading-sm"></span>
                {:then res}
                  {new Intl.NumberFormat(LOCALE).format(res?.balance || 0)}
                {:catch}
                  [unknown]
                {/await}
                sats
              {:else if walletStatus === "checking"}
                Balance:
                <span class="loading loading-spinner loading-sm"></span>
              {:else}
                Balance unavailable
              {/if}
            </p>
          </div>
        {:else if $session.wallet.type === "nwc"}
          {@const {lud16, relayUrl} = $session.wallet.info}
          <div class="flex flex-col justify-between gap-2 lg:flex-row">
            <p>
              {connectionVerb} <strong>{lud16}</strong> via
              <strong>{displayRelayUrl(relayUrl)}</strong>
            </p>
            <p class="flex gap-2 whitespace-nowrap">
              {#if walletStatus === "connected"}
                Balance:
                {#await getNwcClient().getBalance()}
                  <span class="loading loading-spinner loading-sm"></span>
                {:then res}
                  {new Intl.NumberFormat(LOCALE).format(fromMsats(res?.balance || 0))}
                {:catch}
                  [unknown]
                {/await}
                sats
              {:else if walletStatus === "checking"}
                Balance:
                <span class="loading loading-spinner loading-sm"></span>
              {:else}
                Balance unavailable
              {/if}
            </p>
          </div>
        {/if}
        <div class="flex flex-col gap-4 lg:flex-row lg:justify-between">
          <Button class="btn btn-neutral btn-sm" onclick={disconnect}>
            <Icon icon={CloseCircle} />
            Disconnect Wallet
          </Button>
          <div class="flex w-full gap-4 lg:w-auto">
            <Button
              class="btn btn-primary btn-sm flex-1 justify-center lg:flex-none"
              onclick={pay}
              disabled={!isWalletAvailable}>
              <Icon icon={UploadMinimalistic} />
              Send
            </Button>
            <Button
              class="btn btn-secondary btn-sm flex-1 justify-center lg:flex-none"
              onclick={receive}
              disabled={!isWalletAvailable}>
              <Icon icon={DownloadMinimalistic} />
              Receive
            </Button>
          </div>
        </div>
      {:else}
        <p class="py-12 text-center opacity-75">No wallet connected</p>
      {/if}
    </div>
  </div>
  <div class="card2 bg-alt flex flex-col shadow-md gap-6">
    <strong>Lightning Address</strong>
    <div class="flex justify-between items-center gap-2">
      <span class={profileLightningAddress ? "" : "text-warning"}>
        {profileLightningAddress ? profileLightningAddress : "Not set"}
      </span>
      <Button class="btn btn-neutral btn-xs ml-3" onclick={updateReceivingAddress}>Update</Button>
    </div>
    {#if profileLightningAddress && walletLud16 && profile?.lud16 !== walletLud16}
      <div class="card2 bg-alt flex items-center gap-2 text-xs">
        <Icon icon={InfoCircle} size={4} />
        Your profile has a different lightning address than your connected wallet.
      </div>
    {/if}
  </div>
</div>
