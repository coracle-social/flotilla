<script lang="ts">
  type Props = {
    children?: import("svelte").Snippet
  }

  const {children}: Props = $props()
</script>

<div
  class="secondary-nav__header flex items-center justify-between px-1 py-2 text-sm font-bold uppercase">
  {@render children?.()}
</div>
