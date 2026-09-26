<script lang="ts">
  import DangerTriangle from "@assets/icons/danger-triangle.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import StatusIndicator from "@lib/components/StatusIndicator.svelte"

  type Props = {
    error: string
  }

  const {error}: Props = $props()
</script>

<div class="card card-sm flex flex-col gap-2">
  <div class="flex justify-between">
    <strong>Connection Status</strong>
    <StatusIndicator class="bg-error text-error-content">Error</StatusIndicator>
  </div>
  <div class="flex items-center gap-2">
    <Icon icon={DangerTriangle} />
    <p class="text-sm opacity-75">{error}</p>
  </div>
</div>
