<script lang="ts">
  import type {LayoutProps} from "./$types"

  const {children, params}: LayoutProps = $props()
</script>

{#key params.nevent}
  {@render children?.()}
{/key}
