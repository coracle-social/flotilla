<script lang="ts">
  import {onMount, onDestroy} from "svelte"
  import cx from "classnames"
  import Bolt from "@assets/icons/bolt.svg?dataurl"
  import Card from "@assets/icons/card.svg?dataurl"
  import Copy from "@assets/icons/copy.svg?dataurl"
  import Refresh from "@assets/icons/refresh.svg?dataurl"
  import CheckCircle from "@assets/icons/check-circle.svg?dataurl"
  import AltArrowLeft from "@assets/icons/alt-arrow-left.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import Modal from "@lib/components/Modal.svelte"
  import ModalBody from "@lib/components/ModalBody.svelte"
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import ModalTitle from "@lib/components/ModalTitle.svelte"
  import ModalSubtitle from "@lib/components/ModalSubtitle.svelte"
  import ModalFooter from "@lib/components/ModalFooter.svelte"
  import {errorMessage} from "@lib/util"
  import QRCode from "@app/components/QRCode.svelte"
  import PaymentSetup from "@app/components/hosting/PaymentSetup.svelte"
  import InvoiceItemsList from "@app/components/hosting/InvoiceItemsList.svelte"
  import {clip, pushToast} from "@app/toast"
  import {pushModal} from "@app/modal"
  import {
    ensureInvoiceBolt11,
    reconcileInvoice,
    createInvoiceCheckout,
    listInvoiceItems,
    formatUsd,
    formatPeriod,
    type Invoice,
    type InvoiceItem,
  } from "@app/hosting"

  type Props = {
    invoice: Invoice
    onPaid?: () => void
  }

  const {invoice, onPaid}: Props = $props()

  type Bolt11Status = "idle" | "loading" | "ready" | "error"

  let method = $state<"lightning" | "card">("lightning")
  let bolt11 = $state("")
  let bolt11Status = $state<Bolt11Status>("idle")
  let bolt11Error = $state("")
  let items = $state<InvoiceItem[]>([])
  let paid = $state(false)
  let checking = $state(false)
  let redirecting = $state(false)

  let pollTimer: ReturnType<typeof setTimeout> | undefined
  let destroyed = false

  const amountLabel = $derived(formatUsd(invoice.amount))
  const periodLabel = $derived(formatPeriod(invoice.period_start, invoice.period_end))

  const back = () => history.back()

  const showLightning = () => {
    method = "lightning"
  }

  const showCard = () => {
    method = "card"
  }

  const copyBolt11 = () => clip(bolt11)

  const stopPolling = () => {
    if (pollTimer) {
      clearTimeout(pollTimer)
      pollTimer = undefined
    }
  }

  const markPaid = () => {
    if (paid) {
      return
    }

    paid = true
    stopPolling()
    onPaid?.()
  }

  const loadBolt11 = async () => {
    bolt11Status = "loading"
    bolt11Error = ""
    bolt11 = ""

    try {
      const {lnbc} = await ensureInvoiceBolt11(invoice.id)

      bolt11 = lnbc
      bolt11Status = "ready"
    } catch (e) {
      bolt11Status = "error"
      bolt11Error = errorMessage(e) || "Failed to generate Lightning invoice"
    }
  }

  const loadItems = async () => {
    try {
      items = await listInvoiceItems(invoice.id)
    } catch {
      // line items are cosmetic; don't block payment
    }
  }

  const reconcile = async () => {
    const updated = await reconcileInvoice(invoice.id)

    if (updated.paid_at) {
      markPaid()
      return true
    }

    return false
  }

  // Silent poll until paid or the modal closes.
  const pollOnce = async () => {
    if (destroyed || paid) {
      return
    }

    try {
      if (await reconcile()) {
        return
      }
    } catch {
      // keep polling
    }

    if (!destroyed && !paid) {
      pollTimer = setTimeout(pollOnce, 3500)
    }
  }

  const checkPayment = async () => {
    if (checking) {
      return
    }

    checking = true

    try {
      if (!(await reconcile())) {
        pushToast({message: "Payment not yet confirmed. Please try again after sending."})
      }
    } catch (e) {
      pushToast({theme: "error", message: errorMessage(e) || "Failed to check payment status"})
    } finally {
      checking = false
    }
  }

  // Nested so this dialog stays mounted, with onSaved collecting and the poll as the backstop.
  const connectWallet = () => {
    pushModal(
      PaymentSetup,
      {initialTab: "nwc", onSaved: () => void reconcile().catch(() => {})},
      {nested: true},
    )
  }

  const payWithCard = async () => {
    if (redirecting) {
      return
    }

    redirecting = true

    try {
      const {url} = await createInvoiceCheckout(invoice.id)

      window.location.href = url
    } catch (e) {
      pushToast({theme: "error", message: errorMessage(e) || "Failed to open checkout"})
    } finally {
      redirecting = false
    }
  }

  onMount(() => {
    void loadItems()
    void loadBolt11()

    pollTimer = setTimeout(pollOnce, 3500)
  })

  onDestroy(() => {
    destroyed = true
    stopPolling()
  })
