<script lang="ts">
  import {getCurrencyOption} from "@lib/currency"

  export let code
</script>

{#if code.match(/^sats?$/i)}
  <span style="font-family: Satoshis; font-size: 1.2em;">!</span>
{:else}
  {getCurrencyOption(code).symbol}
{/if}
