<script lang="ts">
  import {preventDefault} from "@lib/html"
  import Button from "@lib/components/Button.svelte"
  import {pushToast} from "@app/util/toast"
  import {PLATFORM_NAME, RelayAuthMode, userSettingsValues} from "@app/core/state"
  import {publishSettings} from "@app/core/commands"

  const reset = () => {
    settings = {...$userSettingsValues}
  }

  const onAuthModeChange = (e: any) => {
    settings.auth_mode = e.target.checked ? RelayAuthMode.Aggressive : RelayAuthMode.Conservative
  }

  const onsubmit = preventDefault(async () => {
    await publishSettings($state.snapshot(settings))

    pushToast({message: "Your settings have been saved!"})
  })

  let settings = $state({...$userSettingsValues})
</script>

<form class="content column gap-4" {onsubmit}>
  <div class="card2 bg-alt flex flex-col gap-4 shadow-md">
    <strong class="text-lg">Privacy Settings</strong>
    <div class="grid grid-cols-2 gap-2">
      <p>Authenticate with unknown relays?</p>
      <input
        type="checkbox"
        class="toggle toggle-primary"
        onchange={onAuthModeChange}
        checked={settings.auth_mode === RelayAuthMode.Aggressive} />
      <p class="col-span-2 text-sm opacity-70">
        Controls whether {PLATFORM_NAME} will identify you to relays not in your lists.
      </p>
    </div>
    <div class="grid grid-cols-2 gap-2">
      <p>Report errors?</p>
      <input type="checkbox" class="toggle toggle-primary" bind:checked={settings.report_errors} />
      <p class="col-span-2 text-sm opacity-70">
        Allow {PLATFORM_NAME} to send error reports to help improve the app.
      </p>
    </div>
    <div class="grid grid-cols-2 gap-2">
      <p>Report usage?</p>
      <input type="checkbox" class="toggle toggle-primary" bind:checked={settings.report_usage} />
      <p class="col-span-2 text-sm opacity-70">
        Allow {PLATFORM_NAME} to collect anonymous usage data.
      </p>
    </div>
    <div class="mt-4 flex flex-row items-center justify-between gap-4">
      <Button class="btn btn-neutral" onclick={reset}>Discard Changes</Button>
      <Button type="submit" class="btn btn-primary">Save Changes</Button>
    </div>
  </div>
</form>
