<script lang="ts">
  import {toggle} from "@welshman/lib"
  import SegmentedButton from "@lib/components/SegmentedButton.svelte"
  import {includedNoteFacets} from "@app/tools/feeds/network"
  import type {FacetCounts, NoteFacet} from "@app/tools/feeds/network"

  type Props = {
    counts: FacetCounts
  }

  const {counts}: Props = $props()

  const toggleFacet = (facet: NoteFacet) => () =>
    includedNoteFacets.update($facets => toggle(facet, $facets))
</script>

<div class="flex flex-wrap items-center gap-2">
  <SegmentedButton
    label="Notes"
    count={counts.get("notes") ?? 0}
    size="xs"
    pressed={$includedNoteFacets.includes("notes")}
    onclick={toggleFacet("notes")} />
  <SegmentedButton
    label="Replies"
    count={counts.get("replies") ?? 0}
    size="xs"
    pressed={$includedNoteFacets.includes("replies")}
    onclick={toggleFacet("replies")} />
  <SegmentedButton
    label="Interactions"
    count={counts.get("interactions") ?? 0}
    size="xs"
    pressed={$includedNoteFacets.includes("interactions")}
    onclick={toggleFacet("interactions")} />
</div>
