<script lang="ts">
  import {now, removeUndefined} from "@welshman/lib"
  import {getExpiration} from "@welshman/domain"
  import Pulse from "@assets/icons/pulse.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Link from "@lib/components/Link.svelte"
  import {statuses} from "@app/statuses"

  type Props = {
    pubkey: string
    url?: string
  }

  const {pubkey, url}: Props = $props()

  const status = $statuses.one(pubkey, removeUndefined([url]))

  // NIP-38 reports nothing with empty content, and an expiration asks relays to stop serving it.
  const expiration = $derived($status ? getExpiration($status) : undefined)
  const text = $derived(expiration && expiration <= now() ? "" : $status?.content)
  const link = $derived($status?.tags.find(t => t[0] === "r")?.[1])
</script>

{#if text}
  <div class="text-content-muted flex items-center gap-2 text-sm">
    <Icon icon={Pulse} size={4} class="shrink-0" />
    {#if link}
      <Link external href={link} class="link line-clamp-2 wrap-break-word">{text}</Link>
    {:else}
      <span class="line-clamp-2 wrap-break-word">{text}</span>
    {/if}
  </div>
{/if}
