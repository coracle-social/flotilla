<script lang="ts">
  import Spinner from "@lib/components/Spinner.svelte"
  import QRCode from "@app/components/QRCode.svelte"
  import type {Nip46Controller} from "@app/nip46"

  type Props = {
    controller: Nip46Controller
  }

  const {controller}: Props = $props()
  const {url, loading} = controller
</script>

{#if $url}
  {#if $loading}
    <div class="flex justify-center">
      <Spinner loading>Establishing connection...</Spinner>
    </div>
  {:else}
    <div class="flex flex-col items-center gap-2">
      <QRCode code={$url} />
      <p class="text-sm opacity-75">Scan with your signer to log in, or click to copy.</p>
    </div>
  {/if}
{/if}
