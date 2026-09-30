<script lang="ts">
  import * as nip19 from "nostr-tools/nip19"
  import type {PinReader} from "@welshman/domain"
  import ContentLinkInline from "@app/components/ContentLinkInline.svelte"
  import ContentQuote from "@app/components/ContentQuote.svelte"
  import {pinToReference} from "@app/pinboards"

  type Props = {
    url: string
    pin: PinReader
  }

  const {url, pin}: Props = $props()

  const reference = $derived(pin.reference())

  const quote = $derived.by(() => {
    if (reference?.type === "event" || reference?.type === "address") {
      const raw = pinToReference(pin)

      return {raw, value: nip19.decode(raw).data}
    }

    return undefined
  })
</script>

{#if reference?.type === "external"}
  <ContentLinkInline url={reference.id} event={pin.event} />
{:else if quote}
  <ContentQuote inline {url} value={quote.value} raw={quote.raw} event={pin.event} />
{/if}
