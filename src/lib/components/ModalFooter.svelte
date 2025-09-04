<script lang="ts">
  import type {Snippet} from "svelte"

  interface Props {
    children?: Snippet
  }

  const {children}: Props = $props()
</script>

<div class="row-4 mt-4 items-center justify-between">
  {@render children?.()}
</div>
