<script lang="ts">
  type Props = {
    notifications: boolean
  }

  let {notifications = $bindable()}: Props = $props()
</script>

<div class="card card-sm">
  <div class="flex justify-between gap-12">
    <div class="flex flex-col gap-1">
      <strong>Enable notifications for this space</strong>
      <p class="text-xs opacity-75">
        Get notified about new messages in this space. You can change this later in settings.
      </p>
    </div>
    <input type="checkbox" class="toggle" bind:checked={notifications} />
  </div>
</div>
