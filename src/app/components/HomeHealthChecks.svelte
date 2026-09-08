<script lang="ts">
  import Stars from "@assets/icons/stars.svg?dataurl"
  import CheckCircle from "@assets/icons/check-circle.svg?dataurl"
  import Stethoscope from "@assets/icons/stethoscope.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Badge from "@lib/components/Badge.svelte"
  import Button from "@lib/components/Button.svelte"
  import HomeSection from "@app/components/HomeSection.svelte"
  import HealthCheckItem from "@app/components/HealthCheckItem.svelte"
  import {healthChecks} from "@app/healthChecks"

  const pending = $healthChecks.pending.$

  const applyAll = () => {
    for (const healthCheck of $pending) {
      $healthChecks.apply(healthCheck)
    }
  }
</script>

<HomeSection title="Health checks" icon={Stethoscope}>
  {#snippet action()}
    {#if $pending.length > 0}
      <Badge variant="warning">{$pending.length} open</Badge>
    {/if}
  {/snippet}
  {#if $pending.length === 0}
    <p class="flex items-center gap-2 px-4 pb-4 text-sm opacity-75">
      <Icon icon={CheckCircle} size={4} />
      Your connection to the network looks healthy.
    </p>
  {:else}
    <div class="flex flex-col divide-y divide-line border-t border-line">
      {#each $pending as healthCheck (healthCheck.title)}
        <HealthCheckItem {healthCheck} />
      {/each}
      {#if $pending.length > 1}
        <div class="flex justify-center p-3">
          <Button class="button button-primary button-sm" onclick={applyAll}>
            <Icon icon={Stars} size={4} />
            Apply all recommendations
          </Button>
        </div>
      {/if}
    </div>
  {/if}
</HomeSection>
