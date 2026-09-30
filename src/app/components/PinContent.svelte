<script lang="ts">
  import {removeUndefined} from "@welshman/lib"
  import type {PinReader} from "@welshman/domain"
  import Content from "@app/components/Content.svelte"
  import PinContentEvent from "@app/components/PinContentEvent.svelte"
  import {pinToReference} from "@app/pinboards"

  type Props = {
    url: string
    pin: PinReader
    class?: string
  }

  const {url, pin, ...props}: Props = $props()

  const reference = $derived(pin.reference())
</script>

<div class="{props.class} flex flex-col gap-2">
  {#if pin.content()}
    <Content event={{content: pin.content(), tags: []}} {url} />
  {/if}
  {#if reference?.type === "event" || reference?.type === "address"}
    <PinContentEvent
      {url}
      value={reference.type === "event" ? reference.id : reference.address}
      relays={removeUndefined([reference.relay, url])} />
  {:else}
    <Content event={{content: pinToReference(pin), tags: []}} {url} />
  {/if}
</div>
