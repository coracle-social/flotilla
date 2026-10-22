<script lang="ts">
  import {displayRelayUrl} from "@welshman/util"
  import RelayName from "@app/components/RelayName.svelte"
  import {HIDE_NOSTR} from "@app/core/env"

  type Props = {
    url: string
    class?: string
  }

  const {url, ...props}: Props = $props()
</script>

{#if HIDE_NOSTR}
  <RelayName {url} class={props.class} />
{:else}
  <span class={props.class}>{displayRelayUrl(url)}</span>
{/if}
