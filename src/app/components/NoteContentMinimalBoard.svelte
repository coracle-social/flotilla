<script lang="ts">
  import type {ComponentProps} from "svelte"
  import {Pinboard} from "@welshman/domain"
  import ContentMinimal from "@app/components/ContentMinimal.svelte"
  import {reader} from "@app/core/domain"

  const props: ComponentProps<typeof ContentMinimal> = $props()

  const board = $derived(reader(Pinboard)(props.event))
</script>

<span class="text-sm">{board?.title() || "Untitled shelf"}</span>
{#if board?.description()}
  <span class="truncate min-w-0 block opacity-70">{board.description()}</span>
{/if}
