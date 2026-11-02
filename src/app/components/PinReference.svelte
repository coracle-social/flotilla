<script lang="ts">
  import {EventRef} from "@welshman/util"
  import type {PinReader} from "@welshman/domain"
  import ContentLinkInline from "@app/components/ContentLinkInline.svelte"
  import ContentQuote from "@app/components/ContentQuote.svelte"

  type Props = {
    url: string
    pin: PinReader
  }

  const {url, pin}: Props = $props()

  const reference = $derived(pin.reference())
</script>

{#if reference instanceof EventRef}
  <ContentQuote inline {url} ref={reference} raw={reference.toNip19() ?? ""} event={pin.event} />
{:else if reference}
  <ContentLinkInline url={reference.external} event={pin.event} />
{/if}
