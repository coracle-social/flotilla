<script lang="ts">
  import {formatUsd, type InvoiceItem} from "@app/features/hosting"

  type Props = {
    items: InvoiceItem[]
  }

  const {items}: Props = $props()
</script>

<div class="card card-sm">
  <p class="mb-2 text-xs font-medium uppercase tracking-wide text-content-muted">On this invoice</p>
  <ul class="flex flex-col gap-1.5">
    {#each items as item (item.id)}
      <li class="flex items-center justify-between gap-3 text-sm">
        <span class="truncate">{item.description}</span>
        <span class="shrink-0 text-xs text-content-muted">{formatUsd(item.amount)}</span>
      </li>
    {/each}
  </ul>
</div>
