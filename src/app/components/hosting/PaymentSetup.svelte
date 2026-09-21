<script lang="ts">
  import cx from "classnames"
  import {WalletType} from "@welshman/util"
  import Bolt from "@assets/icons/bolt.svg?dataurl"
  import Card from "@assets/icons/card.svg?dataurl"
  import CheckCircle from "@assets/icons/check-circle.svg?dataurl"
  import AltArrowLeft from "@assets/icons/alt-arrow-left.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import Field from "@lib/components/Field.svelte"
  import Input from "@lib/components/Input.svelte"
  import Modal from "@lib/components/Modal.svelte"
  import ModalBody from "@lib/components/ModalBody.svelte"
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import ModalTitle from "@lib/components/ModalTitle.svelte"
  import ModalSubtitle from "@lib/components/ModalSubtitle.svelte"
  import ModalFooter from "@lib/components/ModalFooter.svelte"
  import {user} from "@app/core"
  import {pushToast} from "@app/toast"
  import {getNwcClient, wallet} from "@app/lightning"
  import {updateTenant, createPortalSession} from "@app/hosting"

  type Tab = "nwc" | "card"

  type Props = {
    onSaved?: () => void
    initialTab?: Tab
    nwcConnected?: boolean
  }

  const {onSaved, initialTab, nwcConnected = false}: Props = $props()

  const back = () => history.back()

  let tab = $state<Tab>(initialTab ?? "nwc")

  const showNwc = () => {
    tab = "nwc"
  }

  const showCard = () => {
    tab = "card"
  }

  let nwcUrl = $state("")
  let saving = $state(false)
  let saved = $state(false)
  let redirecting = $state(false)

  // Offer to reuse the app's spending wallet instead of re-pasting its NWC url.
  // The two wallets stay separate records, this just reuses the same connection.
  const spendingWalletUrl =
    $wallet?.type === WalletType.NWC ? getNwcClient().nostrWalletConnectUrl : undefined

  // The tenant's autopay wallet (a backend NWC, write-only), distinct from the
  // app's own wallet.
  const persistNwc = async (url?: string) => {
    if (!url || saving) {
      return
    }

    saving = true

    try {
      await updateTenant($user.pubkey, {nwc_url: url})
      saved = true
      onSaved?.()
    } catch (e) {
      pushToast({
        theme: "error",
        message: e instanceof Error ? e.message : "Failed to save wallet connection",
      })
    } finally {
      saving = false
    }
  }

  const saveNwc = () => persistNwc(nwcUrl.trim())

  const useSpendingWallet = () => persistNwc(spendingWalletUrl)

  const disconnectNwc = async () => {
    if (saving) {
      return
    }

    saving = true

    try {
      await updateTenant($user.pubkey, {nwc_url: ""})
      onSaved?.()
      pushToast({message: "Lightning wallet disconnected."})
      back()
    } catch (e) {
      pushToast({
        theme: "error",
        message: e instanceof Error ? e.message : "Failed to disconnect wallet",
      })
    } finally {
      saving = false
    }
  }

  const openPortal = async () => {
    redirecting = true

    try {
      const {url} = await createPortalSession($user.pubkey)

      window.location.href = url
    } catch (e) {
      pushToast({
        theme: "error",
        message: e instanceof Error ? e.message : "Failed to open billing portal",
      })
    } finally {
      redirecting = false
    }
  }
</script>

<Modal>
  <ModalBody>
    <ModalHeader>
      <ModalTitle>Set Up Payments</ModalTitle>
      <ModalSubtitle>
        Choose how you'd like to pay once invoices are issued for your relay.
      </ModalSubtitle>
    </ModalHeader>
    <div class="flex gap-2">
      <Button
        class={cx("button flex-1", {
          "button-primary": tab === "nwc",
          "button-neutral": tab !== "nwc",
        })}
        onclick={showNwc}>
        <Icon icon={Bolt} size={4} />
        Lightning
      </Button>
      <Button
        class={cx("button flex-1", {
          "button-primary": tab === "card",
          "button-neutral": tab !== "card",
        })}
        onclick={showCard}>
        <Icon icon={Card} size={4} />
        Card
      </Button>
    </div>
    <div class="flex min-h-44 flex-col justify-center gap-4">
      {#if tab === "nwc"}
        {#if saved}
          <div class="flex flex-col items-center gap-2 text-center">
            <Icon icon={CheckCircle} size={8} class="text-primary" />
            <p class="font-bold">Wallet connected!</p>
            <p class="text-sm text-content-muted">Automatic payments are now enabled.</p>
          </div>
        {:else}
          {#if nwcConnected}
            <p class="text-sm text-content-muted">
              A Lightning wallet is connected. Paste a new URL to replace it, or disconnect.
            </p>
          {/if}
          <Field>
            {#snippet label()}
              Nostr Wallet Connect URL
            {/snippet}
            {#snippet input()}
              <Input
                bind:value={nwcUrl}
                autocomplete="off"
                placeholder="nostr+walletconnect://..." />
            {/snippet}
          </Field>
          {#if nwcConnected}
            <Button
              class="button button-link button-sm self-center text-error"
              disabled={saving}
              onclick={disconnectNwc}>
              Disconnect wallet
            </Button>
          {:else if spendingWalletUrl}
            <Button
              class="button button-link button-sm self-center"
              disabled={saving}
              onclick={useSpendingWallet}>
              Re-use your spending wallet
            </Button>
          {/if}
        {/if}
      {:else}
        <div class="flex flex-col items-center gap-4 text-center">
          <Icon icon={Card} size={8} class="text-content-muted" />
          <p class="text-sm text-content-muted">
            Add a payment card via Stripe to enable automatic billing. If an invoice is currently
            due, we will retry collection after card setup.
          </p>
        </div>
      {/if}
    </div>
  </ModalBody>
  <ModalFooter>
    {#if saved}
      <div></div>
      <Button class="button button-primary" onclick={back}>Done</Button>
    {:else}
      <Button class="button button-link" onclick={back}>
        <Icon icon={AltArrowLeft} />
        Set up later
      </Button>
      {#if tab === "nwc"}
        <Button class="button button-primary" disabled={saving || !nwcUrl.trim()} onclick={saveNwc}>
          <Spinner loading={saving}>Save</Spinner>
        </Button>
      {:else}
        <Button class="button button-primary" disabled={redirecting} onclick={openPortal}>
          <Spinner loading={redirecting}>Add a payment card</Spinner>
        </Button>
      {/if}
    {/if}
  </ModalFooter>
</Modal>
