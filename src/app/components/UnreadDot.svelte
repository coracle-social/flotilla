<script lang="ts">
  import cx from "classnames"
  import {fade} from "@lib/transition"
  import {notifications} from "@app/notifications"

  type Props = {
    path: string
    class?: string
  }

  const {path, class: className}: Props = $props()
</script>

{#if $notifications.has(path)}
  <div class={cx("inline-block h-2 w-2 rounded-full bg-primary", className)} transition:fade></div>
{/if}
