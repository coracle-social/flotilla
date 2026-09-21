<script lang="ts">
  import type {Snippet} from "svelte"
  import cx from "classnames"

  const {
    children,
    size = "md",
    loading = true,
    reserveSpace = false,
    ...restProps
  }: {
    children?: Snippet
    size?: "md" | "sm" | "xs"
    loading?: boolean
    // Reserves the spinner's slot even while idle, so toggling `loading` doesn't resize
    // (and reflow) the button. Off by default since it costs unused width otherwise.
    reserveSpace?: boolean
    class?: string
  } = $props()

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
  {:else if reserveSpace}
    <span class={cx(spinnerClass, "invisible")}></span>
  {/if}
  {@render children?.()}
</div>
