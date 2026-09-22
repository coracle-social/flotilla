<script lang="ts">
  import Stars from "@assets/icons/stars.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import type {HealthCheck} from "@app/healthChecks"
  import {healthChecks, reviewPlans} from "@app/healthChecks"

  type Props = {
    healthCheck: HealthCheck
  }

  const {healthCheck}: Props = $props()

  const start = () => reviewPlans([$healthChecks.plan(healthCheck)])
</script>

<div
  role="group"
  aria-label={healthCheck.title}
  class="flex items-center justify-between gap-3 px-4 py-3">
  <div class="flex min-w-0 flex-col gap-1">
    <strong class="text-sm">{healthCheck.title}</strong>
    <p class="text-sm opacity-75">{healthCheck.description}</p>
  </div>
  <Button class="button button-neutral button-sm shrink-0" onclick={start}>
    <Icon icon={Stars} size={4} />
    Fix
  </Button>
</div>
