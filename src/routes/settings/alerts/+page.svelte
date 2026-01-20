<script lang="ts">
  import Inbox from "@assets/icons/inbox.svg?dataurl"
  import Bell from "@assets/icons/bell.svg?dataurl"
  import {preventDefault} from "@lib/html"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import {pushToast} from "@app/util/toast"
  import {clearBadges} from "@app/util/notifications"
  import {userSettingsValues} from "@app/core/state"
  import {publishSettings} from "@app/core/commands"

  const reset = () => {
    settings = {...$userSettingsValues}
  }

  const onsubmit = preventDefault(async () => {
    await publishSettings($state.snapshot(settings))

    pushToast({message: "Your settings have been saved!"})
  })

  let settings = $state({...$userSettingsValues})

  $effect(() => {
    if (!$userSettingsValues.alerts_badge) {
      clearBadges()
    }
  })
</script>

<form class="content column gap-4" {onsubmit}>
  <div class="card2 bg-alt col-4 shadow-md">
    <strong class="text-lg">Alert Settings</strong>
    <div class="flex justify-between">
      <p>Show badge for unread alerts</p>
      <input type="checkbox" class="toggle toggle-primary" bind:checked={settings.alerts_badge} />
    </div>
    <div class="flex justify-between">
      <p>Play sound for new messages</p>
      <input type="checkbox" class="toggle toggle-primary" bind:checked={settings.alerts_sound} />
    </div>
    <div class="flex items-center justify-between">
      <strong class="flex items-center gap-3">
        <Icon icon={Inbox} />
        Space Activity
      </strong>
    </div>
    <div class="flex justify-between">
      <p>Notify me about new messages</p>
      <input type="checkbox" class="toggle toggle-primary" bind:checked={settings.alerts_spaces} />
    </div>
    <div class="flex justify-between">
      <p>Always notify me when mentioned</p>
      <input type="checkbox" class="toggle toggle-primary" checked={settings.alerts_mentions} />
    </div>
    <!-- todo: add list of muted spaces -->
    <div class="flex items-center justify-between">
      <strong class="flex items-center gap-3">
        <Icon icon={Bell} />
        Direct Messages
      </strong>
    </div>
    <div class="flex justify-between">
      <p>Notify me about new messages</p>
      <input
        type="checkbox"
        class="toggle toggle-primary"
        bind:checked={settings.alerts_messages} />
    </div>
    <div class="mt-4 flex flex-row items-center justify-between gap-4">
      <Button class="btn btn-neutral" onclick={reset}>Discard Changes</Button>
      <Button type="submit" class="btn btn-primary">Save Changes</Button>
    </div>
  </div>
</form>
