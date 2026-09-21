<script lang="ts">
  import {onDestroy} from "svelte"
  import {first, removeUndefined} from "@welshman/lib"
  import {relay} from "@welshman/util"
  import type {TrustedEvent} from "@welshman/util"
  import {ZapRequest} from "@welshman/domain"
  import {Zappers} from "@welshman/app"
  import Bolt from "@assets/icons/bolt.svg?dataurl"
  import Copy from "@assets/icons/copy.svg?dataurl"
  import AltArrowLeft from "@assets/icons/alt-arrow-left.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import Button from "@lib/components/Button.svelte"
  import Modal from "@lib/components/Modal.svelte"
  import ModalBody from "@lib/components/ModalBody.svelte"
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import ModalTitle from "@lib/components/ModalTitle.svelte"
  import ModalSubtitle from "@lib/components/ModalSubtitle.svelte"
  import ModalFooter from "@lib/components/ModalFooter.svelte"
  import {errorMessage} from "@lib/util"
  import ProfileLink from "@app/components/ProfileLink.svelte"
  import QRCode from "@app/components/QRCode.svelte"
  import WalletConnect from "@app/components/WalletConnect.svelte"
  import ZapForm from "@app/components/ZapForm.svelte"
  import {app, domain, network} from "@app/core"
  import {payInvoice, wallet} from "@app/lightning"
  import {pushModal} from "@app/modal"
  import {zapAmounts} from "@app/settings"
  import {clip, pushToast} from "@app/toast"

  type Props = {
    url?: string
    pubkey: string
    event?: TrustedEvent
  }

  const {url, pubkey, event}: Props = $props()

  const zapper = $app.use(Zappers).forPubkey(pubkey, removeUndefined([url]))

  const back = () => history.back()

  const requestInvoice = async () => {
    const currentZapper = zapper.get()!
    const writer = $domain
      .writer(ZapRequest)
      .setContent(content)
      .setAmount(amount * 1000)
      .setLnurl(currentZapper.lnurl)
      .setRecipient(pubkey)

    if (url) {
      writer.forceRoutes(relay(url))
    }

    if (event) {
      writer.setEvent(event)
    }

    const res = await writer.requestInvoice(currentZapper)

    if (!res.invoice) {
      throw new Error(res.error || "no error given")
    }

    return {
      relays: await writer.relays(),
      invoice: res.invoice,
      filters: [currentZapper.getResponseFilter(pubkey, event?.id)],
    }
  }

  const payWithWallet = async () => {
    const {relays, invoice, filters} = await requestInvoice()

    await payInvoice(invoice)
    await $network.loadLenient({relays, filters})

    pushToast({message: "Zap successfully sent!"})
    back()
  }

  const createInvoice = async () => {
    const {relays, invoice: created, filters} = await requestInvoice()

    invoice = created

    paymentController?.abort()
    paymentController = new AbortController()

    $network.request({
      relays,
      filters,
      signal: paymentController.signal,
      onEvent: () => {
        pushToast({message: "Payment sent!"})
        paymentController?.abort()
        back()
      },
    })
  }

  const sendZap = async () => {
    loading = true

    try {
      if ($wallet) {
        await payWithWallet()
      } else {
        await createInvoice()
      }
    } catch (e) {
      console.error(e)

      pushToast({
        theme: "error",
        message: `Failed to zap: ${errorMessage(e)}`,
      })
    } finally {
      loading = false
    }
  }

  const connectWallet = () => {
    pushModal(WalletConnect, {}, {nested: true})
  }

  const copyInvoice = () => {
    if (invoice) {
      clip(invoice)
    }
  }

  let amount = $state<number>(first($zapAmounts) ?? 21)
  let content = $state("⚡️")
  let loading = $state(false)
  let invoice = $state<string>()
  let paymentController: AbortController | undefined = $state()

  onDestroy(() => {
    paymentController?.abort()
  })
</script>

<Modal>
  <ModalBody>
    <ModalHeader>
      <ModalTitle>Send a Zap</ModalTitle>
      <ModalSubtitle>To <ProfileLink {pubkey} class="text-primary!" /></ModalSubtitle>
    </ModalHeader>

    {#if invoice}
      <div class="flex flex-col gap-6">
        <div class="flex flex-col items-center gap-4">
          <QRCode code={invoice} class="w-full max-w-56" />
          <p class="text-content-muted text-center text-sm">
            Scan with your lightning wallet, or copy the invoice below.
          </p>
        </div>
        <label class="input flex w-full items-center gap-2">
          <input readonly class="min-w-0 grow truncate" value={invoice} />
          <Button
            class="button button-neutral button-sm button-square shrink-0"
            onclick={copyInvoice}>
            <Icon icon={Copy} size={4} />
          </Button>
        </label>
      </div>
    {:else}
      <ZapForm bind:amount bind:content>
        {#if !$wallet}
          <div class="card card-sm card-flat flex flex-col items-center gap-3 p-4 text-center">
            <p class="text-content-muted text-sm">
              Connect a wallet to pay instantly without scanning a QR code.
            </p>
            <Button class="button button-neutral" onclick={connectWallet}>
              Connect a lightning wallet
            </Button>
          </div>
        {/if}
      </ZapForm>
    {/if}
  </ModalBody>
  <ModalFooter>
    <Button class="button button-link" onclick={back}>
      <Icon icon={AltArrowLeft} />
      Go back
    </Button>
    {#if !invoice}
      <Button class="button button-primary" onclick={sendZap} disabled={loading}>
        <Spinner {loading}>
          <div class="flex items-center gap-2">
            {#if !loading}
              <Icon icon={Bolt} />
            {/if}
            {$wallet ? "Send Zap" : "Create invoice"}
          </div>
        </Spinner>
      </Button>
    {/if}
  </ModalFooter>
</Modal>
