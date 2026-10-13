<script lang="ts">
  import {Invoice} from "@getalby/lightning-tools/bolt11"
  import AltArrowLeft from "@assets/icons/alt-arrow-left.svg?dataurl"
  import Bolt from "@assets/icons/bolt.svg?dataurl"
  import Refresh from "@assets/icons/refresh.svg?dataurl"
  import Button from "@lib/components/Button.svelte"
  import FieldInline from "@lib/components/FieldInline.svelte"
  import Icon from "@lib/components/Icon.svelte"
  import Modal from "@lib/components/Modal.svelte"
  import ModalBody from "@lib/components/ModalBody.svelte"
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import ModalTitle from "@lib/components/ModalTitle.svelte"
  import ModalSubtitle from "@lib/components/ModalSubtitle.svelte"
  import ModalFooter from "@lib/components/ModalFooter.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import {errorMessage} from "@lib/util"
  import QRCode from "@app/components/QRCode.svelte"
  import {createInvoice} from "@app/features/lightning"
  import {pushToast} from "@app/ui/toast"

  const back = () => history.back()

  const create = async () => {
    const satAmount = Math.floor(Number(sats))

    if (!Number.isFinite(satAmount) || satAmount <= 0) {
      pushToast({theme: "error", message: "Enter an amount greater than 0."})
      return
    }

    loading = true

    try {
      const paymentRequest = await createInvoice({sats: satAmount})

      invoice = new Invoice({pr: paymentRequest})
      sats = invoice.satoshi && invoice.satoshi > 0 ? invoice.satoshi : satAmount

      pushToast({message: "Invoice created"})
    } catch (e) {
      console.warn(e)

      const message = errorMessage(e)

      pushToast({
        theme: "error",
        message: `Failed to create invoice: ${message}`,
      })
    } finally {
      loading = false
    }
  }

  const reset = () => {
    invoice = undefined
    sats = 10
  }

  let loading = $state(false)
  let invoice: Invoice | undefined = $state()
  let sats = $state(10)
</script>

<Modal>
  <ModalBody>
    <ModalHeader>
      <ModalTitle>Receive with Lightning</ModalTitle>
      <ModalSubtitle>Use your wallet to receive Bitcoin payments over lightning.</ModalSubtitle>
    </ModalHeader>
    {#if invoice}
      <div class="card flex flex-col gap-2">
        <div class="flex flex-col items-center gap-6 pt-4">
          <QRCode code={invoice.paymentRequest} class="w-full max-w-64" />
          <p class="text-center text-sm opacity-75">Scan with your wallet, or click to copy.</p>
        </div>
      </div>
    {:else}
      <div class="card flex flex-col gap-2">
        <FieldInline>
          {#snippet label()}
            Amount (satoshis)
          {/snippet}
          {#snippet input()}
            <div class="flex grow justify-end">
              <label class="input flex items-center gap-2">
                <Icon icon={Bolt} />
                <input bind:value={sats} type="number" class="w-14" placeholder="0" />
              </label>
            </div>
          {/snippet}
        </FieldInline>
        <p class="text-sm opacity-75">Enter an amount to generate an invoice with your wallet.</p>
      </div>
    {/if}
  </ModalBody>
  <ModalFooter>
    <Button class="button button-link" onclick={back}>
      <Icon icon={AltArrowLeft} />
      Go back
    </Button>
    {#if invoice}
      <Button class="button button-neutral" onclick={reset} disabled={loading}>
        <Icon icon={Refresh} />
        Re-generate
      </Button>
    {:else}
      <Button class="button button-primary" onclick={create} disabled={loading}>
        {#if loading}
          <Spinner size="sm" />
        {:else}
          <Icon icon={Bolt} />
        {/if}
        Create Invoice
      </Button>
    {/if}
  </ModalFooter>
</Modal>
