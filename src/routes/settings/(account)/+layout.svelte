<script lang="ts">
  import LogInGate from "@app/components/LogInGate.svelte"
  import type {LayoutProps} from "./$types"

  const {children}: LayoutProps = $props()
</script>

<LogInGate
  title="Log in to change your settings"
  message="Your profile, alerts, wallet and preferences live here.">
  {@render children()}
</LogInGate>
