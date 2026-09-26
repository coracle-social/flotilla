<script lang="ts">
  import cx from "classnames"

  type Props = {
    current: number
    total: number
  }

  const {current, total}: Props = $props()
</script>

<div class="flex w-full">
  {#each Array(total) as _, i (i)}
    <div
      class={cx("h-1 flex-1 transition-colors", {
        "bg-primary text-primary-content": i < current,
        "bg-surface-more": i >= current,
      })}>
    </div>
  {/each}
</div>
