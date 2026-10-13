<script lang="ts">
  import Stars from "@assets/icons/stars.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import HealthCheckItem from "@app/components/HealthCheckItem.svelte"
  import HealthCheckReview from "@app/components/HealthCheckReview.svelte"
  import type {HealthCheck} from "@app/features/healthChecks"
  import {healthChecks} from "@app/features/healthChecks"
  import {pushModal} from "@app/ui/modal"

  type Props = {
    class?: string
  }

  const {class: className = ""}: Props = $props()

  const pending = $healthChecks.pending.$

  // Changes are confirmed first, and fixes that change nothing to review run once they're saved.
  const review = (checks: HealthCheck[]) => {
    const plans = checks.map(check => $healthChecks.plan(check))
    const reviewed = plans.filter(plan => plan.changes.length > 0)
    const applyRest = () =>
      plans.filter(plan => plan.changes.length === 0).forEach(plan => plan.apply())

    if (reviewed.length > 0) {
      pushModal(HealthCheckReview, {plans: reviewed, next: applyRest})
    } else {
      applyRest()
    }
  }

  const fix = (healthCheck: HealthCheck) => () => review([healthCheck])

  const reviewAll = () => review($pending)
</script>

{#if $pending.length > 0}
  <div class="flex flex-col divide-y divide-line border-t border-line {className}">
    {#each $pending as healthCheck (healthCheck.id)}
      <HealthCheckItem
        title={healthCheck.title}
        description={healthCheck.description}
        onfix={fix(healthCheck)} />
    {/each}
    {#if $pending.length > 1}
      <div class="flex justify-center p-3">
        <Button class="button button-primary button-sm" onclick={reviewAll}>
          <Icon icon={Stars} size={4} />
          Apply all recommendations
        </Button>
      </div>
    {/if}
  </div>
{/if}
