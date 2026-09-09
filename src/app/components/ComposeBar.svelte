<script lang="ts">
  import cx from "classnames"
  import type {Snippet} from "svelte"
  import type {HTMLAttributes} from "svelte/elements"
  import {slide} from "@lib/transition"

  type Props = HTMLAttributes<HTMLDivElement> & {
    children: Snippet
  }

  const {children, ...restProps}: Props = $props()

  const className = $derived(
    cx("border-l-primary bg-surface-more border-l-2 border-solid px-2 py-1", restProps.class),
  )
</script>

<div {...restProps} class={className} transition:slide>
  {@render children()}
</div>
