<script lang="ts">
  import type {LayoutProps} from "./$types"

  const {children, params}: LayoutProps = $props()
</script>

{#key params.npub}
  {@render children?.()}
{/key}
