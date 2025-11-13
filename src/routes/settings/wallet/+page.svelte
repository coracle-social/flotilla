<script lang="ts">
  import {nwc} from "@getalby/sdk"
  import {LOCALE} from "@welshman/lib"
  import {displayRelayUrl, isNWCWallet, fromMsats} from "@welshman/util"
  import {session, pubkey, profilesByPubkey} from "@welshman/app"
  import Bolt from "@assets/icons/bolt.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import WalletPay from "@app/components/WalletPay.svelte"
  import WalletConnect from "@app/components/WalletConnect.svelte"
  import WalletDisconnect from "@app/components/WalletDisconnect.svelte"
  import WalletUpdateReceivingAddress from "@app/components/WalletUpdateReceivingAddress.svelte"
  import {pushModal} from "@app/util/modal"
  import {getWebLn} from "@app/core/commands"
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
</script>

<div class="content column gap-4">
  <div class="card2 bg-alt flex flex-col gap-6 shadow-md">
    <div class="flex items-center justify-between">
      <strong class="flex items-center gap-3">
        <Icon icon={Wallet2} />
        Wallet
      </strong>
      {#if $session?.wallet}
        <div class="flex items-center gap-2 text-sm text-success">
          <Icon icon={CheckCircle} size={4} />
          Connected
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
              Connected to <strong>{node?.alias || version || "unknown wallet"}</strong>
              via <strong>{$session.wallet.type}</strong>
            </p>
            <p class="flex gap-2 whitespace-nowrap">
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
            </p>
          </div>
        {:else if $session.wallet.type === "nwc"}
          {@const {lud16, relayUrl, nostrWalletConnectUrl} = $session.wallet.info}
          <div class="flex flex-col justify-between gap-2 lg:flex-row">
            <p>
              Connected to <strong>{lud16}</strong> via <strong>{displayRelayUrl(relayUrl)}</strong>
            </p>
            <p class="flex gap-2 whitespace-nowrap">
              Balance:
              {#await new nwc.NWCClient({nostrWalletConnectUrl}).getBalance()}
                <span class="loading loading-spinner loading-sm"></span>
              {:then res}
                {new Intl.NumberFormat(LOCALE).format(fromMsats(res?.balance || 0))}
              {:catch}
                [unknown]
              {/await}
              sats
            </p>
          </div>
        {/if}
        <Button class="btn btn-neutral btn-sm" onclick={disconnect}>
          <Icon icon={CloseCircle} />
          Disconnect Wallet
        </Button>
      {:else}
        <p class="py-12 text-center opacity-75">No wallet connected</p>
      {/if}
    </div>
  </div>
  <div
    class="card2 bg-alt flex flex-col shadow-md"
    class:gap-6={profileLightningAddress && walletLud16 && profile?.lud16 !== walletLud16}>
    <div class="flex items-center justify-between">
      <strong>Lightning Address</strong>
      <div class="flex items-center gap-2">
        <span class={profileLightningAddress ? "" : "text-warning"}>
          {profileLightningAddress ? profileLightningAddress : "Not set"}
        </span>
        <Button class="btn btn-neutral btn-xs ml-3" onclick={updateReceivingAddress}>Update</Button>
      </div>
    </div>
    {#if profileLightningAddress && walletLud16 && profile?.lud16 !== walletLud16}
      <div class="card2 bg-alt flex items-center gap-2 text-xs">
        <Icon icon={InfoCircle} size={4} />
        Your profile has a different lightning address than your connected wallet.
      </div>
    {/if}
  </div>
  <div class="flex justify-center py-12">
    <Button class="btn btn-primary" onclick={pay}>
      <Icon icon={Bolt} />
      Pay With Lightning
    </Button>
  </div>
</div>
