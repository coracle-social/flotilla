<script lang="ts">
  import type {Snippet} from "svelte"
  import type {HTMLAttributes} from "svelte/elements"
  import {isMobile} from "@lib/html"

  type Props = HTMLAttributes<HTMLDivElement> & {
    children: Snippet
    onTap: (event: MouseEvent) => void
  }

  const {children, onTap, ...restProps}: Props = $props()

  const onclick = (event: MouseEvent) => {
    if (isMobile) {
      onTap(event)
    }
  }
</script>

<div role="button" tabindex="0" {onclick} {...restProps}>
  {@render children()}
</div>
