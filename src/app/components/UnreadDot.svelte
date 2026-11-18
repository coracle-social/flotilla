<script lang="ts">
  import cx from "classnames"
  import {fade} from "@lib/transition"
  import {unreadDots} from "@app/tools/activity"

  type Props = {
    path: string
    class?: string
  }

  const {path, class: className}: Props = $props()
</script>

{#if $unreadDots.has(path)}
  <div class={cx("inline-block h-2 w-2 rounded-full bg-primary", className)} transition:fade></div>
{/if}
