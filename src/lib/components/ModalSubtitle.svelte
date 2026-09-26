<script lang="ts">
  import type {Snippet} from "svelte"

  type Props = {
    children: Snippet
  }

  const {children}: Props = $props()
</script>

<p class="text-content-muted text-center text-sm">{@render children()}</p>
