<script lang="ts">
  import type {Snippet} from "svelte"

  type Props = {
    children?: Snippet
    class?: string
  }

  const {children, class: className}: Props = $props()
</script>

<div class="flex items-center gap-2 p-2 text-xs uppercase text-content-subtle {className}">
  <div class="h-px grow" style="background-color: var(--line)"></div>
  {#if children}
    <p>{@render children?.()}</p>
    <div class="h-px grow" style="background-color: var(--line)"></div>
  {/if}
</div>
