<script lang="ts">
  import cx from "classnames"
  import {LOCALE, always, call, removeAt, replaceAt, sleep} from "@welshman/lib"
  import {WalletType, displayRelayUrl, getLnUrl, isNWCWallet, fromMsats} from "@welshman/util"
  import DownloadMinimalistic from "@assets/icons/download-minimalistic.svg?dataurl"
  import UploadMinimalistic from "@assets/icons/upload-minimalistic.svg?dataurl"
  import Bolt from "@assets/icons/bolt.svg?dataurl"
  import AddCircle from "@assets/icons/add-circle.svg?dataurl"
  import TrashBin2 from "@assets/icons/trash-bin-2.svg?dataurl"
  import {preventDefault} from "@lib/html"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import PageContent from "@lib/components/PageContent.svelte"
  import Wallet2 from "@assets/icons/wallet.svg?dataurl"
  import CheckCircle from "@assets/icons/check-circle.svg?dataurl"
  import CloseCircle from "@assets/icons/close-circle.svg?dataurl"
  import InfoCircle from "@assets/icons/info-circle.svg?dataurl"
  import WalletPay from "@app/components/WalletPay.svelte"
  import WalletReceive from "@app/components/WalletReceive.svelte"
  import WalletConnect from "@app/components/WalletConnect.svelte"
  import WalletDisconnect from "@app/components/WalletDisconnect.svelte"
  import WalletUpdateReceivingAddress from "@app/components/WalletUpdateReceivingAddress.svelte"
  import {pushModal} from "@app/modal"
  import {displayLnurl, getNwcClient, getWebLn, wallet} from "@app/lightning"
  import {userSettingsValues, publishSettings, createSettingsForm} from "@app/settings"
  import {pushToast} from "@app/toast"
  import {profiles, user} from "@app/core"

  const connect = () => pushModal(WalletConnect)

  const disconnect = () => pushModal(WalletDisconnect)

  const updateReceivingAddress = () => pushModal(WalletUpdateReceivingAddress)

  const profile = $profiles.one($user.pubkey)
  const profileLnurl = $derived($profile?.lnurl())
  const profileLightningAddress = $derived(profileLnurl && displayLnurl(profileLnurl))
  const walletLud16 = $derived($wallet && isNWCWallet($wallet) ? $wallet.info.lud16 : undefined)
  const walletLnurl = $derived(walletLud16 && getLnUrl(walletLud16))

  const pay = () => pushModal(WalletPay)

  const receive = () => {
    if ($wallet) {
      pushModal(WalletReceive)
    } else {
      pushModal(WalletConnect)
    }
  }

  let walletStatus = $state("checking")

  const isWalletAvailable = $derived(Boolean($wallet) && walletStatus === "connected")
  const statusClass = $derived(
    cx("flex items-center gap-2 text-sm", {
      "text-success": walletStatus === "connected",
      "text-warning": walletStatus === "unavailable",
    }),
  )
  const connectionVerb = $derived(walletStatus === "connected" ? "Connected to" : "Configured for")

  const startWalletStatusCheck = async (currentWallet = $wallet) => {
    walletStatus = "checking"

    if (currentWallet) {
      const promise =
        currentWallet.type === WalletType.NWC
          ? getNwcClient().getInfo()
          : call(async () => {
              const client = getWebLn()

              await client.enable()

              return client.getInfo()
            })

      walletStatus = await Promise.race([
        promise.then(always("connected")).catch(always("unavailable")),
        sleep(5000).then(always("unavailable")),
      ])
    }
  }

  $effect(() => {
    startWalletStatusCheck($wallet)
  })

  const resetZapAmounts = () => {
    $settings.zap_amounts = [...$userSettingsValues.zap_amounts]
  }

  const addZapAmount = () => {
    $settings.zap_amounts = [...$settings.zap_amounts, $settings.zap_amounts.at(-1) || 21]
  }

  const removeZapAmount = (index: number) => () => {
    if ($settings.zap_amounts.length > 1) {
      $settings.zap_amounts = removeAt(index, $settings.zap_amounts)
    }
  }

  const onZapAmountInput = (index: number) => (e: Event & {currentTarget: HTMLInputElement}) => {
    $settings.zap_amounts = replaceAt(index, Number(e.currentTarget.value), $settings.zap_amounts)
  }

  const onZapAmountsSubmit = preventDefault(async () => {
    zapAmountsLoading = true

    try {
      if ($settings.zap_amounts.length === 0) {
        return pushToast({
          theme: "error",
          message: "Add at least one zap amount.",
        })
      }

      if ($settings.zap_amounts.some(amount => amount <= 0)) {
        return pushToast({
          theme: "error",
          message: "Zap amounts must be greater than zero.",
        })
      }

      await publishSettings({zap_amounts: $settings.zap_amounts})

      pushToast({message: "Your zap amounts have been saved!"})
    } catch (e) {
      console.error(e)
      pushToast({theme: "error", message: "Failed to save your zap amounts."})
    } finally {
      zapAmountsLoading = false
    }
  })

  const settings = createSettingsForm()
  let zapAmountsLoading = $state(false)
</script>

