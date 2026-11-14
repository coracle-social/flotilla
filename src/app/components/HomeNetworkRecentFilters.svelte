<script lang="ts">
  import {toggle} from "@welshman/lib"
  import SegmentedButton from "@lib/components/SegmentedButton.svelte"
  import {includedNoteFacets} from "@app/features/social"
  import type {FacetCounts} from "@app/features/social"

  type Props = {
    counts: FacetCounts
  }

  const {counts}: Props = $props()

  const toggleNotes = () => includedNoteFacets.update($facets => toggle("notes", $facets))

  const toggleReplies = () => includedNoteFacets.update($facets => toggle("replies", $facets))

  const toggleInteractions = () =>
    includedNoteFacets.update($facets => toggle("interactions", $facets))
</script>

<div class="flex flex-wrap items-center gap-2">
  <SegmentedButton
    label="Notes"
    count={counts.get("notes") ?? 0}
    size="xs"
    pressed={$includedNoteFacets.includes("notes")}
    onclick={toggleNotes} />
  <SegmentedButton
    label="Replies"
    count={counts.get("replies") ?? 0}
    size="xs"
    pressed={$includedNoteFacets.includes("replies")}
    onclick={toggleReplies} />
  <SegmentedButton
    label="Interactions"
    count={counts.get("interactions") ?? 0}
    size="xs"
    pressed={$includedNoteFacets.includes("interactions")}
    onclick={toggleInteractions} />
</div>
