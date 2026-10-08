<script lang="ts">
  import {fromApp} from "@app/core"
  import {Relays} from "@welshman/app"
  import {displayRelayFee, getRelayFee} from "@app/payments"

  type Props = {
    url: string
    class?: string
  }

  const {url, class: className = ""}: Props = $props()

  const relay = fromApp($app => $app.use(Relays).one(url))

  const fee = $derived(getRelayFee($relay))
</script>

{#if fee}
  <span class={className}>{displayRelayFee(fee)}</span>
{/if}
