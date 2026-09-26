<script lang="ts">
  import type {Snippet} from "svelte"

  type Props = {
    children?: Snippet
    class?: string
  }

  const {children, ...props}: Props = $props()
</script>

<div
  data-component="PageBar"
  class="bg-surface relative p-4 shadow-md h-20 md:h-12 flex flex-col justify-center z-nav {props.class}">
  {@render children?.()}
</div>
