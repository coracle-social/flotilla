<script lang="ts">
  import type {Snippet} from "svelte"
  import cx from "classnames"

  type Props = {
    children?: Snippet
    size?: "md" | "sm" | "xs"
    loading?: boolean
    class?: string
  }

  const {children, size = "md", loading = true, ...restProps}: Props = $props()

  const spinnerClass = $derived(
    cx("spinner", {
      "spinner-sm": size === "sm",
      "spinner-xs": size === "xs",
    }),
  )
</script>

<div class={cx("flex items-center gap-2", restProps.class)}>
  {#if loading}
    <span class={spinnerClass}></span>
  {/if}
  {@render children?.()}
</div>