</script>

<Modal>
  <ModalBody>
    <ModalHeader>
      <ModalTitle>Pay invoice</ModalTitle>
      <ModalSubtitle>
        {#if periodLabel}
          Billing period {periodLabel}
        {:else}
          Complete your payment to keep your relays running.
        {/if}
      </ModalSubtitle>
    </ModalHeader>

    <p class="text-center text-3xl font-bold">{amountLabel}</p>

    {#if paid}
      <div class="flex flex-col items-center gap-3 py-6 text-center">
        <Icon icon={CheckCircle} size={12} class="text-primary" />
        <p class="text-sm font-semibold text-content">Payment confirmed!</p>
        <p class="text-sm text-content-muted">Thank you. Your account is up to date.</p>
      </div>
    {:else}
      {#if items.length > 0}
        <InvoiceItemsList {items} />
      {/if}
      <div class="flex gap-2">
        <Button
          class={cx("button grow", {
            "button-primary": method === "lightning",
            "button-neutral": method !== "lightning",
          })}
          onclick={showLightning}>
          <Icon icon={Bolt} size={4} />
          Lightning
        </Button>
        <Button
          class={cx("button grow", {
            "button-primary": method === "card",
            "button-neutral": method !== "card",
          })}
          onclick={showCard}>
          <Icon icon={Card} size={4} />
          Card
        </Button>
      </div>
      {#if method === "lightning"}
        {#if bolt11Status === "idle" || bolt11Status === "loading"}
          <div class="flex items-center justify-center py-12 text-sm text-content-muted">
            <Spinner>Generating invoice…</Spinner>
          </div>
        {:else if bolt11Status === "error"}
          <div class="flex flex-col gap-3 rounded-2xl border border-error bg-surface-less p-4">
            <p class="text-sm font-semibold text-error">Unable to generate invoice</p>
            <p class="break-words text-xs text-content-muted">{bolt11Error}</p>
            <Button class="button button-neutral button-sm self-start" onclick={loadBolt11}>
              <Icon icon={Refresh} size={4} />
              Retry
            </Button>
          </div>
        {:else}
          <div class="flex flex-col items-center gap-6 pt-2">
            <QRCode code={bolt11} class="w-full max-w-64" />
            <p class="text-center text-sm text-content-muted">
              Scan with a Lightning wallet, or copy the invoice manually.
            </p>
          </div>
          <label class="input flex w-full items-center justify-between gap-2">
            <input readonly class="min-w-0 grow truncate" value={bolt11} />
            <Button class="flex items-center" onclick={copyBolt11}>
              <Icon icon={Copy} />
            </Button>
          </label>
          <Button class="button button-neutral button-block" onclick={connectWallet}>
            <Icon icon={Bolt} size={4} />
            Connect a wallet to pay
          </Button>
        {/if}
      {:else}
        <div class="flex flex-col items-center gap-4 text-center">
          <div class="flex size-12 items-center justify-center rounded-full bg-surface-less">
            <Icon icon={Card} size={6} class="text-content-muted" />
          </div>
          <p class="text-sm text-content-muted">
            Pay this invoice on Stripe's secure checkout. You'll be redirected and brought back here
            once it's done.
          </p>
          <Button
            class="button button-primary button-block"
            onclick={payWithCard}
            disabled={redirecting}>
            <Spinner loading={redirecting}>Pay {amountLabel} by card</Spinner>
          </Button>
        </div>
      {/if}
    {/if}
  </ModalBody>
  <ModalFooter>
    {#if paid}
      <div></div>
      <Button class="button button-primary" onclick={back}>Done</Button>
    {:else}
      <Button class="button button-link" onclick={back}>
        <Icon icon={AltArrowLeft} />
        Pay later
      </Button>
      {#if method === "lightning"}
        <Button
          class="button button-primary"
          onclick={checkPayment}
          disabled={checking || bolt11Status !== "ready"}>
          <Spinner loading={checking}>Check payment</Spinner>
        </Button>
      {/if}
    {/if}
  </ModalFooter>
</Modal>
