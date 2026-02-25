<script lang="ts">
  import {onDestroy} from "svelte"
  import type {NativeEmoji} from "emoji-picker-element/shared"
  import {signer, deriveZapperForPubkey} from "@welshman/app"
  import {request} from "@welshman/net"
  import {Router} from "@welshman/router"
  import {requestZap, makeZapRequest, getZapResponseFilter} from "@welshman/util"
  import Bolt from "@assets/icons/bolt.svg?dataurl"
  import Copy from "@assets/icons/copy.svg?dataurl"
  import AltArrowLeft from "@assets/icons/alt-arrow-left.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import Button from "@lib/components/Button.svelte"
  import FieldInline from "@lib/components/FieldInline.svelte"
  import Modal from "@lib/components/Modal.svelte"
  import ModalBody from "@lib/components/ModalBody.svelte"
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import ModalTitle from "@lib/components/ModalTitle.svelte"
  import ModalSubtitle from "@lib/components/ModalSubtitle.svelte"
  import ModalFooter from "@lib/components/ModalFooter.svelte"
  import EmojiButton from "@lib/components/EmojiButton.svelte"
  import {errorMessage} from "@lib/util"
  import ProfileLink from "@app/components/ProfileLink.svelte"
  import QRCode from "@app/components/QRCode.svelte"
  import WalletConnect from "@app/components/WalletConnect.svelte"
  import {pushModal} from "@app/util/modal"
  import {clip, pushToast} from "@app/util/toast"

  type Props = {
    url: string
    pubkey: string
    eventId?: string
  }

  const {url, pubkey, eventId}: Props = $props()

  const minPos = 1
  const maxPos = 1000
  const minVal = 21
  const maxVal = 1000000
  const zapperStore = deriveZapperForPubkey(pubkey)

  const posToAmount = (pos: number) => {
    const normalizedPos = (pos - minPos) / (maxPos - minPos)
    const logMin = Math.log(minVal)
    const logMax = Math.log(maxVal)
    const logValue = logMin + normalizedPos * (logMax - logMin)
    return Math.round(Math.exp(logValue))
  }

  const amountToPos = (amount: number) => {
    const clampedAmount = Math.max(minVal, Math.min(maxVal, amount))
    const logMin = Math.log(minVal)
    const logMax = Math.log(maxVal)
    const logValue = Math.log(clampedAmount)
    const normalizedPos = (logValue - logMin) / (logMax - logMin)
    return Math.round(minPos + normalizedPos * (maxPos - minPos))
  }

  const back = () => history.back()

  const onEmoji = (emoji: NativeEmoji) => {
    content = emoji.unicode
  }

  const createInvoice = async () => {
    loading = true

    try {
      const zapper = $zapperStore!
      const msats = amount * 1000
      const relays = url ? [url] : Router.get().ForPubkey(pubkey).getUrls()
      const params = {pubkey, content, eventId, msats, relays, zapper}
      const event = await $signer!.sign(makeZapRequest(params))
      const res = await requestZap({zapper, event})

      if (!res.invoice) {
        return pushToast({
          theme: "error",
          message: `Failed to create zap invoice: ${res.error || "no error given"}`,
        })
      }

      invoice = res.invoice

      paymentController?.abort()
      paymentController = new AbortController()

      request({
        relays,
        signal: paymentController.signal,
        filters: [getZapResponseFilter({zapper, pubkey, eventId})],
        onEvent: () => {
          pushToast({message: "Payment sent!"})
          paymentController?.abort()
          back()
        },
      })
    } catch (e) {
      console.error(e)

      const message = errorMessage(e)

      pushToast({
        theme: "error",
        message: `Failed to create zap invoice: ${message}`,
      })
    } finally {
      loading = false
    }
  }

  const connectWallet = () => {
    pushModal(WalletConnect)
  }

  const copyInvoice = () => {
    if (invoice) {
      clip(invoice)
    }
  }

  let pos = $state(minPos)
  let amount = $state(minVal)
  let content = $state("⚡️")
  let loading = $state(false)
  let invoice = $state<string>()
  let paymentController: AbortController | undefined = $state()

  onDestroy(() => {
    paymentController?.abort()
  })

  $effect(() => {
    amount = posToAmount(pos)
  })

  $effect(() => {
    const newPos = amountToPos(amount)
    if (newPos !== pos) {
      pos = newPos
    }
  })
</script>

<Modal>
  <ModalBody>
    <ModalHeader>
      <ModalTitle>Send a Zap</ModalTitle>
      <ModalSubtitle>To <ProfileLink {pubkey} class="!text-primary" /></ModalSubtitle>
    </ModalHeader>

    {#if invoice}
      <div class="flex flex-col items-center gap-6 pt-4">
        <QRCode code={invoice} class="w-full max-w-64" />
        <p class="text-center text-sm opacity-75">
          Scan with your wallet, or copy the invoice manually.
        </p>
      </div>
      <label class="input input-bordered flex w-full items-center justify-between gap-2">
        <input readonly class="ellipsize flex-grow" value={invoice} />
        <Button class="flex items-center" onclick={copyInvoice}>
          <Icon icon={Copy} />
        </Button>
      </label>
    {:else}
      <FieldInline class="!grid-cols-3">
        {#snippet label()}
          Emoji Reaction
        {/snippet}
        {#snippet input()}
          <div class="flex flex-grow items-center justify-end gap-4">
            <EmojiButton {onEmoji} class="btn btn-neutral">
              {content}
            </EmojiButton>
          </div>
        {/snippet}
      </FieldInline>
      <FieldInline class="!grid-cols-3">
        {#snippet label()}
          Amount
        {/snippet}
        {#snippet input()}
          <div class="flex flex-grow justify-end">
            <label class="input input-bordered flex items-center gap-2">
              <Icon icon={Bolt} />
              <input bind:value={amount} type="number" class="w-24" />
            </label>
          </div>
        {/snippet}
      </FieldInline>
      <input
        class="range range-primary -mt-2"
        type="range"
        min={minPos}
        max={maxPos}
        bind:value={pos} />
      <p class="card2 card-sm bg-alt text-center flex justify-between items-center">
        Want to zap directly?
        <Button class="btn btn-neutral btn-sm" onclick={connectWallet}>
          Connect a lightning wallet
        </Button>
      </p>
    {/if}
  </ModalBody>
  <ModalFooter>
    <Button class="btn btn-link" onclick={back}>
      <Icon icon={AltArrowLeft} />
      Go back
    </Button>
    {#if !invoice}
      <Button class="btn btn-primary" onclick={createInvoice} disabled={loading}>
        <Spinner {loading}>
          <div class="flex items-center gap-2">
            {#if !loading}
              <Icon icon={Bolt} />
            {/if}
            Create invoice
          </div>
        </Spinner>
      </Button>
    {/if}
  </ModalFooter>
</Modal>
