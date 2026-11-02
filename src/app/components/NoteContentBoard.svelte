<script lang="ts">
  import type {ComponentProps} from "svelte"
  import {Pinboard} from "@welshman/domain"
  import Content from "@app/components/Content.svelte"
  import {reader} from "@app/core/domain"

  const props: ComponentProps<typeof Content> = $props()

  const board = $derived(reader(Pinboard)(props.event))
</script>

<div class="flex flex-col">
  <strong class="text-lg">{board?.title() || "Untitled shelf"}</strong>
  {#if board?.description()}
    <span class="text-sm opacity-70">{board.description()}</span>
  {/if}
</div>
