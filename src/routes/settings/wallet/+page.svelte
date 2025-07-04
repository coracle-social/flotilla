<script lang="ts">
  import {nwc} from "@getalby/sdk"
  import {LOCALE} from "@welshman/lib"
  import {displayRelayUrl} from "@welshman/util"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import WalletConnect from "@app/components/WalletConnect.svelte"
  import WalletDisconnect from "@app/components/WalletDisconnect.svelte"
  import {pushModal} from "@app/modal"
  import {wallet, getWebLn} from "@app/state"

  const connect = () => pushModal(WalletConnect)

  const disconnect = () => pushModal(WalletDisconnect)
</script>

<div class="content column gap-4">
  <div class="card2 bg-alt flex flex-col gap-6 shadow-xl">
    <div class="flex items-center justify-between">
      <strong class="flex items-center gap-3">
        <Icon icon="wallet" />
        Wallet
      </strong>
      {#if $wallet}
        <div class="flex items-center gap-2 text-sm">
          <Icon icon="check-circle" size={4} />
          Connected
        </div>
      {:else}
        <Button class="btn btn-primary btn-sm" onclick={connect}>
          <Icon icon="add-circle" />
          Connect Wallet
        </Button>
      {/if}
    </div>
    <div class="col-4">
      {#if $wallet}
        {#if $wallet?.type === "webln"}
          {@const {node, version} = $wallet.info}
          <div class="flex flex-col justify-between gap-2 lg:flex-row">
            <p>
              Connected to <strong>{node?.alias || version || "unknown wallet"}</strong>
              via <strong>{$wallet.type}</strong>
            </p>
            <p class="flex items-center gap-2">
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
        {:else if $wallet.type === "nwc"}
          {@const {lud16, relayUrl, nostrWalletConnectUrl} = $wallet.info}
          <div class="flex flex-col justify-between gap-2 lg:flex-row">
            <p>
              Connected to <strong>{lud16}</strong> via <strong>{displayRelayUrl(relayUrl)}</strong>
            </p>
            <p class="flex items-center gap-2">
              Balance:
              {#await new nwc.NWCClient({nostrWalletConnectUrl}).getBalance()}
                <span class="loading loading-spinner loading-sm"></span>
              {:then res}
                {new Intl.NumberFormat(LOCALE).format(res?.balance || 0)}
              {:catch}
                [unknown]
              {/await}
              sats
            </p>
          </div>
        {/if}
        <Button class="btn btn-neutral btn-sm" onclick={disconnect}>
          <Icon icon="close-circle" />
          Disconnect Wallet
        </Button>
      {:else}
        <p class="py-12 text-center opacity-75">No wallet connected</p>
      {/if}
    </div>
  </div>
</div>