<PageContent class="@container">
  <div class="card flex flex-col gap-6">
    <div class="flex items-center justify-between">
      <strong class="flex items-center gap-3 text-lg">
        <Icon icon={Wallet2} />
        Your Wallet
      </strong>
      {#if $wallet}
        <div class={statusClass}>
          {#if walletStatus === "checking"}
            <Spinner size="xs" />
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
        <Button class="button button-primary button-sm" onclick={connect}>
          <Icon icon={AddCircle} />
          Connect Wallet
        </Button>
      {/if}
    </div>
    <div class="flex flex-col gap-4">
      {#if $wallet}
        {#if $wallet.type === "webln"}
          {@const {node, version} = $wallet.info}
          <div class="flex flex-col justify-between gap-2 @2xl:flex-row">
            <p>
              {connectionVerb} <strong>{node?.alias || version || "unknown wallet"}</strong>
              via <strong>{$wallet.type}</strong>
            </p>
            <p class="flex gap-2 whitespace-nowrap">
              {#if walletStatus === "connected"}
                Balance:
                {#await getWebLn()
                  ?.enable()
                  .then(() => getWebLn().getBalance())}
                  <Spinner size="sm" />
                {:then res}
                  {new Intl.NumberFormat(LOCALE).format(res?.balance || 0)}
                {:catch}
                  [unknown]
                {/await}
                sats
              {:else if walletStatus === "checking"}
                Balance:
                <Spinner size="sm" />
              {:else}
                Balance unavailable
              {/if}
            </p>
          </div>
        {:else if $wallet.type === "nwc"}
          {@const {lud16, relayUrl} = $wallet.info}
          <div class="flex flex-col justify-between gap-2 @2xl:flex-row">
            <p>
              {connectionVerb} <strong>{lud16}</strong> via
              <strong>{displayRelayUrl(relayUrl)}</strong>
            </p>
            <p class="flex gap-2 whitespace-nowrap">
              {#if walletStatus === "connected"}
                Balance:
                {#await getNwcClient().getBalance()}
                  <Spinner size="sm" />
                {:then res}
                  {new Intl.NumberFormat(LOCALE).format(fromMsats(res?.balance || 0))}
                {:catch}
                  [unknown]
                {/await}
                sats
              {:else if walletStatus === "checking"}
                Balance:
                <Spinner size="sm" />
              {:else}
                Balance unavailable
              {/if}
            </p>
          </div>
        {/if}
        <div class="flex flex-col gap-4 @2xl:flex-row @2xl:justify-between">
          <Button class="button button-neutral button-sm" onclick={disconnect}>
            <Icon icon={CloseCircle} />
            Disconnect Wallet
          </Button>
          <div class="flex w-full gap-4 @2xl:w-auto">
            <Button
              class="button button-primary button-sm flex-1 justify-center @2xl:flex-none"
              onclick={pay}
              disabled={!isWalletAvailable}>
              <Icon icon={UploadMinimalistic} />
              Send
            </Button>
            <Button
              class="button button-secondary button-sm flex-1 justify-center @2xl:flex-none"
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
  <div class="card flex flex-col gap-6">
    <strong>Lightning Address</strong>
    <div class="flex justify-between items-center gap-2">
      <span class={cx("min-w-0 truncate", !profileLightningAddress && "text-warning")}>
        {profileLightningAddress || "Not set"}
      </span>
      <Button class="button button-neutral button-xs ml-3" onclick={updateReceivingAddress}
        >Update</Button>
    </div>
    {#if profileLnurl && walletLnurl && profileLnurl !== walletLnurl}
      <div class="card flex items-center gap-2 text-xs">
        <Icon icon={InfoCircle} size={4} />
        Your profile has a different lightning address than your connected wallet.
      </div>
    {/if}
  </div>
  <form class="card flex flex-col gap-6" onsubmit={onZapAmountsSubmit}>
    <strong class="flex items-center gap-3 text-lg">
      <Icon icon={Bolt} />
      Zap Amounts
    </strong>
    <p class="text-sm opacity-75">Preset amounts shown when sending a zap.</p>
    <div class="flex flex-col gap-2">
      <!-- eslint-disable-next-line svelte/require-each-key -->
      {#each $settings.zap_amounts as amount, index}
        <div class="flex items-center gap-2">
          <Button
            class="button button-ghost button-sm"
            type="button"
            onclick={removeZapAmount(index)}
            disabled={$settings.zap_amounts.length === 1}>
            <Icon icon={TrashBin2} />
          </Button>
          <label class="input flex grow items-center gap-2">
            <Icon icon={Bolt} />
            <input type="number" class="grow" value={amount} oninput={onZapAmountInput(index)} />
          </label>
        </div>
      {/each}
      <Button class="button button-link w-fit px-0" type="button" onclick={addZapAmount}>
        <Icon icon={AddCircle} size={5} />
        Add amount
      </Button>
    </div>
    <div class="flex flex-row items-center justify-between gap-4">
      <Button
        class="button button-neutral"
        type="button"
        onclick={resetZapAmounts}
        disabled={zapAmountsLoading}>
        Discard Changes
      </Button>
      <Button type="submit" class="button button-primary" disabled={zapAmountsLoading}>
        <Spinner loading={zapAmountsLoading}>Save Changes</Spinner>
      </Button>
    </div>
  </form>
</PageContent>
