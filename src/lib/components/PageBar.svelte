<script lang="ts">
  import type {Snippet} from "svelte"
  import {MediaQuery} from "svelte/reactivity"
  import cx from "classnames"

  type Props = {
    children?: Snippet
    class?: string
  }

  const {children, ...props}: Props = $props()

  const desktop = new MediaQuery("min-width: 768px")
</script>

<div
  data-component="PageBar"
  class={cx(
    "bg-surface text-content relative p-4 shadow-md h-20 md:h-12 flex flex-col justify-center z-nav",
    props.class,
    {"mobile-nav": !desktop.current},
  )}>
  {@render children?.()}
</div>
