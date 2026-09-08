<script lang="ts">
  import Stars from "@assets/icons/stars.svg?dataurl"
  import CheckCircle from "@assets/icons/check-circle.svg?dataurl"
  import Stethoscope from "@assets/icons/stethoscope.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Badge from "@lib/components/Badge.svelte"
  import Button from "@lib/components/Button.svelte"
  import HealthCheckItem from "@app/components/HealthCheckItem.svelte"
  import {healthChecks} from "@app/healthChecks"

  const pending = $healthChecks.pending.$

  const applyAll = () => {
    for (const healthCheck of $pending) {
      $healthChecks.apply(healthCheck)
    }
  }
</script>

<div class="card flex flex-col gap-3">
  <div class="flex items-center justify-between gap-3">
    <strong class="flex items-center gap-2 text-lg">
      <Icon icon={Stethoscope} />
      Health checks
    </strong>
    {#if $pending.length > 0}
      <Badge variant="warning">{$pending.length} open</Badge>
    {/if}
  </div>
  {#if $pending.length === 0}
    <p class="flex items-center gap-2 text-sm opacity-75">
      <Icon icon={CheckCircle} size={4} />
      Your connection to the network looks healthy.
    </p>
  {:else}
    {#each $pending as healthCheck (healthCheck.title)}
      <HealthCheckItem {healthCheck} />
    {/each}
    {#if $pending.length > 1}
      <Button class="button button-primary button-sm" onclick={applyAll}>
        <Icon icon={Stars} size={4} />
        Apply all recommendations
      </Button>
    {/if}
  {/if}
</div>
