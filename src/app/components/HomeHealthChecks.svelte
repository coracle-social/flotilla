<script lang="ts">
  import CheckCircle from "@assets/icons/check-circle.svg?dataurl"
  import Stethoscope from "@assets/icons/stethoscope.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import HomeSection from "@app/components/HomeSection.svelte"
  import HealthCheckList from "@app/components/HealthCheckList.svelte"
  import {healthChecks} from "@app/healthChecks"

  type Props = {
    class?: string
  }

  const {class: className = ""}: Props = $props()

  const pending = $healthChecks.pending.$
</script>

<HomeSection title="Health checks" icon={Stethoscope} class={className}>
  {#snippet action()}
    {#if $pending.length > 0}
      <span class="badge badge-warning">{$pending.length} open</span>
    {/if}
  {/snippet}
  {#if $pending.length === 0}
    <p class="flex items-center gap-2 px-4 pb-4 text-sm opacity-75">
      <Icon icon={CheckCircle} size={4} />
      Your connection to the network looks healthy.
    </p>
  {/if}
  <HealthCheckList />
</HomeSection>
