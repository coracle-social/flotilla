<script lang="ts">
  import Stars from "@assets/icons/stars.svg?dataurl"
  import CheckCircle from "@assets/icons/check-circle.svg?dataurl"
  import Stethoscope from "@assets/icons/stethoscope.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Badge from "@lib/components/Badge.svelte"
  import Button from "@lib/components/Button.svelte"
  import HomeSection from "@app/components/HomeSection.svelte"
  import HealthCheckItem from "@app/components/HealthCheckItem.svelte"
  import HealthCheckReview from "@app/components/HealthCheckReview.svelte"
  import KeyDownload from "@app/components/KeyDownload.svelte"
  import type {HealthCheck} from "@app/healthChecks"
  import {healthChecks, needsKeyBackup} from "@app/healthChecks"
  import {session} from "@app/core"
  import {pushModal} from "@app/modal"

  const pending = $healthChecks.pending.$

  const count = $derived($pending.length + ($needsKeyBackup ? 1 : 0))

  const finishKeyBackup = () => {
    needsKeyBackup.set(false)
    history.back()
  }

  const backUpKey = () =>
    pushModal(KeyDownload, {
      secret: ($session!.data as {secret: string}).secret,
      next: finishKeyBackup,
      submitText: "Done",
    })

  const review = (checks: HealthCheck[], next?: () => void) => {
    const plans = checks
      .map(check => $healthChecks.plan(check))
      .filter(plan => plan.changes.length > 0)

    if (plans.length > 0) {
      pushModal(HealthCheckReview, {plans, next})
    } else {
      next?.()
    }
  }

  const reviewAll = () => review($pending, $needsKeyBackup ? backUpKey : undefined)
</script>

<HomeSection title="Health checks" icon={Stethoscope}>
  {#snippet action()}
    {#if count > 0}
      <Badge variant="warning">{count} open</Badge>
    {/if}
  {/snippet}
  {#if count === 0}
    <p class="flex items-center gap-2 px-4 pb-4 text-sm opacity-75">
      <Icon icon={CheckCircle} size={4} />
      Your connection to the network looks healthy.
    </p>
  {:else}
    <div class="flex flex-col divide-y divide-line border-t border-line">
      {#each $pending as healthCheck (healthCheck.id)}
        <HealthCheckItem
          title={healthCheck.title}
          description={healthCheck.description}
          onfix={() => review([healthCheck])} />
      {/each}
      {#if $needsKeyBackup}
        <HealthCheckItem
          title="Back Up Your Key"
          description="Save a backup of your private key in a secure place."
          onfix={backUpKey} />
      {/if}
      {#if count > 1}
        <div class="flex justify-center p-3">
          <Button class="button button-primary button-sm" onclick={reviewAll}>
            <Icon icon={Stars} size={4} />
            Apply all recommendations
          </Button>
        </div>
      {/if}
    </div>
  {/if}
</HomeSection>
