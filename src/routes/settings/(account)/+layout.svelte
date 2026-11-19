<script lang="ts">
  import LogInPanel from "@app/components/LogInPanel.svelte"
  import {user} from "@app/core/user"
  import type {LayoutProps} from "./$types"

  const {children}: LayoutProps = $props()
</script>

{#if $user}
  {@render children()}
{:else}
  <LogInPanel
    title="Log in to change your settings"
    message="Your profile, alerts, wallet and preferences live here." />
{/if}
