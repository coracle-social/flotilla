<script lang="ts">
  import {remove} from "@welshman/lib"
  import type {Maybe} from "@welshman/lib"
  import SegmentedButton from "@lib/components/SegmentedButton.svelte"
  import {ENABLE_ZAPS} from "@app/core/env"
  import {includedHomeActivityTypes} from "@app/features/activity"
  import type {HomeActivityType} from "@app/features/activity"

  type Props = {
    counts: Map<Maybe<HomeActivityType>, number>
  }

  const {counts}: Props = $props()

  const toggle = (type: HomeActivityType) => () =>
    includedHomeActivityTypes.update($types =>
      $types.includes(type) ? remove(type, $types) : [...$types, type],
    )
</script>

{#snippet filter(type: HomeActivityType, label: string)}
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
