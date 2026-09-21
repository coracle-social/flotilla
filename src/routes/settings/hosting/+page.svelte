<script lang="ts">
  import {onMount} from "svelte"
  import {App} from "@capacitor/app"
  import type {Maybe} from "@welshman/lib"
  import {indexBy, sortBy, spec} from "@welshman/lib"
  import Add from "@assets/icons/add.svg?dataurl"
  import Server from "@assets/icons/server.svg?dataurl"
  import Bolt from "@assets/icons/bolt.svg?dataurl"
  import Card from "@assets/icons/card.svg?dataurl"
  import Wallet from "@assets/icons/wallet.svg?dataurl"
  import Bill from "@assets/icons/bill.svg?dataurl"
  import DangerCircle from "@assets/icons/danger-circle.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Badge from "@lib/components/Badge.svelte"
  import Button from "@lib/components/Button.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import PageContent from "@lib/components/PageContent.svelte"
  import {errorMessage} from "@lib/util"
  import RelayListItem from "@app/components/hosting/RelayListItem.svelte"
  import RelayCreate from "@app/components/hosting/RelayCreate.svelte"
  import BillingPrompts from "@app/components/hosting/BillingPrompts.svelte"
  import InvoiceListItem from "@app/components/hosting/InvoiceListItem.svelte"
  import PaymentDialog from "@app/components/hosting/PaymentDialog.svelte"
  import PaymentSetup from "@app/components/hosting/PaymentSetup.svelte"
  import {user} from "@app/core"
  import {pushModal} from "@app/modal"
  import {pushToast} from "@app/toast"
  import {
    autopayConfigured,
    ensureSessionTenant,
    getDraftInvoice,
    getTenant,
    listTenantInvoices,
    listTenantRelays,
    derivePlans,
    reconcileTenant,
    selectPayableInvoice,
    type HostedRelay,
    type Invoice,
    type Tenant,
  } from "@app/hosting"

  type PaymentMethodState = {kind: "not_set_up"} | {kind: "ok"} | {kind: "error"; message: string}

  const INVOICE_PAGE_SIZE = 10

  const plans = derivePlans()

  let tenant = $state<Maybe<Tenant>>()
  let invoices = $state<Invoice[]>([])
  let relays = $state<HostedRelay[]>([])
  let draftInvoice = $state<Maybe<Invoice>>()
  let loading = $state(true)
  let error = $state("")
  let showAllInvoices = $state(false)

  const openInvoice = $derived(selectPayableInvoice(invoices))

  // Whether any active relay is on a paid plan.
  const hasPaidSubscription = $derived.by(() => {
    const planById = indexBy(p => p.id, $plans)
    return relays.some(relay => {
      const plan = planById.get(relay.plan_id)
      return Boolean(plan && plan.amount > 0 && relay.status === "active")
    })
  })

  const status = $derived.by(() => {
    if (!tenant) {
      return "inactive"
    }
    if (tenant.churned_at) {
      return "delinquent"
    }
    if (hasPaidSubscription || openInvoice || autopayConfigured(tenant)) {
      return "active"
    }
    return "inactive"
  })

  const statusVariant = $derived(
    status === "active" ? "primary" : status === "delinquent" ? "warning" : "neutral",
  )

  const nwc = $derived.by<PaymentMethodState>(() => {
    if (!tenant?.nwc_is_set) {
      return {kind: "not_set_up"}
    }
    if (tenant.nwc_error) {
      return {kind: "error", message: tenant.nwc_error}
    }
    return {kind: "ok"}
  })

  const card = $derived.by<PaymentMethodState>(() => {
    if (!tenant?.stripe_payment_method_id) {
      return {kind: "not_set_up"}
    }
    // Don't surface Stripe's raw decline text to the tenant.
    if (tenant.stripe_error) {
      return {kind: "error", message: "Payment failed"}
    }
    return {kind: "ok"}
  })

  const visibleInvoices = $derived(
    showAllInvoices ? invoices : invoices.slice(0, INVOICE_PAGE_SIZE),
  )

  const refetch = async () => {
    const pk = user.get().pubkey
    if (!pk) {
      return
    }

    const results = await Promise.allSettled([
      getTenant(pk),
      listTenantInvoices(pk),
      listTenantRelays(pk),
      getDraftInvoice(pk),
    ])

    const [t, inv, rel, draft] = results

    if (t.status === "fulfilled") {
      tenant = t.value
    }
    if (inv.status === "fulfilled") {
      invoices = sortBy(invoice => -invoice.created_at, inv.value)
    }
    if (rel.status === "fulfilled") {
      relays = rel.value
    }
    if (draft.status === "fulfilled") {
      draftInvoice = draft.value
    }

    if (results.some(spec({status: "rejected"}))) {
      pushToast({theme: "error", message: "Failed to refresh billing data"})
    }
  }

  // Guard so the mount effect and the foreground listener don't race two reconciles.
  let reconciling = false

  // Pre-init failures render the error card instead of a toast over an empty page.
  let initialized = false

  // This page is the Stripe portal/checkout return target, so reconcile on landing
  // to settle a completed checkout and pick up a portal-added card. Charging open
  // invoices is left to the backend's dunning poll, which collects all of them.
  const reconcile = async () => {
    const pk = user.get().pubkey
    if (!pk || reconciling) {
      return
    }

    reconciling = true
    error = ""

    try {
      await ensureSessionTenant()
      await reconcileTenant(pk)
    } catch (e) {
      const message = errorMessage(e) || "Failed to update billing"

      if (initialized) {
        pushToast({theme: "error", message})
      } else {
        error = message
      }
    } finally {
      await refetch()
      reconciling = false
      initialized = true
    }
  }

  const openPayInvoice = (invoice: Invoice) =>
    pushModal(PaymentDialog, {invoice, onPaid: () => void refetch()})

  const openSetup = (initialTab: "nwc" | "card") =>
    pushModal(PaymentSetup, {
      initialTab,
      nwcConnected: Boolean(tenant?.nwc_is_set),
      onSaved: () => void refetch(),
    })

  const openNwcSetup = () => openSetup("nwc")

  const openCardSetup = () => openSetup("card")

  const openCreateRelay = () => pushModal(RelayCreate)

  const refresh = () => void refetch()

  const toggleAllInvoices = () => {
    showAllInvoices = !showAllInvoices
  }

  onMount(() => {
    reconcile().finally(() => (loading = false))

    // Re-run on foreground return (native browser round-trip) to pick up a
    // completed checkout or a portal-added card.
    const resumeListener = App.addListener("appStateChange", ({isActive}) => {
      if (isActive) {
        void reconcile()
      }
    })

    return () => {
      resumeListener.then(listener => listener.remove())
    }
  })
