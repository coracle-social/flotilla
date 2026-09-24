<script lang="ts">
  import * as nip19 from "nostr-tools/nip19"
  import {removeUndefined} from "@welshman/lib"
  import {Address} from "@welshman/util"
  import type {PinReader} from "@welshman/domain"
  import Badge from "@lib/components/Badge.svelte"
  import MenuButton from "@lib/components/MenuButton.svelte"
  import Content from "@app/components/Content.svelte"
  import PinContentEvent from "@app/components/PinContentEvent.svelte"
  import PinMenu from "@app/components/PinMenu.svelte"
  import {pinToReference} from "@app/pinboards"

  type Props = {
    url: string
    pin: PinReader
    minimal?: boolean
    class?: string
  }

  const {url, pin, minimal, ...props}: Props = $props()

  // Encoded as nostr: entities (i tags are already urls) so Content parses them into embeds.
  const reference = $derived(pin.reference())

  const content = $derived.by(() => {
    if (reference?.type === "event") {
      return "nostr:" + nip19.neventEncode({id: reference.id, relays: [url]})
    }

    if (reference?.type === "address") {
      const {kind, pubkey, identifier} = Address.from(reference.address)

      return "nostr:" + nip19.naddrEncode({kind, pubkey, identifier, relays: [url]})
    }

    return pinToReference(pin)
  })
</script>

<div class="{props.class} flex h-full flex-col gap-2 {minimal ? '' : 'card relative'}">
  {#if !minimal}
    <div class="absolute right-2 top-2 z-feature">
      <MenuButton
        class="button button-neutral button-sm button-square"
        aria-label="More options"
        iconSize={4}
        component={PinMenu}
        componentProps={{url, pin}} />
    </div>
  {/if}
  {#if pin.title()}
    <strong class="truncate min-w-0 pr-8">{pin.title()}</strong>
  {/if}
  {#if pin.content()}
    <Content event={{content: pin.content(), tags: []}} {url} />
  {/if}
  {#if reference?.type === "event" || reference?.type === "address"}
    <PinContentEvent
      {url}
      value={reference.type === "event" ? reference.id : reference.address}
      relays={removeUndefined([reference.relay, url])} />
  {:else}
    <Content event={{content, tags: []}} {url} />
  {/if}
  {#if !minimal && pin.topics().length > 0}
    <div class="mt-auto flex flex-wrap gap-1">
      {#each pin.topics() as topic (topic)}
        <Badge>#{topic}</Badge>
      {/each}
    </div>
  {/if}
</div>
