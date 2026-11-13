<script lang="ts">
  import {remove} from "@welshman/lib"
  import SegmentedButton from "@lib/components/SegmentedButton.svelte"
  import {includedNoteFacets, noteFacets} from "@app/features/social"
  import type {FeedCounts, NoteFacet} from "@app/features/social"

  type Props = {
    counts: FeedCounts
  }

  const {counts}: Props = $props()

  const toggle = (facet: NoteFacet) => () =>
    includedNoteFacets.update($facets =>
      $facets.includes(facet) ? remove(facet, $facets) : [...$facets, facet],
    )
</script>

<div class="flex flex-wrap items-center gap-2">
  {#each noteFacets as option (option.value)}
    <SegmentedButton
      label={option.label}
      count={counts.get(option.value) ?? 0}
      size="xs"
      pressed={$includedNoteFacets.includes(option.value)}
      onclick={toggle(option.value)} />
  {/each}
</div>
