<script lang="ts">
  import type {Command} from "@welshman/app"
  import Stars from "@assets/icons/stars.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import HealthCheckItem from "@app/components/HealthCheckItem.svelte"
  import HealthCheckReview from "@app/components/HealthCheckReview.svelte"
  import KeyDownload from "@app/components/KeyDownload.svelte"
  import type {HealthCheck, HealthCheckPrompt} from "@app/areas/healthChecks"
  import {completeKeyBackup, healthChecks} from "@app/areas/healthChecks"
  import {session} from "@app/core/session"
  import {pushModal} from "@app/navigation/dialogs"

  type Props = {
    class?: string
  }

  const {class: className = ""}: Props = $props()

  const pending = $healthChecks.pending.$

  const finishKeyBackup = () => {
    completeKeyBackup()
    history.back()
  }

  const openPrompt = (result: Command | HealthCheckPrompt | void) => {
    if (result === "backupKey") {
      pushModal(KeyDownload, {
        secret: (session.get()!.data as {secret: string}).secret,
        next: finishKeyBackup,
        submitText: "Done",
      })
    }
  }

  // Changes are confirmed first, and fixes that change nothing to review run once they're saved.
  const review = (checks: HealthCheck[]) => {
    const plans = checks.map(check => $healthChecks.plan(check))
    const reviewed = plans.filter(plan => plan.changes.length > 0)
    const applyRest = () =>
      plans.filter(plan => plan.changes.length === 0).forEach(plan => plan.apply().then(openPrompt))

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
