<script lang="ts">
  import * as nip19 from "nostr-tools/nip19"
  import type {PinReader} from "@welshman/domain"
  import ContentLinkInline from "@app/components/ContentLinkInline.svelte"
  import ContentQuote from "@app/components/ContentQuote.svelte"
  import {pinToReference} from "@app/features/pinboards"

  type Props = {
    url: string
    pin: PinReader
  }

  const {url, pin}: Props = $props()

  const reference = $derived(pin.reference())

  const quote = $derived.by(() => {
    const raw = pinToReference(pin)

    if (raw && reference?.type !== "external") {
      const decoded = nip19.decode(raw)

      if (decoded.type === "nevent" || decoded.type === "naddr") {
        return {raw, value: decoded.data}
      }
    }

    return undefined
  })
</script>

{#if reference?.type === "external"}
  <ContentLinkInline url={reference.id} event={pin.event} />
{:else if quote}
  <ContentQuote inline {url} value={quote.value} raw={quote.raw} event={pin.event} />
{/if}
