<script lang="ts">
  import {remove} from "@welshman/lib"
  import SegmentedButton from "@lib/components/SegmentedButton.svelte"
  import {includedNetworkFeedTypes, networkFeedTypes} from "@app/social"
  import type {NetworkFeedType} from "@app/social"

  const toggle = (type: NetworkFeedType) => () =>
    includedNetworkFeedTypes.update($types =>
      $types.includes(type) ? remove(type, $types) : [...$types, type],
    )
</script>

<div class="flex flex-wrap items-center gap-2">
  {#each networkFeedTypes as option (option.value)}
    <SegmentedButton
      label={option.label}
      size="xs"
      pressed={$includedNetworkFeedTypes.includes(option.value)}
      onclick={toggle(option.value)} />
  {/each}
</div>
