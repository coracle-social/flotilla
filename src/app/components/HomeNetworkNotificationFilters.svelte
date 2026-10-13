<script lang="ts">
  import {remove} from "@welshman/lib"
  import type {Maybe} from "@welshman/lib"
  import SegmentedButton from "@lib/components/SegmentedButton.svelte"
  import {ENABLE_ZAPS} from "@app/core/env"
  import {homeNotificationTypes, includedHomeNotificationTypes} from "@app/ui/notifications"
  import type {HomeNotificationType} from "@app/ui/notifications"

  type Props = {
    counts: Map<Maybe<HomeNotificationType>, number>
  }

  const {counts}: Props = $props()

  const options = homeNotificationTypes.filter(({value}) => ENABLE_ZAPS || value !== "zaps")

  const toggle = (type: HomeNotificationType) => () =>
    includedHomeNotificationTypes.update($types =>
      $types.includes(type) ? remove(type, $types) : [...$types, type],
    )
</script>

<div class="flex flex-wrap items-center gap-2">
  {#each options as option (option.value)}
    <SegmentedButton
      label={option.label}
      count={counts.get(option.value) ?? 0}
      size="xs"
      pressed={$includedHomeNotificationTypes.includes(option.value)}
      onclick={toggle(option.value)} />
  {/each}
</div>
