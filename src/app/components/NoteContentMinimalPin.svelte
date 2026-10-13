<script lang="ts">
  import type {ComponentProps} from "svelte"
  import {Pin} from "@welshman/domain"
  import ContentMinimal from "@app/components/ContentMinimal.svelte"
  import {reader} from "@app/core/domain"

  const props: ComponentProps<typeof ContentMinimal> = $props()

  const loadPin = $derived(reader(Pin)(props.event))
</script>

{#await loadPin then pin}
  <span class="text-sm">{pin.title() || "Untitled pin"}</span>
  {#if pin.content()}
    <span class="truncate min-w-0 block opacity-70">{pin.content()}</span>
  {/if}
{/await}
