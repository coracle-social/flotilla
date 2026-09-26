<script lang="ts">
  import type {Snippet} from "svelte"

  type Props = {
    children: Snippet
  }

  const {children}: Props = $props()
</script>

<div class="flex flex-col m-auto max-w-xs gap-2 py-4">
  {@render children()}
</div>
