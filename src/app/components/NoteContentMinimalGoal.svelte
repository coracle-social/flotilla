<script lang="ts">
  import type {ComponentProps} from "svelte"
  import {ZapGoal} from "@welshman/domain"
  import Bolt from "@assets/icons/bolt.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import ContentMinimal from "@app/components/ContentMinimal.svelte"
  import {reader} from "@app/core"
  import {deriveGoalProgress} from "@app/goals"

  const props: ComponentProps<typeof ContentMinimal> = $props()

  const goal = reader(ZapGoal)(props.event)

  const title = goal.title()
  const summaryEvent = $derived({content: goal.summary(), tags: props.event.tags})

  const progress = deriveGoalProgress(props.event, props.url)
</script>

<div class="flex justify-between">
  <span class="text-sm">{title}</span>
  <div class="flex items-center gap-1">
    <Icon icon={Bolt} size={4} />
    {$progress.raised.toLocaleString()}/{$progress.target.toLocaleString()} sats funded
  </div>
</div>
<ContentMinimal {...props} event={summaryEvent} />
