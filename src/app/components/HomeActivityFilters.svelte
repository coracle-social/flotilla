<script lang="ts">
  import {toggle} from "@welshman/lib"
  import SegmentedButton from "@lib/components/SegmentedButton.svelte"
  import {ENABLE_ZAPS} from "@app/core/env"
  import {includedNotificationFacets} from "@app/features/notifications"
  import type {NotificationFacet} from "@app/features/notifications"

  type Props = {
    counts: Map<NotificationFacet, number>
  }

  const {counts}: Props = $props()

  const toggleFacet = (facet: NotificationFacet) => () =>
    includedNotificationFacets.update($facets => toggle(facet, $facets))
</script>

{#snippet filter(type: NotificationFacet, label: string)}
  <SegmentedButton
    {label}
    count={counts.get(type) ?? 0}
    size="xs"
    pressed={$includedNotificationFacets.includes(type)}
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
