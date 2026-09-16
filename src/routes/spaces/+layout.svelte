<script lang="ts">
  import type {Snippet} from "svelte"

  type Props = {
    children?: Snippet
    params: {relay?: string}
  }

  const {children, params}: Props = $props()
</script>

{#key params.relay}
  {@render children?.()}
{/key}
