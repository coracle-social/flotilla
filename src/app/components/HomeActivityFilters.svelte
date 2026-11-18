<script lang="ts">
  import {toggle} from "@welshman/lib"
  import SegmentedButton from "@lib/components/SegmentedButton.svelte"
  import {ENABLE_ZAPS} from "@app/core/env"
  import {activityCounts, includedActivityFacets} from "@app/areas/home/activity/stream"
  import type {ActivityFacet} from "@app/areas/home/activity/model"

  const toggleFacet = (facet: ActivityFacet) => () =>
    includedActivityFacets.update($facets => toggle(facet, $facets))
</script>

{#snippet filter(type: ActivityFacet, label: string)}
  <SegmentedButton
    {label}
    count={$activityCounts.get(type) ?? 0}
    size="xs"
    pressed={$includedActivityFacets.includes(type)}
    onclick={toggleFacet(type)} />
{/snippet}

<div class="flex flex-wrap items-center gap-2">
  {@render filter("spaces", "Spaces")}
  {@render filter("replies", "Replies")}
  {@render filter("reactions", "Reactions")}
  {#if ENABLE_ZAPS}
    {@render filter("zaps", "Zaps")}
  {/if}
</div>
