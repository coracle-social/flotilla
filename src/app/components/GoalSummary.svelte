<script lang="ts">
  import {now, DAY, removeUndefined} from "@welshman/lib"
  import type {TrustedEvent} from "@welshman/util"
  import {fromMsats} from "@welshman/util"
  import {ZapGoals} from "@welshman/app"
  import Bolt from "@assets/icons/bolt.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import ZapButton from "@app/components/ZapButton.svelte"
  import {app} from "@app/core"

  type Props = {
    url?: string
    event: TrustedEvent
    class?: string
  }

  const {url, event, ...props}: Props = $props()

  const progress = $app.use(ZapGoals).progress(event, removeUndefined([url])).$

  const daysOld = Math.ceil((now() - event.created_at) / DAY)
</script>

<div class="flex flex-col gap-8 {props.class}">
  <div class="flex gap-8">
    <div>
      <p class="text-xl text-primary">{fromMsats($progress.amount)} sats</p>
      <p class="text-sm opacity-75">funded of {fromMsats($progress.target)} sats</p>
    </div>
    <div>
      <p class="text-xl">{$progress.contributors.length}</p>
      <p class="text-sm opacity-75">
        {$progress.contributors.length === 1 ? "contributor" : "contributors"}
      </p>
    </div>
    <div>
      <p class="text-xl">{daysOld}</p>
      <p class="text-sm opacity-75">{daysOld === 1 ? "day" : "days"} old</p>
    </div>
  </div>
  <progress class="progress" value={$progress.amount} max={$progress.target}></progress>
  <ZapButton {url} {event} class="button button-primary lg:m-auto lg:px-20">
    <Icon icon={Bolt} />
    Contribute to this goal
  </ZapButton>
</div>
