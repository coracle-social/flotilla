<script lang="ts">
  import cx from "classnames"
  import Server from "@assets/icons/server.svg?dataurl"
  import {ucFirst} from "@lib/util"
  import Badge from "@lib/components/Badge.svelte"
  import ImageIcon from "@lib/components/ImageIcon.svelte"
  import Link from "@lib/components/Link.svelte"
  import {canonicalRelayHost, getHostedRelayUrl, type HostedRelay} from "@app/hosting"
  import {makeSpacePath} from "@app/routes"

  type Props = {
    relay: HostedRelay
    compact?: boolean
    class?: string
  }

  const {relay, compact = false, class: className = "card p-3 sm:p-4"}: Props = $props()

  const name = $derived(relay.info_name || relay.subdomain)
  const host = $derived(canonicalRelayHost(relay))
  const href = $derived(makeSpacePath(getHostedRelayUrl(relay), "admin"))
</script>

<div
  class={cx(
    "flex gap-3",
    className,
    compact ? "items-center" : "flex-col sm:flex-row sm:items-center sm:gap-4",
  )}>
  <div class="flex min-w-0 flex-1 items-center gap-3">
    <ImageIcon size={8} alt="" class="rounded-xl" src={relay.info_icon || Server} />
    <div class="min-w-0">
      <p class="truncate text-sm font-medium">{name}</p>
      <p class="truncate text-xs opacity-75">{host}</p>
    </div>
  </div>
  <div class="flex flex-wrap items-center gap-2">
    {#if relay.sync_error}
      <Badge variant="warning" title={relay.sync_error}>Failed to sync</Badge>
    {:else}
      <Badge variant={relay.status === "active" ? "primary" : "neutral"}>
        {ucFirst(relay.status.replace(/_/g, " "))}
      </Badge>
    {/if}
    {#if !compact}
      <Badge variant={relay.plan_id === "free" ? "neutral" : "primary"}>
        {ucFirst(relay.plan_id)}
      </Badge>
      <Link class="button button-neutral button-sm ml-auto" {href}>Manage</Link>
    {/if}
  </div>
</div>
