<script lang="ts">
  import {remove} from "@welshman/lib"
  import SegmentedButton from "@lib/components/SegmentedButton.svelte"
  import {includedNetworkFeedTypes, networkFeedTypes} from "@app/features/social/networkFeed"
  import type {NetworkFeedType} from "@app/features/social/networkFeed"

  type Props = {
    counts: Map<NetworkFeedType, number>
    popular: boolean
    onpopular: () => void
  }

  const {counts, popular, onpopular}: Props = $props()

  const toggle = (type: NetworkFeedType) => () =>
    includedNetworkFeedTypes.update($types =>
      $types.includes(type) ? remove(type, $types) : [...$types, type],
    )
</script>

<div class="flex flex-wrap items-center gap-2">
  {#each networkFeedTypes as option (option.value)}
    <SegmentedButton
      label={option.label}
      count={counts.get(option.value) ?? 0}
      size="xs"
      pressed={$includedNetworkFeedTypes.includes(option.value)}
      onclick={toggle(option.value)} />
  {/each}
  <!-- What the people she follows answered joins what they wrote, rather than living on a tab of its own. -->
  <div class="ml-auto flex items-center">
    <SegmentedButton label="Popular" size="xs" pressed={popular} onclick={onpopular} />
  </div>
</div>
