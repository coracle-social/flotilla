<script lang="ts">
  import cx from "classnames"
  import type {Snippet} from "svelte"
  import {page} from "$app/stores"
  import DangerTriangle from "@assets/icons/danger-triangle.svg?dataurl"
  import DangerCircle from "@assets/icons/danger-circle.svg?dataurl"
  import InfoCircle from "@assets/icons/info-circle.svg?dataurl"
  import Close from "@assets/icons/close.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import {errorMessage} from "@lib/util"
  import PaymentDialog from "@app/components/hosting/PaymentDialog.svelte"
  import PaymentSetup from "@app/components/hosting/PaymentSetup.svelte"
  import {pushModal} from "@app/modal"
  import {pushToast} from "@app/toast"
  import {autopayConfigured, getInvoice, type Invoice, type Tenant} from "@app/hosting"

  type Props = {
    tenant: Tenant | undefined
    openInvoice: Invoice | undefined
    hasPaidSubscription: boolean
    suppressInline?: boolean
    onRefresh?: () => void
  }

  const {
    tenant,
    openInvoice,
    hasPaidSubscription,
    suppressInline = false,
    onRefresh,
  }: Props = $props()

  let dismissedAutopay = $state(false)

  const openPayInvoice = (invoice: Invoice) =>
    pushModal(PaymentDialog, {invoice, onPaid: () => onRefresh?.()})

  const openSetup = (initialTab: "nwc" | "card") =>
    pushModal(PaymentSetup, {
      initialTab,
      nwcConnected: Boolean(tenant?.nwc_is_set),
      onSaved: () => onRefresh?.(),
    })

  const setUpNwc = () => openSetup("nwc")

  const updateMethod = () => openSetup(tenant?.nwc_error ? "nwc" : "card")

  const payOpenInvoice = () => {
    if (openInvoice) {
      openPayInvoice(openInvoice)
    }
  }

  const dismissAutopay = () => {
    dismissedAutopay = true
  }

  // Deep link (?invoice=<id>, e.g. from the billing DM) opens the pay dialog,
  // once per id.
  let handledInvoiceId: string | undefined
  $effect(() => {
    const id = $page.url.searchParams.get("invoice") ?? undefined
    if (!id || id === handledInvoiceId) {
      return
    }

    handledInvoiceId = id

    getInvoice(id)
      .then(openPayInvoice)
      .catch(e => pushToast({theme: "error", message: errorMessage(e) || "Failed to load invoice"}))
  })
</script>

{#snippet card(
  className: string,
  icon: string,
  message: string,
  actions: Snippet,
  dismiss?: () => void,
)}
  <div class={cx("card card-sm flex items-start gap-3", className)}>
    <Icon {icon} size={5} class="mt-0.5 shrink-0" />
    <div
      class="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <p class="min-w-0 text-sm">{message}</p>
      <div class="flex shrink-0 items-center gap-2">
        {@render actions()}
      </div>
    </div>
    {#if dismiss}
      <Button
        class="button button-link button-sm -mt-1 shrink-0"
        aria-label="Dismiss"
        onclick={dismiss}>
        <Icon icon={Close} size={4} />
      </Button>
    {/if}
  </div>
{/snippet}

{#snippet churnedActions()}
  {#if openInvoice}
    <Button class="button button-sm button-primary" onclick={payOpenInvoice}>Pay now</Button>
  {/if}
  <Button
    class={cx("button button-sm", {
      "button-neutral": openInvoice,
      "button-primary": !openInvoice,
    })}
    onclick={setUpNwc}>
    Update payment method
  </Button>
{/snippet}

{#snippet payInvoiceActions()}
  <Button class="button button-sm button-primary" onclick={payOpenInvoice}>Pay now</Button>
{/snippet}

{#snippet updateMethodActions()}
  <Button class="button button-sm button-primary" onclick={updateMethod}>
    Update payment method
  </Button>
{/snippet}

{#snippet autopayActions()}
  <Button class="button button-sm button-primary" onclick={setUpNwc}>Set up autopay</Button>
{/snippet}

{#if tenant}
  {#if tenant.churned_at}
    {@render card(
      "card-secondary",
      DangerTriangle,
      "Your account is past due and some relays are paused. Pay your balance or update your payment method to restore service.",
      churnedActions,
    )}
  {:else if openInvoice && !suppressInline}
    {@render card(
      "card-secondary",
      DangerCircle,
      "You have an unpaid invoice. Pay it now to keep your relays running.",
      payInvoiceActions,
    )}
  {:else if tenant.nwc_is_set && tenant.nwc_error}
    {@render card(
      "card-secondary",
      DangerCircle,
      "Your Lightning wallet couldn't be charged. Update your payment method.",
      updateMethodActions,
    )}
  {:else if tenant.stripe_payment_method_id && tenant.stripe_error}
    {@render card(
      "card-secondary",
      DangerCircle,
      "Your card couldn't be charged. Update your payment method.",
      updateMethodActions,
    )}
  {:else if hasPaidSubscription && !autopayConfigured(tenant) && !suppressInline && !dismissedAutopay}
    {@render card(
      "card-primary",
      InfoCircle,
      "Set up automatic payments so your subscription renews without interruption.",
      autopayActions,
      dismissAutopay,
    )}
  {/if}
{/if}
