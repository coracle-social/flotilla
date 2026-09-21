<script lang="ts">
  import cx from "classnames"
  import type {Readable} from "svelte/store"
  import type {TrustedEvent} from "@welshman/util"
  import Bolt from "@assets/icons/bolt.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import ProfileCircles from "@app/components/ProfileCircles.svelte"
  import ZapButton from "@app/components/ZapButton.svelte"
  import GoalMeter from "@app/components/GoalMeter.svelte"
  import GoalStatus from "@app/components/GoalStatus.svelte"
  import {ENABLE_ZAPS} from "@app/env"
  import {deriveGoalProgress} from "@app/goals"
  import type {GoalProgress} from "@app/goals"

  type Props = {
    url?: string
    event: TrustedEvent
    progress?: Readable<GoalProgress>
    class?: string
  }

  const {url, event, progress: providedProgress, ...props}: Props = $props()

  // The list page already has a store per goal; reuse it instead of resubscribing.
  const progress = providedProgress ?? deriveGoalProgress(event, url)

  const backers = $derived($progress.backers.length)
</script>

<div class={cx("flex flex-col gap-3", props.class)}>
  <GoalMeter progress={$progress} />
  <div class="flex flex-wrap items-center justify-between gap-2">
    <div class="flex min-w-0 items-center gap-2">
      {#if backers > 0}
        <ProfileCircles pubkeys={$progress.backers} size={6} limit={5} />
      {/if}
      <span class="truncate text-sm text-content-muted">
        {#if backers === 0}
          No contributions yet
        {:else}
          {backers}
          {backers === 1 ? "backer" : "backers"}
        {/if}
      </span>
    </div>
    <GoalStatus progress={$progress} />
  </div>
  {#if ENABLE_ZAPS && !$progress.isEnded}
    <ZapButton {url} {event} class="button button-primary button-block">
      <Icon icon={Bolt} />
      {$progress.isFunded ? "Chip in anyway" : "Contribute"}
    </ZapButton>
  {/if}
</div>
