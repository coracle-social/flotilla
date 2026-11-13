<script lang="ts">
  import {remove} from "@welshman/lib"
  import SegmentedButton from "@lib/components/SegmentedButton.svelte"
  import {ENABLE_ZAPS} from "@app/core/env"
  import {includedHomeActivityTypes} from "@app/features/notifications"
  import type {NotificationFacet} from "@app/features/notifications"

  type Props = {
    counts: Map<NotificationFacet, number>
  }

  const {counts}: Props = $props()

  const toggle = (type: NotificationFacet) => () =>
    includedHomeActivityTypes.update($types =>
      $types.includes(type) ? remove(type, $types) : [...$types, type],
    )
</script>

{#snippet filter(type: NotificationFacet, label: string)}
  <SegmentedButton
    {label}
    count={counts.get(type) ?? 0}
    size="xs"
    pressed={$includedHomeActivityTypes.includes(type)}
    onclick={toggle(type)} />
{/snippet}

<div class="flex flex-wrap items-center gap-2">
  {@render filter("spaces", "Spaces")}
  {@render filter("replies", "Replies")}
  {@render filter("reactions", "Reactions")}
  {#if ENABLE_ZAPS}
    {@render filter("zaps", "Zaps")}
  {/if}
</div>
