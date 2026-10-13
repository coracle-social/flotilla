<script lang="ts">
  import {gt} from "@welshman/lib"
  import {toMsats} from "@welshman/util"
  import {Invoice} from "@getalby/lightning-tools/bolt11"
  import {debounce} from "throttle-debounce"
  import Bolt from "@assets/icons/bolt.svg?dataurl"
  import AltArrowLeft from "@assets/icons/alt-arrow-left.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import FieldInline from "@lib/components/FieldInline.svelte"
  import Scanner from "@lib/components/Scanner.svelte"
  import Modal from "@lib/components/Modal.svelte"
  import ModalBody from "@lib/components/ModalBody.svelte"
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import ModalTitle from "@lib/components/ModalTitle.svelte"
  import ModalSubtitle from "@lib/components/ModalSubtitle.svelte"
  import ModalFooter from "@lib/components/ModalFooter.svelte"
  import {errorMessage} from "@lib/util"
  import {payInvoice} from "@app/features/lightning"
  import {pushToast} from "@app/ui/toast"
  import {clearModals} from "@app/ui/modal"

  const back = () => history.back()

  const onScan = debounce(1000, async (data: string) => {
    invoice = new Invoice({pr: data})
    sats = invoice.satoshi || 0
  })

  const confirm = async () => {
    loading = true

    try {
      if (gt(invoice!.satoshi, 0)) {
        await payInvoice(invoice!.paymentRequest)
      } else {
        await payInvoice(invoice!.paymentRequest, toMsats(sats))
      }

      pushToast({message: `Payment sent!`})
      clearModals()
    } catch (e) {
      console.error(e)

      const message = errorMessage(e)

      pushToast({
        theme: "error",
        message: `Failed to send payment: ${message}`,
      })
    } finally {
      loading = false
    }
  }

  let loading = $state(false)
  let invoice: Invoice | undefined = $state()
  let sats = $state(0)
</script>

<Modal>
  <ModalBody>
    <ModalHeader>
      <ModalTitle>Pay with Lightning</ModalTitle>
      <ModalSubtitle>Use your Nostr wallet to send Bitcoin payments over lightning.</ModalSubtitle>
    </ModalHeader>
    {#if invoice}
      <div class="card flex flex-col gap-2">
        <FieldInline>
          {#snippet label()}
            Amount (satoshis)
          {/snippet}
          {#snippet input()}
            <div class="flex grow justify-end">
              <label class="input input-group flex items-center gap-2">
                <Icon icon={Bolt} />
                <input
                  bind:value={sats}
                  type="number"
                  class="w-14"
                  disabled={invoice!.satoshi > 0} />
              </label>
            </div>
          {/snippet}
        </FieldInline>
        <p class="text-sm opacity-75">
          You're about to pay a bitcoin lightning invoice with the following description:
          <strong>{invoice.description || "[no description]"}</strong>"
        </p>
      </div>
    {:else}
      <Scanner onscan={onScan} />
      <p class="text-center text-sm opacity-75">
        To make a payment, scan a lightning invoice with your camera.
      </p>
    {/if}
  </ModalBody>
  <ModalFooter>
    <Button class="button button-link" onclick={back}>
      <Icon icon={AltArrowLeft} />
      Go back
    </Button>
    <Button
      class="button button-primary"
      onclick={confirm}
      disabled={!invoice || sats === 0 || loading}>
      {#if loading}
        <Spinner size="sm" />
      {:else}
        <Icon icon={Bolt} />
      {/if}
      Confirm Payment
    </Button>
  </ModalFooter>
</Modal>
