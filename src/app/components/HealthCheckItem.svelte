<script lang="ts">
  import Stars from "@assets/icons/stars.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import Card from "@lib/components/Card.svelte"
  import type {HealthCheck} from "@app/healthChecks"
  import {healthChecks} from "@app/healthChecks"

  type Props = {
    healthCheck: HealthCheck
  }

  const {healthCheck}: Props = $props()

  const apply = () => $healthChecks.apply(healthCheck)
</script>

<Card sm class="bg-surface flex justify-between">
  <div class="flex flex-col gap-1">
    <strong>{healthCheck.title}</strong>
    <p class="text-sm">{healthCheck.description}</p>
  </div>
  <Button class="button button-neutral button-sm" onclick={apply}>
    <Icon icon={Stars} />
    {healthCheck.action}
  </Button>
</Card>
