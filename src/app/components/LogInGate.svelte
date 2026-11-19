<script lang="ts">
  import type {ComponentProps, Snippet} from "svelte"
  import LogInPanel from "@app/components/LogInPanel.svelte"
  import {user} from "@app/core/user"

  type Props = ComponentProps<typeof LogInPanel> & {
    children: Snippet
  }

  const {children, ...panel}: Props = $props()
</script>

{#if $user}
  {@render children()}
{:else}
  <LogInPanel {...panel} />
{/if}