</script>

{#snippet methodRow(title: string, icon: string, state: PaymentMethodState, onAction: () => void)}
  <li class="card card-sm flex items-center justify-between gap-3">
    <div class="flex min-w-0 items-center gap-3">
      <Icon {icon} size={5} class="text-content-muted" />
      <div class="min-w-0">
        <p class="font-medium">{title}</p>
        {#if state.kind === "ok"}
          <p class="text-xs text-success">Connected</p>
        {:else if state.kind === "error"}
          <p class="text-xs text-error">{state.message}</p>
        {:else}
          <p class="text-xs text-content-muted">Not set up</p>
        {/if}
      </div>
    </div>
    <Button class="button button-neutral button-sm shrink-0" onclick={onAction}>
      {state.kind === "not_set_up" ? "Set up" : "Update"}
    </Button>
  </li>
{/snippet}

<PageContent class="flex flex-col gap-4 p-4">
  <div class="flex items-center justify-between gap-3">
    <strong class="flex items-center gap-3 text-lg">
      <Icon icon={Server} />
      Your Spaces
    </strong>
    <Button class="button button-primary button-sm" onclick={openCreateRelay}>
      <Icon icon={Add} size={4} />
      Create a Space
    </Button>
  </div>
  {#if loading}
    <div class="flex justify-center py-20">
      <Spinner {loading}>Loading your spaces…</Spinner>
    </div>
  {:else if error}
    <div class="card flex items-center gap-3 text-error">
      <Icon icon={DangerCircle} />
      {error}
    </div>
  {:else}
    {#if tenant}
      <BillingPrompts {tenant} {openInvoice} {hasPaidSubscription} onRefresh={refresh} />
    {/if}

    {#if relays.length === 0}
      <div class="card flex flex-col items-center gap-1 py-12 text-center">
        <p class="text-content opacity-75">You don't host any spaces yet.</p>
        <p class="text-sm text-content-muted">Create a space to get started.</p>
      </div>
    {:else}
      <div class="flex flex-col gap-3">
        {#each relays as relay (relay.id)}
          <RelayListItem {relay} />
        {/each}
      </div>
    {/if}

    <div class="card flex flex-col gap-6">
      <div class="flex items-center justify-between gap-3">
        <strong class="flex items-center gap-3 text-lg">
          <Icon icon={Wallet} />
          Payment Methods
        </strong>
        {#if tenant}
          <Badge variant={statusVariant} class="badge-sm capitalize">
            {status}
          </Badge>
        {/if}
      </div>
      <ul class="flex flex-col gap-3">
        {@render methodRow("Lightning (NWC)", Bolt, nwc, openNwcSetup)}
        {@render methodRow("Card", Card, card, openCardSetup)}
      </ul>
    </div>

    <div class="card flex flex-col gap-6">
      <strong class="flex items-center gap-3 text-lg">
        <Icon icon={Bill} />
        Payment History
      </strong>
      {#if invoices.length === 0 && !draftInvoice}
        <p class="py-4 text-center text-sm text-content-muted">No invoices yet.</p>
      {:else}
        <ul class="flex flex-col gap-3">
          {#if draftInvoice}
            <InvoiceListItem invoice={draftInvoice} isDraft />
          {/if}
          {#each visibleInvoices as invoice (invoice.id)}
            <InvoiceListItem {invoice} onPay={() => openPayInvoice(invoice)} />
          {/each}
          {#if invoices.length > INVOICE_PAGE_SIZE}
            <li>
              <Button
                class="button button-link button-sm px-0 font-medium"
                onclick={toggleAllInvoices}>
                {showAllInvoices ? "Show less" : `Show all (${invoices.length})`}
              </Button>
            </li>
          {/if}
        </ul>
      {/if}
    </div>
  {/if}
</PageContent>
