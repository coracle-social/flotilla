<script lang="ts">
  import {removeUndefined} from "@welshman/lib"
  import {EventRef} from "@welshman/util"
  import type {PinReader} from "@welshman/domain"
  import Content from "@app/components/Content.svelte"
  import ContentEvent from "@app/components/ContentEvent.svelte"
  import {pinToReference} from "@app/features/spaces/pinboards"

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
  {#if reference instanceof EventRef}
    <ContentEvent
      {url}
      value={reference.getAddressOrId() ?? ""}
      relays={removeUndefined([...reference.relays, url])} />
  {:else}
    <Content event={{content: pinToReference(pin), tags: []}} {url} />
  {/if}
</div>
