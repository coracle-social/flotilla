<script lang="ts" generics="T">
  import type {Snippet} from "svelte"

  type Props = {
    items: T[]
    child: Snippet<[T]>
    getKey: (item: T) => PropertyKey
    columnWidth?: number
    maxColumns?: number
    gap?: number
  }

  // columnWidth and gap are tailwind spacing units, not pixels.
  const {items, child, getKey, columnWidth = 72, maxColumns = Infinity, gap = 3}: Props = $props()

  const rootFontSize = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16

  const rem = (units: number) => `${units * 0.25}rem`

  let width = $state(0)

  const count = $derived(
    Math.min(maxColumns, Math.max(1, Math.floor(width / (columnWidth * 0.25 * rootFontSize)))),
  )

  // Which column an item lands in depends only on its index, so appending to `items` leaves
  // everything already on screen where it was. CSS multi-column balances the columns instead,
  // which reshuffles the whole list every time an infinite scroll loads another page.
  const columns = $derived(
    Array.from({length: count}, (_, column) =>
      items.filter((_, index) => index % count === column),
    ),
  )
</script>

<div class="flex items-start" style="gap: {rem(gap)};" bind:clientWidth={width}>
  {#each columns as column, index (index)}
    <div class="flex min-w-0 flex-1 flex-col" style="gap: {rem(gap)};">
      {#each column as item (getKey(item))}
        {@render child(item)}
      {/each}
    </div>
  {/each}
</div>
