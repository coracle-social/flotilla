<script lang="ts">
  import DangerTriangle from "@assets/icons/danger-triangle.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import StatusIndicator from "@lib/components/StatusIndicator.svelte"
  import SocketStatusIndicator from "@app/components/SocketStatusIndicator.svelte"

  type Props = {
    url: string
    error?: string
    notifications: boolean
  }

  let {url, error = $bindable(), notifications = $bindable()}: Props = $props()
</script>

<div class="card2 card2-sm bg-alt">
  <div class="flex justify-between gap-12">
    <div class="col-1">
      <strong>Enable notifications for this space</strong>
      <p class="text-xs opacity-75">
        Get notified about new activity in this space. You can change this later in settings.
      </p>
    </div>
    <input type="checkbox" class="toggle toggle-primary" bind:checked={notifications} />
  </div>
</div>
<div class="card2 card2-sm bg-alt flex flex-col gap-2">
  <div class="flex justify-between">
    <strong>Connection Status</strong>
    {#if error}
      <StatusIndicator class="bg-error">Error</StatusIndicator>
    {:else}
      <SocketStatusIndicator {url} />
    {/if}
  </div>
  {#if error}
    <div class="flex items-center gap-2">
      <Icon icon={DangerTriangle} />
      <p class="text-sm opacity-75">{error}</p>
    </div>
  {/if}
</div>
