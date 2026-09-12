<script lang="ts">
  import type {ComponentProps} from "svelte"
  import {removeUndefined} from "@welshman/lib"
  import {fromMsats} from "@welshman/util"
  import {ZapGoal} from "@welshman/domain"
  import {ZapGoals} from "@welshman/app"
  import Bolt from "@assets/icons/bolt.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import ContentMinimal from "@app/components/ContentMinimal.svelte"
  import {app, reader} from "@app/core"

  const props: ComponentProps<typeof ContentMinimal> = $props()

  const goal = reader(ZapGoal)(props.event)

  const title = goal.title()
  const summaryEvent = $derived({content: goal.summary(), tags: props.event.tags})

  const progress = $app.use(ZapGoals).progress(props.event, removeUndefined([props.url])).$
</script>

<div class="flex justify-between">
  <span class="text-sm">{title}</span>
  <div class="flex items-center gap-1">
    <Icon icon={Bolt} size={4} />
    {fromMsats($progress.amount)}/{fromMsats($progress.target)} sats funded
  </div>
</div>
<ContentMinimal {...props} event={summaryEvent} />
