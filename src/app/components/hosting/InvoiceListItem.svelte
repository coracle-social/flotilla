<script lang="ts">
  import cx from "classnames"
  import Badge from "@lib/components/Badge.svelte"
  import Button from "@lib/components/Button.svelte"
  import {formatUsd, formatPeriod, type Invoice} from "@app/hosting"

  type Props = {
    invoice: Invoice
    isDraft?: boolean
    onPay?: () => void
  }

  const {invoice, isDraft = false, onPay}: Props = $props()

  // The backend models the invoice lifecycle as timestamps, not a status field.
  const status = $derived.by(() => {
    if (isDraft) {
      return "draft"
    }
    if (invoice.paid_at) {
      return "paid"
    }
    if (invoice.voided_at) {
      return "void"
    }
    return "open"
  })
  const isOpen = $derived(status === "open")
  const variant = $derived(
    status === "open" ? "warning" : status === "paid" ? "primary" : "neutral",
  )
  const periodLabel = $derived(formatPeriod(invoice.period_start, invoice.period_end))
</script>

<li class={cx("card card-sm flex items-center justify-between gap-3", {"border-dashed": isDraft})}>
  <div class="min-w-0">
    <div class="flex items-center gap-2">
      <span class="font-medium">{formatUsd(invoice.amount)}</span>
      <Badge {variant} class="badge-sm capitalize">{status}</Badge>
      {#if invoice.method}
        <span class="text-xs text-content-muted"
          >· paid via {invoice.method === "stripe" ? "Card" : "Lightning"}</span>
      {/if}
    </div>
    {#if periodLabel}
      <p class="mt-0.5 text-xs text-content-muted">{periodLabel}</p>
    {/if}
    {#if isDraft}
      <p class="mt-1 text-xs text-content-subtle">
        Charges accruing this period. You'll be invoiced once a balance is due.
      </p>
    {/if}
  </div>
  {#if isOpen && onPay}
    <div class="flex shrink-0 items-center gap-2">
      <Button class="button button-primary button-sm" onclick={onPay}>Pay now</Button>
    </div>
  {/if}
</li>
