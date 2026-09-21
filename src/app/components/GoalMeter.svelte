<script lang="ts">
  import cx from "classnames"
  import type {GoalProgress} from "@app/goals"

  type Props = {
    progress: GoalProgress
    class?: string
  }

  const {progress, ...props}: Props = $props()

  const width = $derived(Math.min(100, progress.percent))
</script>

<div class={cx("flex flex-col gap-2", props.class)}>
  <div class="flex flex-wrap items-baseline justify-between gap-x-2">
    <p class="flex flex-wrap items-baseline gap-x-1">
      <span class={cx("text-2xl font-bold", progress.isFunded ? "text-success" : "text-primary")}>
        {progress.raised.toLocaleString()}
      </span>
      <span class="text-sm text-content-muted">
        of {progress.target.toLocaleString()} sats
      </span>
    </p>
    <p class={cx("text-sm font-bold", progress.isFunded && "text-success")}>
      {progress.percent}%
    </p>
  </div>
  <div class="relative h-3 w-full overflow-hidden rounded-full bg-surface-more">
    <div
      class={cx(
        "h-full rounded-full transition-[width] duration-700 ease-out",
        progress.isFunded ? "bg-success" : "bg-gradient-to-r from-primary to-secondary",
      )}
      style:width="{width}%">
    </div>
    {#each [25, 50, 75] as tick (tick)}
      <div class="absolute inset-y-0 w-px bg-surface opacity-40" style:left="{tick}%"></div>
    {/each}
  </div>
</div>
