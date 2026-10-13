<script lang="ts">
  import type {ComponentProps} from "svelte"
  import {Pin} from "@welshman/domain"
  import Content from "@app/components/Content.svelte"
  import PinContentEvent from "@app/components/PinContentEvent.svelte"
  import {reader} from "@app/core/domain"
  import {pinToReference} from "@app/features/pinboards"

  const props: ComponentProps<typeof Content> = $props()

  const loadPin = $derived(reader(Pin)(props.event))
</script>

{#await loadPin then pin}
  {@const reference = pin.reference()}
  <div class="flex h-full flex-col gap-2">
    {#if pin.title()}
      <strong class="truncate min-w-0">{pin.title()}</strong>
    {/if}
    {#if pin.content()}
      <Content event={{content: pin.content(), tags: []}} />
    {/if}
    {#if reference?.type === "event"}
      <PinContentEvent value={reference.id} relays={reference.relay ? [reference.relay] : []} />
    {:else if reference?.type === "address"}
      <PinContentEvent
        value={reference.address}
        relays={reference.relay ? [reference.relay] : []} />
    {:else}
      <!-- External references are urls or bech32 entities, both of which Content parses. -->
      <Content event={{content: pinToReference(pin), tags: []}} />
    {/if}
    {#if pin.topics().length > 0}
      <div class="mt-auto flex flex-wrap gap-1">
        {#each pin.topics() as topic (topic)}
          <span class="badge badge-neutral">#{topic}</span>
        {/each}
      </div>
    {/if}
  </div>
{/await}
