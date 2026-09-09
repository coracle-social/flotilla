<script lang="ts" generics="T">
  import type {Snippet} from "svelte"

  type Props = {
    items: T[]
    child: Snippet<[T]>
    getKey: (item: T) => PropertyKey
    // Minimum column width, in tailwind spacing units (1 = 0.25rem). The browser
    // fits as many columns as the container allows, so the layout stays
    // responsive without media queries.
    columnWidth?: number
    // Space between columns and between stacked items, in tailwind units.
    gap?: number
  }

  const {items, child, getKey, columnWidth = 72, gap = 3}: Props = $props()

  const rem = (units: number) => `${units * 0.25}rem`
</script>

<div style="column-width: {rem(columnWidth)}; column-gap: {rem(gap)};">
  {#each items as item (getKey(item))}
    <div class="break-inside-avoid" style="margin-bottom: {rem(gap)};">
      {@render child(item)}
    </div>
  {/each}
</div>
